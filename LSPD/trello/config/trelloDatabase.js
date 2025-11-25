// LSPD/trello/trelloDatabase.js
const mysql = require("mysql2/promise");

const DEFAULT_BOARD_ID = 'default-board';

let pool = null;
let useDatabase = !!process.env.DATABASE_URL;
let boardData = { lists: [], tags: [] };

// Parse MySQL connection string
function parseConnectionString(url) {
    const match = url.match(/^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
    if (!match) throw new Error('Invalid MySQL connection string');
    return {
        host: match[3],
        port: parseInt(match[4], 10),
        user: match[1],
        password: match[2],
        database: match[5]
    };
}

async function initDatabase() {
    if (!useDatabase) {
        console.warn('⚠️ DATABASE_URL non défini, mode mémoire locale Trello');
        return;
    }

    pool = mysql.createPool(parseConnectionString(process.env.DATABASE_URL));

    pool.on('error', (err) => {
        console.error('Erreur MySQL:', err);
    });

    await ensureSchema();
    await ensureDefaultBoard();
}

async function ensureSchema() {
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS trello_boards (
        id VARCHAR(255) PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'Board',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS trello_lists (
        id VARCHAR(255) PRIMARY KEY,
        board_id VARCHAR(255) NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        position INT NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (board_id) REFERENCES trello_boards(id) ON DELETE CASCADE
      )
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS trello_tags (
        id VARCHAR(255) PRIMARY KEY,
        board_id VARCHAR(255) NOT NULL,
        label TEXT NOT NULL,
        color TEXT NOT NULL,
        text_color TEXT,
        position INT NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (board_id) REFERENCES trello_boards(id) ON DELETE CASCADE
      )
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS trello_cards (
        id VARCHAR(255) PRIMARY KEY,
        board_id VARCHAR(255) NOT NULL,
        list_id VARCHAR(255) NOT NULL,
        position INT NOT NULL DEFAULT 0,
        text TEXT NOT NULL,
        description TEXT NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'text',
        image JSON,
        metadata JSON NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (board_id) REFERENCES trello_boards(id) ON DELETE CASCADE,
        FOREIGN KEY (list_id) REFERENCES trello_lists(id) ON DELETE CASCADE
      )
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS trello_card_tags (
        card_id VARCHAR(255) NOT NULL,
        tag_id VARCHAR(255) NOT NULL,
        position INT NOT NULL DEFAULT 0,
        PRIMARY KEY (card_id, tag_id),
        FOREIGN KEY (card_id) REFERENCES trello_cards(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES trello_tags(id) ON DELETE CASCADE
      )
    `);
    } catch (err) {
        console.error('Erreur ensureSchema:', err);
    }
}

async function ensureDefaultBoard() {
    try {
        await pool.query(`
      INSERT INTO trello_boards (id, title)
      VALUES (?, 'Board principal')
      ON DUPLICATE KEY UPDATE id = id
    `, [DEFAULT_BOARD_ID]);
    } catch (err) {
        console.error('Erreur ensureDefaultBoard:', err);
    }
}

async function loadBoardData() {
    if (!useDatabase || !pool) return boardData;

    try {
        const [lists] = await pool.query(`SELECT * FROM trello_lists WHERE board_id = ? ORDER BY position`, [DEFAULT_BOARD_ID]);
        const [tags] = await pool.query(`SELECT * FROM trello_tags WHERE board_id = ? ORDER BY position`, [DEFAULT_BOARD_ID]);
        const [cards] = await pool.query(`SELECT * FROM trello_cards WHERE board_id = ? ORDER BY position`, [DEFAULT_BOARD_ID]);
        const [cardTags] = await pool.query(`SELECT * FROM trello_card_tags ORDER BY position`);

        const listMap = new Map();
        lists.forEach(l => listMap.set(l.id, { ...l, cards: [] }));

        // Map des tags par carte
        const tagsPerCard = new Map();
        cardTags.forEach(ct => {
            if (!tagsPerCard.has(ct.card_id)) tagsPerCard.set(ct.card_id, []);
            tagsPerCard.get(ct.card_id).push(ct.tag_id);
        });

        for (const c of cards) {
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
            tags: tags,
        };
        return boardData;
    } catch (err) {
        console.error('Erreur loadBoardData:', err);
        return boardData;
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

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Sauvegarder les tags
        const tags = data.tags || [];
        const tagIds = tags.filter(t => t?.id).map(t => t.id);

        if (tagIds.length > 0) {
            await connection.query(`
      DELETE FROM trello_tags
      WHERE board_id = ? AND id NOT IN (?)
    `, [DEFAULT_BOARD_ID, tagIds]);
        } else {
            await connection.query(`DELETE FROM trello_tags WHERE board_id = ?`, [DEFAULT_BOARD_ID]);
        }

        for (let index = 0; index < tags.length; index++) {
            const tag = tags[index];
            if (!tag?.id) continue;

            await connection.query(`
        INSERT INTO trello_tags (id, board_id, label, color, text_color, position, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          label = VALUES(label),
          color = VALUES(color),
          text_color = VALUES(text_color),
          position = VALUES(position),
          updated_at = NOW()
      `, [tag.id, DEFAULT_BOARD_ID, tag.label || '', tag.color || '#63666b', tag.textColor || null, index]);
        }

        // Sauvegarder les listes
        const lists = data.lists || [];
        const listIds = lists.filter(l => l?.id).map(l => l.id);

        if (listIds.length > 0) {
            await connection.query(`
      DELETE FROM trello_lists
      WHERE board_id = ? AND id NOT IN (?)
    `, [DEFAULT_BOARD_ID, listIds]);
        } else {
            await connection.query(`DELETE FROM trello_lists WHERE board_id = ?`, [DEFAULT_BOARD_ID]);
        }

        for (let index = 0; index < lists.length; index++) {
            const list = lists[index];
            if (!list?.id) continue;

            await connection.query(`
        INSERT INTO trello_lists (id, board_id, title, position, updated_at)
        VALUES (?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          position = VALUES(position),
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

        if (cardIds.length > 0) {
            await connection.query(`
      DELETE FROM trello_cards
      WHERE board_id = ? AND id NOT IN (?)
    `, [DEFAULT_BOARD_ID, cardIds]);
        } else {
            await connection.query(`DELETE FROM trello_cards WHERE board_id = ?`, [DEFAULT_BOARD_ID]);
        }

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

            await connection.query(`
        INSERT INTO trello_cards (id, board_id, list_id, position, text, description, type, image, metadata, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          list_id = VALUES(list_id),
          position = VALUES(position),
          text = VALUES(text),
          description = VALUES(description),
          type = VALUES(type),
          image = VALUES(image),
          metadata = VALUES(metadata),
          updated_at = VALUES(updated_at)
      `, [
                card.id,
                DEFAULT_BOARD_ID,
                card.list_id,
                card.position,
                card.text || '',
                card.description || '',
                card.type || 'text',
                JSON.stringify(imagePayload),
                JSON.stringify(finalMetadata),
                cardUpdatedAt // ← Utiliser le timestamp de la carte en mémoire
            ]);

            // Sauvegarder les tags de la carte
            await connection.query('DELETE FROM trello_card_tags WHERE card_id = ?', [card.id]);

            const cardTags = Array.isArray(card.tags) ? card.tags : [];
            for (let tagIndex = 0; tagIndex < cardTags.length; tagIndex++) {
                const tagId = cardTags[tagIndex];
                if (!validTagIds.has(tagId)) continue;

                await connection.query(`
          INSERT INTO trello_card_tags (card_id, tag_id, position)
          VALUES (?, ?, ?)
        `, [card.id, tagId, tagIndex]);
            }
        }

        await connection.query('UPDATE trello_boards SET updated_at = NOW() WHERE id = ?', [DEFAULT_BOARD_ID]);
        await connection.commit();

    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
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
