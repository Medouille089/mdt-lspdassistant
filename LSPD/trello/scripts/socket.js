import { setBoardData, setIsLocalUpdate, boardData, isLocalUpdate, activeCardCreations, currentCard, currentListId, scrollState, boardVersion, setBoardVersion, setCurrentCard, setCurrentListId } from './state.js';
import { renderBoard, updateSingleCardDOM } from './board.js';
import { syncTagsFromBoardData } from './tags.js';
import { captureScrollState, generateId } from './utils.js';
import { markPatrolAsDeleted } from '../routes/rookiePatrolsAPI.js';

export const socket = io();

let syncTimeout;

const clampPosition = (position, length) => {
    if (!Number.isInteger(position)) return length;
    return Math.max(0, Math.min(position, length));
};

const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));
const sanitizeCard = (card) => {
    const copy = clone(card) || { id: '' };
    copy.text = copy.text ?? '';
    copy.description = copy.description ?? '';
    copy.type = copy.type || 'text';
    copy.tags = Array.isArray(copy.tags) ? copy.tags.filter(Boolean) : [];
    return copy;
};
const sanitizeList = (list) => ({
    id: list?.id,
    title: list?.title || '',
    cards: Array.isArray(list?.cards) ? list.cards.map(sanitizeCard) : []
});
const sanitizeTag = (tag) => ({
    id: tag?.id,
    label: tag?.label || '',
    color: tag?.color || '#63666b',
    textColor: tag?.textColor ?? null
});

function refreshCurrentSelection() {
    if (!currentCard || !currentListId) return;
    const list = boardData.lists.find((l) => l.id === currentListId);
    const card = list?.cards.find((c) => c.id === currentCard.id);
    if (card) {
        setCurrentCard(card);
    } else {
        setCurrentCard(null);
        setCurrentListId(null);
        document.getElementById('cardModal')?.classList.remove('active');
    }
}

function scheduleRenderAfterSync() {
    if (isLocalUpdate && activeCardCreations.size > 0) {
        setIsLocalUpdate(false);
        renderBoard(true);
        return;
    }

    if (isLocalUpdate && currentCard && currentListId && document.getElementById('cardModal')?.classList.contains('active')) {
        setIsLocalUpdate(false);
        updateSingleCardDOM(currentCard.id, currentListId);
        return;
    }

    setIsLocalUpdate(false);
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => renderBoard(true), 100);
}

