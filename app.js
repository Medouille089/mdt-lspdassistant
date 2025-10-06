const express = require("express");
const path = require("path");
const { createServer } = require("http");
const { Server } = require("socket.io");
const pkg = require("pg");
require('./utils/liveUsersCleaner');
require('./utils/cleanSanctions');
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("./config/passport");
const { SESSION_SECRET } = require("./config/env");
const { startOvertimeScheduler } = require("./utils/rappelPointeuse");
const { OperationsManager } = require("./LSPD/trello/scripts/OperationsManager.js");

const { Pool } = pkg;
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const port = process.env.PORT || 3001;

// Configuration Trello Board avec PostgreSQL
let useDatabase = !!process.env.DATABASE_URL;
let boardData = { lists: [], tags: [] };
const DEFAULT_BOARD_ID = 'default-board';
const operationsManager = new OperationsManager();

let pool;
if (useDatabase) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err, client) => {
    console.error('Erreur inattendue sur le client PostgreSQL', err);
  });
} else {
  console.warn('⚠️  DATABASE_URL non défini pour Trello, fonctionnement en mode mémoire locale');
}

// Test de connexion avec retry
async function testTrelloConnection() {
    if (!useDatabase) return false;
    
    let retries = 3;
    while (retries > 0) {
        try {
            const client = await pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            return true;
        } catch (err) {
            console.error(`❌ Erreur de connexion PostgreSQL (${retries} tentatives restantes):`, err.message);
            retries--;
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
    
    console.warn('Basculement en mode mémoire locale après échec de connexion');
    useDatabase = false;
    return false;
}

// Initialisation de la base de données
async function initTrelloDatabase() {
    if (!useDatabase) return;

    const connected = await testTrelloConnection();
    if (!connected) return;

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        await ensureNormalizedSchema(client);
        await ensureDefaultBoard(client);

        await client.query('COMMIT');
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error('❌ Erreur lors de l\'initialisation de la base de données:', err);
        console.warn('Basculement en mode mémoire locale');
        useDatabase = false;
    } finally {
        if (client) client.release();
    }
}

async function ensureNormalizedSchema(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS trello_boards (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'Board',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS trello_lists (
            id TEXT PRIMARY KEY,
            board_id TEXT NOT NULL REFERENCES trello_boards(id) ON DELETE CASCADE,
            title TEXT NOT NULL DEFAULT '',
            position INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS trello_tags (
            id TEXT PRIMARY KEY,
            board_id TEXT NOT NULL REFERENCES trello_boards(id) ON DELETE CASCADE,
            label TEXT NOT NULL,
            color TEXT NOT NULL,
            text_color TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS trello_cards (
            id TEXT PRIMARY KEY,
            board_id TEXT NOT NULL REFERENCES trello_boards(id) ON DELETE CASCADE,
            list_id TEXT NOT NULL REFERENCES trello_lists(id) ON DELETE CASCADE,
            position INTEGER NOT NULL DEFAULT 0,
            text TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            type TEXT NOT NULL DEFAULT 'text',
            image JSONB,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS trello_card_tags (
            card_id TEXT NOT NULL REFERENCES trello_cards(id) ON DELETE CASCADE,
            tag_id TEXT NOT NULL REFERENCES trello_tags(id) ON DELETE CASCADE,
            position INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (card_id, tag_id)
        )
    `);
}

async function ensureDefaultBoard(client) {
    await client.query(`
        INSERT INTO trello_boards (id, title)
        VALUES ($1, 'Board principal')
        ON CONFLICT (id) DO NOTHING
    `, [DEFAULT_BOARD_ID]);
}

async function loadBoardData() {
    if (!useDatabase) {
        return normalizeBoardPayload(boardData);
    }

    let client;
    try {
        client = await pool.connect();

        const tagsRes = await client.query(`
            SELECT id, label, color, text_color, position
            FROM trello_tags
            WHERE board_id = $1
            ORDER BY position, id
        `, [DEFAULT_BOARD_ID]);

        const listsRes = await client.query(`
            SELECT id, title, position
            FROM trello_lists
            WHERE board_id = $1
            ORDER BY position, id
        `, [DEFAULT_BOARD_ID]);

        const cardsRes = await client.query(`
            SELECT id, list_id, position, text, description, type, image, metadata
            FROM trello_cards
            WHERE board_id = $1
            ORDER BY position, id
        `, [DEFAULT_BOARD_ID]);

        const cardTagsRes = await client.query(`
            SELECT ct.card_id, ct.tag_id
            FROM trello_card_tags ct
            JOIN trello_tags t ON t.id = ct.tag_id
            WHERE t.board_id = $1
            ORDER BY ct.card_id, ct.position
        `, [DEFAULT_BOARD_ID]);

        const cardTagsMap = new Map();
        cardTagsRes.rows.forEach(({ card_id, tag_id }) => {
            if (!cardTagsMap.has(card_id)) cardTagsMap.set(card_id, []);
            cardTagsMap.get(card_id).push(tag_id);
        });

        const cardsByList = new Map();
        cardsRes.rows.forEach((row) => {
            const metadata = row.metadata || {};
            const card = {
                ...metadata,
                id: row.id,
                text: row.text ?? '',
                description: row.description ?? '',
                type: row.type ?? 'text'
            };
            if (row.image) {
                card.image = row.image;
            }
            card.tags = cardTagsMap.get(row.id) || [];
            if (!cardsByList.has(row.list_id)) cardsByList.set(row.list_id, []);
            cardsByList.get(row.list_id).push(card);
        });

        const lists = listsRes.rows.map((row) => ({
            id: row.id,
            title: row.title,
            cards: cardsByList.get(row.id) || []
        }));

        const tags = tagsRes.rows.map((row) => ({
            id: row.id,
            label: row.label,
            color: row.color,
            textColor: row.text_color
        }));

        return normalizeBoardPayload({ lists, tags });
    } catch (err) {
        console.error('❌ Erreur lors du chargement des données:', err);
        return normalizeBoardPayload(boardData);
    } finally {
        if (client) client.release();
    }
}

const DB_SAVE_MAX_RETRIES = 3;
const DB_RETRY_DELAY_MS = 500;

function disableDatabase() {
    if (!useDatabase) return;

    console.warn('⚠️  PostgreSQL indisponible, passage en mode mémoire locale');
    useDatabase = false;

    if (pool) {
        pool.end().catch((err) => {
            console.error('Erreur lors de la fermeture du pool PostgreSQL:', err);
        }).finally(() => {
            pool = null;
        });
    }
}

async function saveBoardData(newBoardData) {
    const normalized = normalizeBoardPayload(newBoardData);
    boardData = normalized;

    if (!useDatabase) return boardData;

    for (let attempt = 1; attempt <= DB_SAVE_MAX_RETRIES; attempt++) {
        let client;
        try {
            client = await pool.connect();
            await client.query('BEGIN');
            await persistBoard(client, normalized);
            await client.query('COMMIT');
            client.release();
            
            return boardData;
        } catch (err) {
            if (client) {
                try { await client.query('ROLLBACK'); } catch { /* ignore rollback errors */ }
                client.release();
            }

            console.error(`❌ Erreur lors de la sauvegarde (tentative ${attempt}/${DB_SAVE_MAX_RETRIES}):`, err);

            if (attempt === DB_SAVE_MAX_RETRIES) {
                console.warn('⛔ Abandon de la sauvegarde, conservation du mode mémoire');
                disableDatabase();
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, DB_RETRY_DELAY_MS * attempt));
        }
    }

    return boardData;
}

function normalizeBoardPayload(data = {}) {
    const rawLists = Array.isArray(data?.lists) ? data.lists : [];
    const lists = rawLists.map((list) => {
        const safeList = list || {};
        const { cards = [], ...rest } = safeList;
        const cardsArray = Array.isArray(cards) ? cards.slice() : [];
        return { ...rest, cards: cardsArray };
    });

    const tags = Array.isArray(data?.tags) ? data.tags.slice() : [];

    return { lists, tags };
}

function splitCard(card) {
    const source = card || {};
    const {
        id,
        text = '',
        description = '',
        type = 'text',
        image = null,
        tags = [],
        ...rest
    } = source;

    return {
        id,
        text,
        description,
        type: type || 'text',
        image,
        tags: Array.isArray(tags) ? tags : [],
        metadata: sanitizeMetadata(rest)
    };
}

function sanitizeMetadata(input) {
    if (!input || typeof input !== 'object') {
        return {};
    }

    const cleaned = Object.entries(input).reduce((acc, [key, value]) => {
        if (value === undefined) return acc;
        acc[key] = value;
        return acc;
    }, {});

    return Object.keys(cleaned).length ? cleaned : {};
}

async function persistBoard(client, normalized) {
    await ensureDefaultBoard(client);

    const tags = normalized.tags || [];
    const tagIds = tags.filter((tag) => tag && tag.id).map((tag) => tag.id);

    await client.query(`
        DELETE FROM trello_tags
        WHERE board_id = $1
          AND NOT (id = ANY($2::text[]))
    `, [DEFAULT_BOARD_ID, tagIds]);

    for (let index = 0; index < tags.length; index++) {
        const tag = tags[index];
        if (!tag?.id) continue;

        await client.query(`
            INSERT INTO trello_tags (id, board_id, label, color, text_color, position, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (id) DO UPDATE SET
                board_id = EXCLUDED.board_id,
                label = EXCLUDED.label,
                color = EXCLUDED.color,
                text_color = EXCLUDED.text_color,
                position = EXCLUDED.position,
                updated_at = NOW()
        `, [
            tag.id,
            DEFAULT_BOARD_ID,
            tag.label || '',
            tag.color || '#63666b',
            tag.textColor || null,
            index
        ]);
    }

    const lists = normalized.lists || [];
    const listIds = lists.filter((list) => list && list.id).map((list) => list.id);

    await client.query(`
        DELETE FROM trello_lists
        WHERE board_id = $1
          AND NOT (id = ANY($2::text[]))
    `, [DEFAULT_BOARD_ID, listIds]);

    for (let index = 0; index < lists.length; index++) {
        const list = lists[index];
        if (!list?.id) continue;

        await client.query(`
            INSERT INTO trello_lists (id, board_id, title, position, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (id) DO UPDATE SET
                board_id = EXCLUDED.board_id,
                title = EXCLUDED.title,
                position = EXCLUDED.position,
                updated_at = NOW()
        `, [
            list.id,
            DEFAULT_BOARD_ID,
            list.title || 'Sans titre',
            index
        ]);
    }

    const cards = [];
    lists.forEach((list) => {
        if (!list?.id) return;
        const listCards = Array.isArray(list.cards) ? list.cards : [];
        listCards.forEach((card, idx) => {
            cards.push({ listId: list.id, position: idx, data: splitCard(card) });
        });
    });

    const cardIds = cards.map(({ data }) => data.id).filter(Boolean);

    await client.query(`
        DELETE FROM trello_cards
        WHERE board_id = $1
          AND NOT (id = ANY($2::text[]))
    `, [DEFAULT_BOARD_ID, cardIds]);

    const validTagIds = new Set(tagIds);

    for (const { listId, position, data } of cards) {
        if (!data.id) continue;

        const imagePayload = (data.image && typeof data.image === 'object') ? data.image : null;

        await client.query(`
            INSERT INTO trello_cards (id, board_id, list_id, position, text, description, type, image, metadata, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            ON CONFLICT (id) DO UPDATE SET
                board_id = EXCLUDED.board_id,
                list_id = EXCLUDED.list_id,
                position = EXCLUDED.position,
                text = EXCLUDED.text,
                description = EXCLUDED.description,
                type = EXCLUDED.type,
                image = EXCLUDED.image,
                metadata = EXCLUDED.metadata,
                updated_at = NOW()
        `, [
            data.id,
            DEFAULT_BOARD_ID,
            listId,
            position,
            data.text,
            data.description,
            data.type,
            imagePayload,
            data.metadata
        ]);

        await client.query('DELETE FROM trello_card_tags WHERE card_id = $1', [data.id]);

        for (let tagIndex = 0; tagIndex < data.tags.length; tagIndex++) {
            const tagId = data.tags[tagIndex];
            if (!validTagIds.has(tagId)) continue;

            await client.query(`
                INSERT INTO trello_card_tags (card_id, tag_id, position)
                VALUES ($1, $2, $3)
                ON CONFLICT (card_id, tag_id) DO UPDATE SET position = EXCLUDED.position
            `, [data.id, tagId, tagIndex]);
        }
    }

    await client.query('UPDATE trello_boards SET updated_at = NOW() WHERE id = $1', [DEFAULT_BOARD_ID]);
}

// Middleware session
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// Body parser
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Auth guard
app.use((req, res, next) => {
  const publicPaths = ['/login', '/callback', '/logout', '/bracelet', '/connect.html', '/trello'];

  // Autoriser uniquement les assets front (pas les .html)
  const isStaticAsset = req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg)$/i);
  if (isStaticAsset) return next();

  // Autoriser seulement les routes publiques
  if (publicPaths.includes(req.path)) return next();

  // Cas API interne
  if (req.headers['x-internal'] === 'true') return next();

  // Tout le reste → nécessite une connexion
  if (!req.isAuthenticated?.()) {
    return res.redirect('/login');
  }

  next();
});

// Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const braceletRoutes = require("./routes/bracelet");
const configRoutes = require("./config/setup");
const convocationRoute = require("./routes/convocation");
const agentsRoutes = require("./routes/agents");
const incidentsRoute = require("./routes/incidents");
const arrestationRoute = require("./routes/arrestation");
const delitsRoute = require("./routes/delits");
const dashboardRoute = require("./routes/dashboard");
const liveUsersRoute = require('./routes/liveUsers');
const pointeuse = require('./routes/pointeuse');
const setupPointeuse = require('./config/setupPointeuse');
const gradesRoute = require('./config/grades');
const absenceRoute = require("./routes/absence");
const sanctionsRoutes = require("./routes/sanctions");
const presenceIg = require("./routes/presenceig");
const ticketPanelRoutes = require('./routes/ticketPanel');
const adminOfficer = require('./routes/officers');
const rapportRookie = require('./routes/rapport-rookie');

app.use(configRoutes);
app.use(authRoutes);
app.use(userRoutes);
app.use(braceletRoutes);
app.use(arrestationRoute);
app.use(convocationRoute);
app.use(agentsRoutes);
app.use(incidentsRoute);
app.use(delitsRoute);
app.use(dashboardRoute);
app.use(liveUsersRoute);
app.use(pointeuse);
app.use(setupPointeuse);
app.use(gradesRoute);
app.use(absenceRoute);
app.use(sanctionsRoutes);
app.use('/api/presenceig', presenceIg);
app.use(ticketPanelRoutes);
app.use(adminOfficer);
app.use(rapportRookie);

// Routes Trello
app.get('/trello/health', async (req, res) => {
    if (!useDatabase) {
        return res.json({ 
            status: 'OK', 
            database: 'Mode mémoire locale (pas de DATABASE_URL)',
            timestamp: new Date().toISOString()
        });
    }
    
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as time');
        const serverTime = result.rows[0].time;
        client.release();
        
        res.json({ 
            status: 'OK', 
            database: 'PostgreSQL Connected',
            server_time: serverTime,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ 
            status: 'ERROR', 
            database: 'PostgreSQL Disconnected', 
            error: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.get('/trello/debug', (req, res) => {
    res.json({
        has_database_url: !!process.env.DATABASE_URL,
        database_url_preview: process.env.DATABASE_URL ? 
            process.env.DATABASE_URL.substring(0, 20) + '...' : 'non défini',
        use_database: useDatabase,
        node_env: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

// Connexion Socket.IO pour Trello
io.on("connection", async (socket) => {
    console.log("🔌 Nouvelle connexion");

    const { boardData: currentBoard, version } = operationsManager.getBoardState();
    boardData = currentBoard;
    socket.emit("boardSync", { boardData: currentBoard, version });

    socket.on("operation", async (operation, ack = () => {}) => {
        const result = operationsManager.applyOperation(operation);

        if (!result.success) {
            ack({ success: false, error: result.error, version: operationsManager.getBoardState().version, rebased: result.rebased });
            return;
        }

        const { boardData: updatedBoard, version: updatedVersion } = operationsManager.getBoardState();
        boardData = updatedBoard;

        try {
            await saveBoardData(updatedBoard);
        } catch (err) {
            console.error('Erreur lors de la sauvegarde:', err);
        }

        ack({ success: true, version: updatedVersion, diff: result.diff, rebased: result.rebased });

        if (result.rebased || !result.diff) {
            socket.broadcast.emit("boardSync", { boardData: updatedBoard, version: updatedVersion });
        } else {
            socket.broadcast.emit("boardSync", { diff: result.diff, version: updatedVersion, sourceOperationId: operation.id });
        }
    });

    socket.on("requestBoardState", () => {
        const { boardData: syncedBoard, version: syncedVersion } = operationsManager.getBoardState();
        socket.emit("boardSync", { boardData: syncedBoard, version: syncedVersion });
    });

    socket.on("disconnect", () => {
        console.log("🔌 Connexion Trello fermée");
    });
});

// Static frontend
app.use(express.static(path.join(__dirname, "LSPD")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "LSPD", "connect.html"));
});

// Route pour accéder au Trello
app.get("/trello", (req, res) => {
  res.sendFile(path.join(__dirname, "LSPD", "trello", "index.html"));
});

// Start server
async function startServer() {
  // Initialiser la base de données Trello
  await initTrelloDatabase();

  // Charger les données initiales Trello
  try {
    boardData = await loadBoardData();
  } catch (err) {
    console.error('Erreur lors du chargement initial Trello:', err);
  }

    operationsManager.loadBoardState(boardData);
    boardData = operationsManager.getBoardState().boardData;

  httpServer.listen(port, () => {
    console.clear();
    console.log(`🚀 Serveur LSPD + Trello démarré sur http://localhost:${port}/connect.html`);
    if (useDatabase) {
      console.log('📊 Mode PostgreSQL Trello activé');
    } else {
      console.log('💾 Mode mémoire locale Trello');
    }
    console.log(`🔗 Trello URL : http://localhost:${port}/trello/`);
  });
}

startServer();

// Gestion gracieuse de l'arrêt
process.on('SIGINT', async () => {
  console.log('🛑 Arrêt du serveur...');
  if (useDatabase && pool) {
    await pool.end();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Arrêt du serveur...');
  if (useDatabase && pool) {
    await pool.end();
  }
  process.exit(0);
});

startOvertimeScheduler();
