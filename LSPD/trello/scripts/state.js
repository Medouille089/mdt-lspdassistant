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

function getPatrolSortValue(patrol = {}) {
    const candidates = [
        patrol.timestamp,
        patrol.deletedAt,
        patrol.deleted_at,
        patrol.updatedAt,
        patrol.updated_at,
    ];

    for (const candidate of candidates) {
        if (!candidate) continue;
        const time = new Date(candidate).getTime();
        if (Number.isFinite(time)) {
            return time;
        }
    }

    return 0;
}

function sortRookiePatrolsInPlace(list) {
    return list.sort((a, b) => getPatrolSortValue(b) - getPatrolSortValue(a));
}

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

export function canCleanRookiePatrols() {
    if (!currentUser) return false;
    return Boolean(currentUser.isSuperAdmin || currentUser.isCommandStaff || currentUser.isSupervisor);
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

        // Convertir le format BDD au format JS (avec versioning)
        rookiePatrols = patrols.map(p => ({
            id: p.id,
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
            activeDuration: p.active_duration,
            reportCompleted: p.report_completed,
            reportCompletedAt: p.report_completed_at,
            // Champs de versioning
            version: p.computed_version || p.version || 1,
            supersededAt: p.superseded_at,
            supersededById: p.superseded_by_id
        }));
        sortRookiePatrolsInPlace(rookiePatrols);

        return rookiePatrols;
    } catch (error) {
        console.error('Erreur lors du chargement des patrouilles:', error);
        rookiePatrols = [];
        return [];
    }
}

/**
 * Compare si les rookies ont changé entre deux patrouilles
 */
function haveMembersChanged(existingRookies, newRookies) {
    if (!existingRookies || !newRookies) return true;

    const existingBadges = (Array.isArray(existingRookies) ? existingRookies : [])
        .map(r => r.badge)
        .sort();
    const newBadges = (Array.isArray(newRookies) ? newRookies : [])
        .map(r => r.badge)
        .sort();

    if (existingBadges.length !== newBadges.length) return true;
    return existingBadges.some((badge, i) => badge !== newBadges[i]);
}

export function addRookiePatrol(patrol) {
    // Trouver la version active existante (non superseded)
    const existingActive = rookiePatrols.find(p => p.cardId === patrol.cardId && !p.supersededAt);

    if (!existingActive) {
        // Nouvelle patrouille - ajouter version 1
        rookiePatrols.push({
            ...patrol,
            timestamp: new Date().toISOString(),
            version: 1,
            reportCompleted: Boolean(patrol.reportCompleted),
            reportCompletedAt: patrol.reportCompletedAt ?? null
        });
    } else if (haveMembersChanged(existingActive.rookies, patrol.rookies)) {
        // Membres ont changé - marquer l'ancienne comme superseded et ajouter nouvelle version
        const existingIndex = rookiePatrols.indexOf(existingActive);
        const newVersion = (existingActive.version || 1) + 1;

        // Marquer l'ancienne version comme superseded
        rookiePatrols[existingIndex] = {
            ...existingActive,
            supersededAt: new Date().toISOString()
        };

        // Ajouter la nouvelle version
        rookiePatrols.push({
            ...patrol,
            timestamp: new Date().toISOString(),
            version: newVersion,
            reportCompleted: false,
            reportCompletedAt: null
        });
    } else {
        // Membres identiques - mettre à jour les métadonnées seulement
        const existingIndex = rookiePatrols.indexOf(existingActive);
        rookiePatrols[existingIndex] = {
            ...existingActive,
            patrolName: patrol.patrolName,
            listName: patrol.listName,
            listId: patrol.listId,
            badges: patrol.badges,
            updatedAt: new Date().toISOString()
        };
    }

    sortRookiePatrolsInPlace(rookiePatrols);
}

export function getRookiePatrols() {
    return [...rookiePatrols];
}

export function setRookiePatrols(patrols) {
    rookiePatrols = Array.isArray(patrols) ? [...patrols] : [];
    sortRookiePatrolsInPlace(rookiePatrols);
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
    let activeDuration = updates.active_duration ?? updates.activeDuration ?? current.activeDuration ?? null;

    if (!activeDuration && current.timestamp) {
        const endDate = new Date(deletedAt ?? Date.now());
        const startDate = new Date(current.timestamp);
        if (!Number.isNaN(endDate.getTime()) && !Number.isNaN(startDate.getTime())) {
            const diffSeconds = Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 1000));
            activeDuration = diffSeconds;
        }
    }

    rookiePatrols[index] = {
        ...current,
        deletedAt,
        activeDuration,
        updatedAt: new Date().toISOString()
    };
}

export function updateRookiePatrolReportStatus(cardId, completed, completedAt = null) {
    if (!cardId) return;

    const index = rookiePatrols.findIndex(p => p.cardId === cardId);
    if (index === -1) return;

    rookiePatrols[index] = {
        ...rookiePatrols[index],
        reportCompleted: Boolean(completed),
        reportCompletedAt: completed ? (completedAt ?? new Date().toISOString()) : null,
        updatedAt: new Date().toISOString()
    };
}

export function removeRookiePatrol(cardId) {
    if (!cardId) return;
    rookiePatrols = rookiePatrols.filter(p => p.cardId !== cardId);
}