function applyBoardDiff(diff) {
    if (!diff?.type) return false;
    const { type, data } = diff;

    switch (type) {
        case 'CREATE_LIST': {
            const list = sanitizeList(data?.list);
            if (!list.id) return false;
            const idx = clampPosition(data?.position ?? boardData.lists.length, boardData.lists.length);
            const existingIdx = boardData.lists.findIndex((l) => l.id === list.id);
            if (existingIdx !== -1) {
                boardData.lists.splice(existingIdx, 1);
            }
            boardData.lists.splice(idx, 0, list);
            return true;
        }
        case 'UPDATE_LIST': {
            const updated = sanitizeList(data?.list);
            if (!updated.id) return false;
            const list = boardData.lists.find((l) => l.id === updated.id);
            if (!list) return false;
            Object.assign(list, { title: updated.title ?? list.title });
            return true;
        }
        case 'DELETE_LIST': {
            const listId = data?.listId;
            if (!listId) return false;
            const index = boardData.lists.findIndex((l) => l.id === listId);
            if (index === -1) return false;
            boardData.lists.splice(index, 1);
            return true;
        }
        case 'CREATE_CARD': {
            const list = boardData.lists.find((l) => l.id === data?.listId);
            const card = sanitizeCard(data?.card);
            if (!list || !card.id) return false;
            const existingIdx = list.cards.findIndex((c) => c.id === card.id);
            if (existingIdx !== -1) list.cards.splice(existingIdx, 1);
            const position = clampPosition(data?.position ?? list.cards.length, list.cards.length);
            list.cards.splice(position, 0, card);
            return true;
        }
        case 'UPDATE_CARD': {
            const list = boardData.lists.find((l) => l.id === data?.listId);
            const card = sanitizeCard(data?.card);
            if (!list || !card.id) return false;
            const index = list.cards.findIndex((c) => c.id === card.id);
            if (index === -1) return false;
            list.cards[index] = card;
            return true;
        }
        case 'DELETE_CARD': {
            const list = boardData.lists.find((l) => l.id === data?.listId);
            if (!list) return false;
            const index = list.cards.findIndex((c) => c.id === data?.cardId);
            if (index === -1) return false;
            
            // Vérifier si c'est une patrouille avec rookie avant suppression
            const card = list.cards[index];
            if (card?.text && card.text.includes('+')) {
                // Appel asynchrone pour marquer la patrouille comme supprimée et calculer la durée
                markPatrolAsDeleted(data.cardId).catch(err => {
                    console.error('Erreur lors de la mise à jour de l\'historique rookie:', err);
                });
            }
            
            list.cards.splice(index, 1);
            return true;
        }
        case 'MOVE_CARD': {
            const fromList = boardData.lists.find((l) => l.id === data?.fromListId);
            const toList = boardData.lists.find((l) => l.id === data?.toListId);
            if (!fromList || !toList) return false;

            let cardIndex = fromList.cards.findIndex((c) => c.id === data?.cardId);
            let card;
            if (cardIndex !== -1) {
                [card] = fromList.cards.splice(cardIndex, 1);
            } else {
                cardIndex = toList.cards.findIndex((c) => c.id === data?.cardId);
                if (cardIndex !== -1) [card] = toList.cards.splice(cardIndex, 1);
            }

            const finalCard = sanitizeCard(card || data?.card);
            if (!finalCard.id) return false;

            const targetIndex = clampPosition(data?.targetIndex ?? toList.cards.length, toList.cards.length);
            const duplicateIdx = toList.cards.findIndex((c) => c.id === finalCard.id);
            if (duplicateIdx !== -1) toList.cards.splice(duplicateIdx, 1);
            toList.cards.splice(targetIndex, 0, finalCard);
            return true;
        }
        case 'SET_CARD_ORDER': {
            const list = boardData.lists.find((l) => l.id === data?.listId);
            if (!list || !Array.isArray(data?.orderedCardIds)) return false;
            const orderedSet = new Set(data.orderedCardIds);
            const orderMap = new Map(list.cards.map((card) => [card.id, card]));
            const ordered = data.orderedCardIds.map((id) => orderMap.get(id)).filter(Boolean);
            const remaining = list.cards.filter((card) => !orderedSet.has(card.id));
            list.cards = [...ordered, ...remaining];
            return true;
        }
        case 'UPSERT_TAG': {
            const tag = sanitizeTag(data?.tag);
            if (!tag.id) return false;
            const existingIdx = boardData.tags.findIndex((t) => t.id === tag.id);
            if (existingIdx === -1) {
                const position = clampPosition(data?.position ?? boardData.tags.length, boardData.tags.length);
                boardData.tags.splice(position, 0, tag);
            } else {
                const replacement = sanitizeTag({ ...boardData.tags[existingIdx], ...tag });
                boardData.tags.splice(existingIdx, 1, replacement);
                if (Number.isInteger(data?.position)) {
                    const [moved] = boardData.tags.splice(existingIdx, 1);
                    const position = clampPosition(data.position, boardData.tags.length);
                    boardData.tags.splice(position, 0, moved);
                }
            }
            return true;
        }
        case 'DELETE_TAG': {
            const tagId = data?.tagId;
            if (!tagId) return false;
            const index = boardData.tags.findIndex((t) => t.id === tagId);
            if (index === -1) return false;
            boardData.tags.splice(index, 1);
            boardData.lists.forEach((list) => {
                list.cards.forEach((card) => {
                    if (Array.isArray(card.tags)) {
                        card.tags = card.tags.filter((id) => id !== tagId);
                    }
                });
            });
            return true;
        }
        case 'REORDER_TAGS': {
            if (!Array.isArray(data?.orderedTagIds)) return false;
            const order = new Map(boardData.tags.map((tag) => [tag.id, tag]));
            const ordered = data.orderedTagIds.map((id) => order.get(id)).filter(Boolean);
            const remaining = boardData.tags.filter((tag) => !data.orderedTagIds.includes(tag.id));
            boardData.tags = [...ordered, ...remaining];
            return true;
        }
        default:
            return false;
    }
}

socket.on('boardSync', (payload) => {
    const fullBoard = payload?.boardData;
    const diff = payload?.diff;
    const version = payload?.version ?? boardVersion;

    if (diff && !fullBoard) {
        const applied = applyBoardDiff(diff);
        if (!applied) {
            socket.emit('requestBoardState');
            return;
        }
        setBoardVersion(version);
        syncTagsFromBoardData();
        refreshCurrentSelection();
        scheduleRenderAfterSync();
        return;
    }

    const serverBoardData = fullBoard ?? payload;
    setBoardVersion(version);
    setBoardData(serverBoardData);
    syncTagsFromBoardData();
    refreshCurrentSelection();
    scheduleRenderAfterSync();
});

export function submitOperation(type, data = {}, options = {}) {
    const operation = {
        id: generateId(),
        type,
        data,
        baseVersion: boardVersion,
        meta: options.meta ?? null
    };

    setIsLocalUpdate(true);
    captureScrollState(scrollState);

    return new Promise((resolve) => {
        socket.emit('operation', operation, (response = {}) => {
            if (!response.success) {
                console.error(`❌ Opération ${type} refusée:`, response.error);
                setIsLocalUpdate(false);
                socket.emit('requestBoardState');
                resolve(response);
                return;
            }

            setBoardVersion(response.version ?? boardVersion);
            if (response.rebased) {
                socket.emit('requestBoardState');
            }
            setIsLocalUpdate(false);
            resolve(response);
        });
    });
}
