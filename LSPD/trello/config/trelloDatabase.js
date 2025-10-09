// LSPD/trello/trelloDatabase.js
const pkg = require("pg");
const { Pool } = pkg;

const DEFAULT_BOARD_ID = 'default-board';

let pool = null;
let useDatabase = !!process.env.DATABASE_URL;
let boardData = { lists: [], tags: [] };

async function initDatabase() {
    if (!useDatabase) {
        console.warn('⚠️ DATABASE_URL non défini, mode mémoire locale Trello');
        return;
    }

    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
        console.error('Erreur PostgreSQL:', err);
    });

    await ensureSchema();
    await ensureDefaultBoard();
}

async function ensureSchema() {
    const client = await pool.connect();
    try {
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
    } finally {
        client.release();
    }
}

async function ensureDefaultBoard() {
    const client = await pool.connect();
    try {
        await client.query(`
      INSERT INTO trello_boards (id, title)
      VALUES ($1, 'Board principal')
      ON CONFLICT (id) DO NOTHING
    `, [DEFAULT_BOARD_ID]);
    } finally {
        client.release();
    }
}

async function loadBoardData() {
    if (!useDatabase || !pool) return boardData;

    const client = await pool.connect();
    try {
        const lists = await client.query(`SELECT * FROM trello_lists WHERE board_id = $1 ORDER BY position`, [DEFAULT_BOARD_ID]);
        const tags = await client.query(`SELECT * FROM trello_tags WHERE board_id = $1 ORDER BY position`, [DEFAULT_BOARD_ID]);
        const cards = await client.query(`SELECT * FROM trello_cards WHERE board_id = $1 ORDER BY position`, [DEFAULT_BOARD_ID]);
        const cardTags = await client.query(`SELECT * FROM trello_card_tags ORDER BY position`);

        const listMap = new Map();
        lists.rows.forEach(l => listMap.set(l.id, { ...l, cards: [] }));

        // Map des tags par carte
        const tagsPerCard = new Map();
        cardTags.rows.forEach(ct => {
            if (!tagsPerCard.has(ct.card_id)) tagsPerCard.set(ct.card_id, []);
            tagsPerCard.get(ct.card_id).push(ct.tag_id);
        });

        for (const c of cards.rows) {
            // Extraire les métadonnées au niveau racine pour compatibilité client
            const metadata = c.metadata || {};
            const cardWithTags = {
                id: c.id,
                text: c.text,
                description: c.description,
                type: c.type,
                image: c.image,
                tags: tagsPerCard.get(c.id) || [],
                updated_at: c.updated_at,
                // Propriétés métadonnées extraites
                ...metadata,
                // Assurer que les propriétés compactes sont présentes
                isCompact: metadata.isCompact || false,
                compactText: metadata.compactText || null,
                compactColor: metadata.compactColor || null
            };
            if (listMap.has(c.list_id)) {
                listMap.get(c.list_id).cards.push(cardWithTags);
            }
        }

        boardData = {
            lists: Array.from(listMap.values()),
            tags: tags.rows,
        };
        return boardData;
    } finally {
        client.release();
    }
}

// File d'attente pour throttler les sauvegardes
let saveQueue = Promise.resolve();
let pendingSave = null;
let saveTimeout = null;

async function saveBoardData(data) {
    boardData = data;

    if (!useDatabase || !pool) return;

    // Annuler le timer précédent
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }

    // Stocker la dernière version à sauvegarder
    pendingSave = data;

    // Debounce: attendre 500ms avant de sauvegarder
    saveTimeout = setTimeout(async () => {
        const dataToSave = pendingSave;
        pendingSave = null;

        // Ajouter à la file d'attente
        saveQueue = saveQueue.then(async () => {
            try {
                await persistBoardToDatabase(dataToSave);
            } catch (err) {
                console.error('❌ Erreur sauvegarde board:', err.message);
            }
        });
    }, 500);
}

