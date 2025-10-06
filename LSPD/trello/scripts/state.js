const DEFAULT_BOARD = Object.freeze({ lists: [], tags: [] });

function normalizeBoardData(data = DEFAULT_BOARD) {
    return {
        lists: Array.isArray(data?.lists) ? data.lists : [],
        tags: Array.isArray(data?.tags) ? data.tags : []
    };
}

export let boardData = normalizeBoardData();
export let boardVersion = 0;
export let availableTags = JSON.parse(localStorage.getItem('availableTags') || '[]');
export let currentCard = null;
export let currentListId = null;
export let draggedCard = null;
export let draggedFromList = null;
export let isLocalUpdate = false;
export let activeCardCreations = new Set();
export let scrollState = { boardX: 0, lists: {} };

export function setBoardData(data) {
    boardData = normalizeBoardData(data);
}

export function setBoardVersion(version = 0) {
    boardVersion = Number.isInteger(version) ? version : 0;
}

export function setAvailableTags(tags) {
    availableTags = tags;
    localStorage.setItem('availableTags', JSON.stringify(tags));
}

export function setCurrentCard(card) {
    currentCard = card;
}

export function setCurrentListId(id) {
    currentListId = id;
}

export function setDraggedCard(card) {
    draggedCard = card;
}

export function setDraggedFromList(listId) {
    draggedFromList = listId;
}

export function setIsLocalUpdate(value) {
    isLocalUpdate = value;
}
