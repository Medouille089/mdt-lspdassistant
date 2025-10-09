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
export let currentUser = null;

// Tracking des patrouilles avec rookies
export let rookiePatrols = [];

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

export function setCurrentUser(user) {
    currentUser = user;
}

export function canManageLists() {
    return currentUser && (currentUser.isCommandStaff || currentUser.isSuperAdmin);
}

export function addRookiePatrol(patrol) {
    // Éviter les doublons - ne pas ajouter si la même carte a déjà été enregistrée
    const existingIndex = rookiePatrols.findIndex(p => p.cardId === patrol.cardId);
    
    if (existingIndex === -1) {
        // Nouvelle patrouille
        rookiePatrols.push({
            ...patrol,
            timestamp: new Date().toISOString()
        });
    } else {
        // Mise à jour de la patrouille existante (si les données ont changé)
        rookiePatrols[existingIndex] = {
            ...patrol,
            timestamp: rookiePatrols[existingIndex].timestamp, // Garder l'heure originale
            updatedAt: new Date().toISOString()
        };
    }
}

export function getRookiePatrols() {
    return [...rookiePatrols];
}

export function clearRookiePatrols() {
    rookiePatrols = [];
}
