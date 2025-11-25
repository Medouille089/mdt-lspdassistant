const DEFAULT_BOARD_ID = 'default-board';

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

async function ensureNormalizedSchema(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS trello_boards (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'Board',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS trello_lists (
            id TEXT PRIMARY KEY,
            board_id TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            position INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (board_id) REFERENCES trello_boards(id) ON DELETE CASCADE
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS trello_tags (
            id TEXT PRIMARY KEY,
            board_id TEXT NOT NULL,
            label TEXT NOT NULL,
            color TEXT NOT NULL,
            text_color TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (board_id) REFERENCES trello_boards(id) ON DELETE CASCADE
        )
    `);

    // Nettoyer les anciennes données orphelines avant d'appliquer les contraintes FK
    await cleanupOrphanData(client);

    await client.query(`
        CREATE TABLE IF NOT EXISTS trello_cards (
            id TEXT PRIMARY KEY,
            board_id TEXT NOT NULL,
            list_id TEXT NOT NULL,
            position INTEGER NOT NULL DEFAULT 0,
            text TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            type TEXT NOT NULL DEFAULT 'text',
            image JSON,
            metadata JSON NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (board_id) REFERENCES trello_boards(id) ON DELETE CASCADE,
            FOREIGN KEY (list_id) REFERENCES trello_lists(id) ON DELETE CASCADE
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS trello_card_tags (
            card_id TEXT NOT NULL,
            tag_id TEXT NOT NULL,
            position INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (card_id, tag_id),
            FOREIGN KEY (card_id) REFERENCES trello_cards(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES trello_tags(id) ON DELETE CASCADE
        )
    `);
}

async function cleanupOrphanData(client) {
    // Supprimer les cartes qui référencent des listes inexistantes
    try {
        await client.query(`
            DELETE FROM trello_cards
            WHERE list_id NOT IN (SELECT id FROM trello_lists)
        `);
    } catch (err) {
        if (err.errno !== 1146) { // Table doesn't exist
            throw err;
        }
    }

    // Supprimer les associations carte/tag orphelines
    try {
        await client.query(`
            DELETE FROM trello_card_tags
            WHERE tag_id NOT IN (SELECT id FROM trello_tags)
                OR card_id NOT IN (SELECT id FROM trello_cards)
        `);
    } catch (err) {
        if (err.errno !== 1146) { // Table doesn't exist
            throw err;
        }
    }
}

async function ensureDefaultBoard(client, boardId = DEFAULT_BOARD_ID) {
    await client.query(`
        INSERT INTO trello_boards (id, title)
        VALUES (?, 'Board principal')
        ON DUPLICATE KEY UPDATE id = id
    `, [boardId]);
}

async function persistBoard(client, normalized, boardId = DEFAULT_BOARD_ID) {
    await ensureDefaultBoard(client, boardId);

    const tags = normalized.tags || [];
    const tagIds = tags.filter((tag) => tag && tag.id).map((tag) => tag.id);

    // Supprimer les tags qui ne sont plus présents
    if (tagIds.length > 0) {
        await client.query(`
            DELETE FROM trello_tags
            WHERE board_id = ?
              AND id NOT IN (?)
        `, [boardId, tagIds]);
    } else {
        await client.query(`
            DELETE FROM trello_tags
            WHERE board_id = ?
        `, [boardId]);
    }

    for (let index = 0; index < tags.length; index++) {
        const tag = tags[index];
        if (!tag?.id) continue;

        await client.query(`
            INSERT INTO trello_tags (id, board_id, label, color, text_color, position, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                board_id = VALUES(board_id),
                label = VALUES(label),
                color = VALUES(color),
                text_color = VALUES(text_color),
                position = VALUES(position),
                updated_at = NOW()
        `, [
            tag.id,
            boardId,
            tag.label || '',
            tag.color || '#63666b',
            tag.textColor || null,
            index
        ]);
    }

    const lists = normalized.lists || [];
    const listIds = lists.filter((list) => list && list.id).map((list) => list.id);

    // Supprimer les listes qui ne sont plus présentes
    if (listIds.length > 0) {
        await client.query(`
            DELETE FROM trello_lists
            WHERE board_id = ?
              AND id NOT IN (?)
        `, [boardId, listIds]);
    } else {
        await client.query(`
            DELETE FROM trello_lists
            WHERE board_id = ?
        `, [boardId]);
    }

    for (let index = 0; index < lists.length; index++) {
        const list = lists[index];
        if (!list?.id) continue;

        await client.query(`
            INSERT INTO trello_lists (id, board_id, title, position, updated_at)
            VALUES (?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                board_id = VALUES(board_id),
                title = VALUES(title),
                position = VALUES(position),
                updated_at = NOW()
        `, [
            list.id,
            boardId,
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

    // Supprimer les cartes qui ne sont plus présentes
    if (cardIds.length > 0) {
        await client.query(`
            DELETE FROM trello_cards
            WHERE board_id = ?
              AND id NOT IN (?)
        `, [boardId, cardIds]);
    } else {
        await client.query(`
            DELETE FROM trello_cards
            WHERE board_id = ?
        `, [boardId]);
    }

    const validTagIds = new Set(tagIds);

    for (const { listId, position, data } of cards) {
        if (!data.id) continue;

        const imagePayload = (data.image && typeof data.image === 'object') ? JSON.stringify(data.image) : null;
        const metadataPayload = JSON.stringify(data.metadata || {});

        await client.query(`
            INSERT INTO trello_cards (id, board_id, list_id, position, text, description, type, image, metadata, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                board_id = VALUES(board_id),
                list_id = VALUES(list_id),
                position = VALUES(position),
                text = VALUES(text),
                description = VALUES(description),
                type = VALUES(type),
                image = VALUES(image),
                metadata = VALUES(metadata),
                updated_at = NOW()
        `, [
            data.id,
            boardId,
            listId,
            position,
            data.text,
            data.description,
            data.type,
            imagePayload,
            metadataPayload
        ]);

        await client.query('DELETE FROM trello_card_tags WHERE card_id = ?', [data.id]);

        for (let tagIndex = 0; tagIndex < data.tags.length; tagIndex++) {
            const tagId = data.tags[tagIndex];
            if (!validTagIds.has(tagId)) continue;

            await client.query(`
                INSERT INTO trello_card_tags (card_id, tag_id, position)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE position = VALUES(position)
            `, [data.id, tagId, tagIndex]);
        }
    }

    await client.query('UPDATE trello_boards SET updated_at = NOW() WHERE id = ?', [boardId]);
}

module.exports = {
    DEFAULT_BOARD_ID,
    normalizeBoardPayload,
    ensureNormalizedSchema,
    ensureDefaultBoard,
    persistBoard
};
