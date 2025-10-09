/**
 * Système de cache en mémoire pour optimiser les performances
 * Alternative simple à Redis pour commencer
 */

class CacheManager {
    constructor() {
        this.cache = new Map();
        this.ttl = new Map(); // Time To Live pour chaque clé
    }

    /**
     * Récupère une valeur du cache
     * @param {string} key - Clé de cache
     * @returns {any|null} - Valeur ou null si expirée/inexistante
     */
    get(key) {
        const expiry = this.ttl.get(key);

        // Vérifier si la clé existe et n'est pas expirée
        if (expiry && Date.now() > expiry) {
            this.delete(key);
            return null;
        }

        return this.cache.get(key) || null;
    }

    /**
     * Stocke une valeur dans le cache
     * @param {string} key - Clé de cache
     * @param {any} value - Valeur à stocker
     * @param {number} ttlSeconds - Durée de vie en secondes (défaut: 5 minutes)
     */
    set(key, value, ttlSeconds = 300) {
        this.cache.set(key, value);
        this.ttl.set(key, Date.now() + (ttlSeconds * 1000));
    }

    /**
     * Supprime une clé du cache
     * @param {string} key - Clé à supprimer
     */
    delete(key) {
        this.cache.delete(key);
        this.ttl.delete(key);
    }

    /**
     * Supprime toutes les clés correspondant à un pattern
     * @param {string} pattern - Pattern de recherche (ex: 'user:*')
     */
    deletePattern(pattern) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.delete(key);
            }
        }
    }

    /**
     * Vide complètement le cache
     */
    clear() {
        this.cache.clear();
        this.ttl.clear();
    }

    /**
     * Nettoie les entrées expirées (appelé périodiquement)
     */
    cleanup() {
        const now = Date.now();
        for (const [key, expiry] of this.ttl.entries()) {
            if (now > expiry) {
                this.delete(key);
            }
        }
    }

    /**
     * Obtient ou crée une valeur avec une fonction
     * @param {string} key - Clé de cache
     * @param {Function} fetchFunction - Fonction pour récupérer la valeur si absente
     * @param {number} ttlSeconds - Durée de vie en secondes
     * @returns {Promise<any>}
     */
    async getOrSet(key, fetchFunction, ttlSeconds = 300) {
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }

        const value = await fetchFunction();
        this.set(key, value, ttlSeconds);
        return value;
    }

    /**
     * Retourne les statistiques du cache
     */
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Instance singleton
const cache = new CacheManager();

// Nettoyage automatique toutes les minutes
setInterval(() => {
    cache.cleanup();
}, 60 * 1000);

// Durées de cache recommandées (en secondes)
const CACHE_DURATIONS = {
    USER_SESSION: 300,        // 5 minutes - Session utilisateur
    GUILD_MEMBERS: 600,       // 10 minutes - Liste des membres Discord
    GUILD_ROLES: 1800,        // 30 minutes - Rôles Discord (changent rarement)
    CALENDAR_EVENTS: 60,      // 1 minute - Événements calendrier
    CALENDAR_GRADES: 1800,    // 30 minutes - Grades (changent rarement)
    CONFIG: 3600,             // 1 heure - Configuration LSPD
    OFFICERS_LIST: 300,       // 5 minutes - Liste des officiers
    FAQ_DATA: 3600,           // 1 heure - Documentation
    ABSENCES: 120,            // 2 minutes - Absences
    STATS: 180                // 3 minutes - Statistiques
};

module.exports = {
    cache,
    CACHE_DURATIONS
};