async function persistBoardToDatabase(data) {
    if (!pool) return;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Sauvegarder les tags
        const tags = data.tags || [];
        const tagIds = tags.filter(t => t?.id).map(t => t.id);

        await client.query(`
      DELETE FROM trello_tags
      WHERE board_id = $1 AND NOT (id = ANY($2::text[]))
    `, [DEFAULT_BOARD_ID, tagIds]);

        for (let index = 0; index < tags.length; index++) {
            const tag = tags[index];
            if (!tag?.id) continue;

            await client.query(`
        INSERT INTO trello_tags (id, board_id, label, color, text_color, position, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (id) DO UPDATE SET
          label = EXCLUDED.label,
          color = EXCLUDED.color,
          text_color = EXCLUDED.text_color,
          position = EXCLUDED.position,
          updated_at = NOW()
      `, [tag.id, DEFAULT_BOARD_ID, tag.label || '', tag.color || '#63666b', tag.textColor || null, index]);
        }

        // Sauvegarder les listes
        const lists = data.lists || [];
        const listIds = lists.filter(l => l?.id).map(l => l.id);

        await client.query(`
      DELETE FROM trello_lists
      WHERE board_id = $1 AND NOT (id = ANY($2::text[]))
    `, [DEFAULT_BOARD_ID, listIds]);

        for (let index = 0; index < lists.length; index++) {
            const list = lists[index];
            if (!list?.id) continue;

            await client.query(`
        INSERT INTO trello_lists (id, board_id, title, position, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          position = EXCLUDED.position,
          updated_at = NOW()
      `, [list.id, DEFAULT_BOARD_ID, list.title || '', index]);
        }

        // Sauvegarder les cartes
        const allCards = [];
        lists.forEach(list => {
            if (!list?.id) return;
            const cards = Array.isArray(list.cards) ? list.cards : [];
            cards.forEach((card, idx) => {
                if (card?.id) {
                    allCards.push({ ...card, list_id: list.id, position: idx });
                }
            });
        });

        const cardIds = allCards.map(c => c.id).filter(Boolean);

        await client.query(`
      DELETE FROM trello_cards
      WHERE board_id = $1 AND NOT (id = ANY($2::text[]))
    `, [DEFAULT_BOARD_ID, cardIds]);

        const validTagIds = new Set(tagIds);

        for (const card of allCards) {
            const imagePayload = (card.image && typeof card.image === 'object') ? card.image : null;

            // Extraire les propriétés standards vs métadonnées
            const standardProps = ['id', 'text', 'description', 'type', 'image', 'tags', 'list_id', 'position', 'updated_at'];
            const metadata = {};

            // Collecter toutes les propriétés personnalisées dans metadata
            Object.keys(card).forEach(key => {
                if (!standardProps.includes(key) && key !== 'metadata') {
                    metadata[key] = card[key];
                }
            });

            // Fusionner avec metadata existant
            const finalMetadata = { ...metadata, ...(card.metadata || {}) };
            
            // Utiliser le updated_at de la carte, ou NOW() si absent
            const cardUpdatedAt = card.updated_at || new Date().toISOString();

            await client.query(`
        INSERT INTO trello_cards (id, board_id, list_id, position, text, description, type, image, metadata, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          list_id = EXCLUDED.list_id,
          position = EXCLUDED.position,
          text = EXCLUDED.text,
          description = EXCLUDED.description,
          type = EXCLUDED.type,
          image = EXCLUDED.image,
          metadata = EXCLUDED.metadata,
          updated_at = EXCLUDED.updated_at
      `, [
                card.id,
                DEFAULT_BOARD_ID,
                card.list_id,
                card.position,
                card.text || '',
                card.description || '',
                card.type || 'text',
                imagePayload,
                finalMetadata,
                cardUpdatedAt // ← Utiliser le timestamp de la carte en mémoire
            ]);

            // Sauvegarder les tags de la carte
            await client.query('DELETE FROM trello_card_tags WHERE card_id = $1', [card.id]);

            const cardTags = Array.isArray(card.tags) ? card.tags : [];
            for (let tagIndex = 0; tagIndex < cardTags.length; tagIndex++) {
                const tagId = cardTags[tagIndex];
                if (!validTagIds.has(tagId)) continue;

                await client.query(`
          INSERT INTO trello_card_tags (card_id, tag_id, position)
          VALUES ($1, $2, $3)
        `, [card.id, tagId, tagIndex]);
            }
        }

        await client.query('UPDATE trello_boards SET updated_at = NOW() WHERE id = $1', [DEFAULT_BOARD_ID]);
        await client.query('COMMIT');

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    initDatabase,
    loadBoardData,
    saveBoardData,
    flushPendingSave: async () => {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
            if (pendingSave) {
                await persistBoardToDatabase(pendingSave);
                pendingSave = null;
            }
        }
        return saveQueue;
    },
    DEFAULT_BOARD_ID,
    getPool: () => pool,
    isDatabaseEnabled: () => useDatabase,
    disableDatabase: () => (useDatabase = false),
};
