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

    // Nettoyer les anciennes données orphelines avant d'appliquer les contraintes FK
    await cleanupOrphanData(client);

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

async function cleanupOrphanData(client) {
    // Supprimer les cartes qui référencent des listes inexistantes
    try {
        await client.query(`
            DELETE FROM trello_cards
            WHERE list_id NOT IN (SELECT id FROM trello_lists)
        `);
    } catch (err) {
        if (err.code !== '42P01') {
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
        if (err.code !== '42P01') {
            throw err;
        }
    }
}

async function ensureDefaultBoard(client, boardId = DEFAULT_BOARD_ID) {
    await client.query(`
        INSERT INTO trello_boards (id, title)
        VALUES ($1, 'Board principal')
        ON CONFLICT (id) DO NOTHING
    `, [boardId]);
}

async function persistBoard(client, normalized, boardId = DEFAULT_BOARD_ID) {
    await ensureDefaultBoard(client, boardId);

    const tags = normalized.tags || [];
    const tagIds = tags.filter((tag) => tag && tag.id).map((tag) => tag.id);

    await client.query(`
        DELETE FROM trello_tags
        WHERE board_id = $1
          AND NOT (id = ANY($2::text[]))
    `, [boardId, tagIds]);

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
            boardId,
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
    `, [boardId, listIds]);

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

    await client.query(`
        DELETE FROM trello_cards
        WHERE board_id = $1
          AND NOT (id = ANY($2::text[]))
    `, [boardId, cardIds]);

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
            boardId,
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

        await client.query('UPDATE trello_boards SET updated_at = NOW() WHERE id = $1', [boardId]);
}

module.exports = {
    DEFAULT_BOARD_ID,
    normalizeBoardPayload,
    ensureNormalizedSchema,
    ensureDefaultBoard,
    persistBoard
};
