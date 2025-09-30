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

const { Pool } = pkg;
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const port = process.env.PORT || 3001;

// Configuration Trello Board avec PostgreSQL
let useDatabase = !!process.env.DATABASE_URL;
let boardData = { lists: [] };

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

// Fonctions pour le Trello Board
async function testTrelloConnection() {
  if (!useDatabase) return false;

  let retries = 3;
  while (retries > 0) {
    try {
      const client = await pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log('✅ Connexion PostgreSQL Trello réussie');
      return true;
    } catch (err) {
      console.error(`❌ Erreur de connexion PostgreSQL Trello (${retries} tentatives restantes):`, err.message);
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  console.warn('Basculement Trello en mode mémoire locale après échec de connexion');
  useDatabase = false;
  return false;
}

async function initTrelloDatabase() {
  if (!useDatabase) return;

  const connected = await testTrelloConnection();
  if (!connected) return;

  try {
    const client = await pool.connect();

    await client.query(`
            CREATE TABLE IF NOT EXISTS trello_boards (
                id SERIAL PRIMARY KEY,
                data JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

    const result = await client.query('SELECT COUNT(*) FROM trello_boards');
    if (parseInt(result.rows[0].count) === 0) {
      await client.query(
        'INSERT INTO trello_boards (data) VALUES ($1)',
        [JSON.stringify({ lists: [] })]
      );
      console.log('✅ Board Trello par défaut créé');
    }

    client.release();
    console.log('✅ Base de données Trello initialisée');
  } catch (err) {
    console.error('❌ Erreur lors de l\'initialisation de la base de données Trello:', err);
    console.warn('Basculement Trello en mode mémoire locale');
    useDatabase = false;
  }
}

async function loadBoardData() {
  if (!useDatabase) {
    return boardData;
  }

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT data FROM trello_boards ORDER BY id LIMIT 1');
    client.release();

    if (result.rows.length > 0) {
      console.log('📊 Données Trello chargées depuis PostgreSQL');
      return result.rows[0].data;
    }

    return { lists: [] };
  } catch (err) {
    console.error('❌ Erreur lors du chargement des données Trello:', err);
    return boardData;
  }
}

async function saveBoardData(newBoardData) {
  boardData = newBoardData;

  if (!useDatabase) return;

  try {
    const client = await pool.connect();
    await client.query(
      'UPDATE trello_boards SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT MIN(id) FROM trello_boards)',
      [JSON.stringify(newBoardData)]
    );
    client.release();
    console.log('💾 Données Trello sauvegardées en base PostgreSQL');
  } catch (err) {
    console.error('❌ Erreur lors de la sauvegarde Trello:', err);
  }
}

// Middleware session
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // false pour HTTP en développement
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 // 24 heures
    }
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
    // Générer un ID unique pour cette redirection
    const redirectId = require('crypto').randomUUID();
    // Stocker l'URL originale avec l'ID
    if (!global.pendingRedirects) global.pendingRedirects = new Map();
    global.pendingRedirects.set(redirectId, req.originalUrl);
    console.log(`🛡️ Auth guard: stockage returnTo = ${req.originalUrl} avec ID=${redirectId}`);
    return res.redirect(`/login?redirect=${redirectId}`);
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

// Socket.IO pour Trello
io.on("connection", async (socket) => {
  console.log("🔌 Nouvelle connexion Trello");

  try {
    boardData = await loadBoardData();
  } catch (err) {
    console.error('Erreur lors du chargement initial Trello:', err);
  }

  socket.emit("boardSync", boardData);

  socket.on("boardUpdate", async (data) => {
    boardData = data;

    try {
      await saveBoardData(boardData);
    } catch (err) {
      console.error('Erreur lors de la sauvegarde Trello:', err);
    }

    socket.broadcast.emit("boardSync", boardData);
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
  // Charger la configuration LSPD
  const { loadConfig } = require("./config/config");
  await loadConfig();

  // Initialiser la base de données Trello
  await initTrelloDatabase();

  // Charger les données initiales Trello
  try {
    boardData = await loadBoardData();
  } catch (err) {
    console.error('Erreur lors du chargement initial Trello:', err);
  }

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
