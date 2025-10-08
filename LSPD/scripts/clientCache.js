
class ClientCache {
    constructor() {
        this.prefix = 'lspd_cache_';
        this.cleanExpired();
    }

    /**
     * Génère une clé de cache avec prefix
     */
    _getKey(key) {
        return `${this.prefix}${key}`;
    }

    /**
     * Récupère une valeur du localStorage
     */
    get(key) {
        try {
            const item = localStorage.getItem(this._getKey(key));
            if (!item) return null;

            const { value, expiry } = JSON.parse(item);

            // Vérifier l'expiration
            if (expiry && Date.now() > expiry) {
                this.delete(key);
                return null;
            }

            return value;
        } catch (error) {
            console.error('Erreur cache get:', error);
            return null;
        }
    }

    /**
     * Stocke une valeur dans le localStorage
     */
    set(key, value, ttlSeconds = 300) {
        try {
            const item = {
                value,
                expiry: Date.now() + (ttlSeconds * 1000),
                created: Date.now()
            };
            localStorage.setItem(this._getKey(key), JSON.stringify(item));
        } catch (error) {
            console.error('Erreur cache set:', error);
            // Si quota dépassé, vider les anciennes entrées
            if (error.name === 'QuotaExceededError') {
                this.cleanExpired();
                try {
                    localStorage.setItem(this._getKey(key), JSON.stringify(item));
                } catch (e) {
                    console.error('Cache localStorage plein');
                }
            }
        }
    }

    /**
     * Supprime une clé
     */
    delete(key) {
        localStorage.removeItem(this._getKey(key));
    }

    /**
     * Récupère ou crée une valeur avec une fonction fetch
     */
    async getOrFetch(key, fetchFunction, ttlSeconds = 300) {
        const cached = this.get(key);
        if (cached !== null) {
            console.log(`✅ Cache HIT: ${key}`);
            return cached;
        }

        console.log(`❌ Cache MISS: ${key} - Fetching...`);
        const value = await fetchFunction();
        this.set(key, value, ttlSeconds);
        return value;
    }

    /**
     * Nettoie les entrées expirées
     */
    cleanExpired() {
        try {
            const keys = Object.keys(localStorage);
            const now = Date.now();
            let cleaned = 0;

            for (const key of keys) {
                if (!key.startsWith(this.prefix)) continue;

                const item = localStorage.getItem(key);
                if (!item) continue;

                try {
                    const { expiry } = JSON.parse(item);
                    if (expiry && now > expiry) {
                        localStorage.removeItem(key);
                        cleaned++;
                    }
                } catch (e) {
                    // Entrée corrompue, la supprimer
                    localStorage.removeItem(key);
                }
            }

            if (cleaned > 0) {
                console.log(`🧹 Cache nettoyé: ${cleaned} entrées expirées supprimées`);
            }
        } catch (error) {
            console.error('Erreur nettoyage cache:', error);
        }
    }

    /**
     * Vide tout le cache LSPD
     */
    clear() {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
            if (key.startsWith(this.prefix)) {
                localStorage.removeItem(key);
            }
        }
        console.log('🗑️ Cache vidé complètement');
    }

    /**
     * Invalide les clés correspondant à un pattern
     */
    invalidatePattern(pattern) {
        const keys = Object.keys(localStorage);
        const regex = new RegExp(this.prefix + pattern.replace('*', '.*'));
        let invalidated = 0;

        for (const key of keys) {
            if (regex.test(key)) {
                localStorage.removeItem(key);
                invalidated++;
            }
        }

        console.log(`🔄 ${invalidated} clés invalidées (pattern: ${pattern})`);
    }

    /**
     * Retourne les statistiques du cache
     */
    getStats() {
        const keys = Object.keys(localStorage);
        const cacheKeys = keys.filter(k => k.startsWith(this.prefix));

        let totalSize = 0;
        const entries = [];

        for (const key of cacheKeys) {
            const item = localStorage.getItem(key);
            const size = new Blob([item]).size;
            totalSize += size;

            try {
                const { expiry, created } = JSON.parse(item);
                entries.push({
                    key: key.replace(this.prefix, ''),
                    size,
                    age: Math.round((Date.now() - created) / 1000),
                    ttl: expiry ? Math.round((expiry - Date.now()) / 1000) : null
                });
            } catch (e) {
                // Ignorer les entrées corrompues
            }
        }

        return {
            count: cacheKeys.length,
            totalSize: Math.round(totalSize / 1024) + ' KB',
            entries: entries.sort((a, b) => b.size - a.size)
        };
    }
}

// Durées de cache côté client (en secondes)
const CLIENT_CACHE_TTL = {
    USER: 300,              // 5 minutes
    GRADES: 1800,           // 30 minutes
    MEMBERS: 600,           // 10 minutes
    EVENTS: 60,             // 1 minute
    CONFIG: 3600,           // 1 heure
    OFFICERS: 300           // 5 minutes
};

// Instance globale
window.clientCache = new ClientCache();

// Nettoyer le cache au chargement de la page
window.clientCache.cleanExpired();

// Export pour utilisation
window.CLIENT_CACHE_TTL = CLIENT_CACHE_TTL;
