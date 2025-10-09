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

// Tracking des patrouilles avec rookies (chargées depuis la BDD)
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

/**
 * Charge les patrouilles depuis la BDD
 */
export async function loadRookiePatrolsFromDB() {
    try {
        const response = await fetch('/api/rookie-patrols', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const patrols = await response.json();
        
        // Convertir le format BDD au format JS
        rookiePatrols = patrols.map(p => ({
            cardId: p.card_id,
            patrolName: p.patrol_name,
            listName: p.list_name,
            listId: p.list_id,
            badges: p.badges,
            rookies: p.rookies,
            allMembers: p.all_members,
            rookieCount: p.rookie_count,
            totalCount: p.total_count,
            timestamp: p.timestamp,
            updatedAt: p.updated_at,
            deletedAt: p.deleted_at,
            activeDuration: p.active_duration
        }));
        
        return rookiePatrols;
    } catch (error) {
        console.error('Erreur lors du chargement des patrouilles:', error);
        rookiePatrols = [];
        return [];
    }
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

export function setRookiePatrols(patrols) {
    rookiePatrols = Array.isArray(patrols) ? patrols : [];
}

export function clearRookiePatrols() {
    rookiePatrols = [];
}

export function updateRookiePatrolDeletion(cardId, updates = {}) {
    if (!cardId) return;

    const index = rookiePatrols.findIndex(p => p.cardId === cardId);
    if (index === -1) return;

    const current = rookiePatrols[index];
    const deletedAt = updates.deleted_at ?? updates.deletedAt ?? current.deletedAt ?? new Date().toISOString();
    const activeDuration = updates.active_duration ?? updates.activeDuration ?? current.activeDuration ?? null;

    rookiePatrols[index] = {
        ...current,
        deletedAt,
        activeDuration,
        updatedAt: new Date().toISOString()
    };
}
