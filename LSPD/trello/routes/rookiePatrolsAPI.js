/**
 * API pour gérer l'historique des patrouilles avec rookies
 */

/**
 * Récupère toutes les patrouilles avec rookies depuis la BDD
 */
export async function fetchRookiePatrols() {
    try {
        const response = await fetch('/api/rookie-patrols', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Erreur lors du chargement des patrouilles:', error);
        return [];
    }
}

/**
 * Sauvegarde une patrouille avec rookie dans la BDD
 */
export async function saveRookiePatrol(patrol) {
    try {
        const response = await fetch('/api/rookie-patrols', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(patrol)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la patrouille:', error);
        throw error;
    }
}

/**
 * Supprime les patrouilles dont les cartes n'existent plus
 */
export async function cleanDeletedPatrols(deletedCardIds) {
    try {
        const response = await fetch('/api/rookie-patrols/deleted', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ deletedCardIds })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Erreur lors du nettoyage des patrouilles:', error);
        throw error;
    }
}