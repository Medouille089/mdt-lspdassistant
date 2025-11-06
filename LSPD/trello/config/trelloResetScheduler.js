const { DateTime } = require('luxon');
const {
    operationsManager,
    applyServerOperation,
    createServerOperation
} = require('./trelloSocket');
const { logTrelloReset } = require('../utils/trelloLogsDB');

const RESET_ENABLED = 'true';
const RESET_TIME = '04:00';
const RESET_TIMEZONE = 'Europe/Paris';
const PATROL_LIST_PATTERNS = ['patrouille', 'patrol', 'quart', 'shift', '10-'].map((pattern) => new RegExp(pattern, 'i'));
const PATROL_CARD_REGEX = /\bpatrouille\b|\d+\s*\+\s*\d+/i;
const AGENT_CARD_REGEX = /^\d{1,4}(\s*\|.*)?$/;

let lastRunKey = null;
let schedulerHandle = null;

function parseResetTime(timeString) {
    const match = /^\s*(\d{1,2})\s*:\s*(\d{2})\s*$/.exec(timeString || '');
    if (!match) {
        return { hour: 3, minute: 0 };
    }
    const hour = Math.min(Math.max(parseInt(match[1], 10) || 0, 0), 23);
    const minute = Math.min(Math.max(parseInt(match[2], 10) || 0, 0), 59);
    return { hour, minute };
}

function matchAny(patterns, value = '') {
    return patterns.some((regex) => regex.test(value));
}

function findEffectifList(lists) {
    if (!Array.isArray(lists)) return null;

    const overrideName = process.env.TRELLO_EFFECTIF_LIST_NAME;
    if (overrideName) {
        const found = lists.find((list) => list?.title?.toLowerCase() === overrideName.toLowerCase());
        if (found) return found;
    }

    return lists.find((list) => list?.title && list.title.toLowerCase().includes('effectif')) || null;
}

function isPatrolList(list) {
    const title = list?.title || '';
    return matchAny(PATROL_LIST_PATTERNS, title);
}

function isPatrolCard(card, list) {
    const text = (card?.text || '').trim();
    if (!text) return false;
    if (PATROL_CARD_REGEX.test(text)) return true;
    const lower = text.toLowerCase();
    if (lower.includes('patrouille')) return true;

    if (!isPatrolList(list)) {
        return false;
    }

    const hasPlus = text.includes('+');
    const numericMatches = text.match(/\d+/g) || [];

    return hasPlus || numericMatches.length >= 2;
}

function isAgentCard(card) {
    if (!card || card.type === 'image' || card.isCompact) return false;
    const text = (card.text || '').trim();
    if (!text) return false;
    if (text.includes('+')) return false;
    return AGENT_CARD_REGEX.test(text);
}

function getBoardSnapshot() {
    const { boardData } = operationsManager.getBoardState();
    return boardData || { lists: [], tags: [] };
}

async function planNightlyOperations() {
    const board = getBoardSnapshot();
    const lists = Array.isArray(board.lists) ? board.lists : [];
    const effectifList = findEffectifList(lists);

    if (!effectifList) {
        console.warn('[TRELLO RESET] Impossible de trouver la liste "Effectifs". Reset annulé.');
        return [];
    }

    const operations = [];
    const effectifListId = effectifList.id;

    const movedAgents = [];

    for (const list of lists) {
        if (!list?.id || !Array.isArray(list.cards)) continue;

        for (const card of list.cards) {
            if (!card?.id) continue;

            if (list.id !== effectifListId && isAgentCard(card)) {
                operations.push({
                    type: 'MOVE_CARD',
                    data: {
                        cardId: card.id,
                        fromListId: list.id,
                        toListId: effectifListId,
                        targetIndex: Number.MAX_SAFE_INTEGER
                    }
                });
                movedAgents.push(card);
                continue;
            }

            if (isPatrolCard(card, list)) {
                operations.push({
                    type: 'DELETE_CARD',
                    data: {
                        listId: list.id,
                        cardId: card.id
                    }
                });
            }
        }
    }

    if (movedAgents.length > 0) {
        const effectifCards = effectifList.cards
            .filter((card) => card && card.id)
            .concat(movedAgents);

        const sortValue = (card) => (card?.text || '').trim();

        const uniqueCards = new Map();
        effectifCards.forEach((card) => {
            if (!card?.id) return;
            uniqueCards.set(card.id, card);
        });

        const sortedCards = Array.from(uniqueCards.values()).sort((a, b) => {
            const nameA = sortValue(a);
            const nameB = sortValue(b);
            return nameA.localeCompare(nameB, undefined, {
                numeric: true,
                sensitivity: 'base'
            });
        });

        const orderedCardIds = sortedCards.map((card) => card.id);

        operations.push({
            type: 'SET_CARD_ORDER',
            data: {
                listId: effectifListId,
                orderedCardIds
            }
        });
    }

    return operations;
}

async function executeOperations(operations) {
    for (const op of operations) {
        const operation = createServerOperation(op.type, op.data);
        const result = await applyServerOperation(operation);
        if (!result.success) {
            console.warn(`[TRELLO RESET] Opération ${op.type} échouée: ${result.error}`);
        }
    }
}

async function runNightlyReset() {
    const operations = await planNightlyOperations();
    if (!operations.length) {
        console.info('[TRELLO RESET] Aucune opération à exécuter.');
        return;
    }

    console.info(`[TRELLO RESET] Exécution de ${operations.length} opérations automatiques.`);
    await executeOperations(operations);
    console.info('[TRELLO RESET] Reset terminé.');
    
    // Envoyer le log Discord
    await logTrelloReset();
}

function shouldRunReset(now, schedule) {
    if (now.hour !== schedule.hour || now.minute !== schedule.minute) {
        return false;
    }
    const currentKey = now.toISODate();
    if (lastRunKey === currentKey) {
        return false;
    }
    lastRunKey = currentKey;
    return true;
}

function startNightlyResetScheduler() {
    if (!RESET_ENABLED) {
        console.info('[TRELLO RESET] Scheduler désactivé.');
        return;
    }

    const schedule = parseResetTime(RESET_TIME);
    console.info(`[TRELLO RESET] Scheduler actif : ${schedule.hour.toString().padStart(2, '0')}:${schedule.minute.toString().padStart(2, '0')} (${RESET_TIMEZONE}).`);

    if (schedulerHandle) {
        clearInterval(schedulerHandle);
    }

    schedulerHandle = setInterval(async () => {
        const now = DateTime.now().setZone(RESET_TIMEZONE);
        if (shouldRunReset(now, schedule)) {
            try {
                await runNightlyReset();
            } catch (error) {
                console.error('[TRELLO RESET] Erreur lors du reset automatique:', error);
            }
        }
    }, 60 * 1000);
}

module.exports = {
    startNightlyResetScheduler,
    runNightlyReset,
    planNightlyOperations,
    isPatrolCard,
    isAgentCard
};
