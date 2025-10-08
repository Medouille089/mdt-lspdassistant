/**
 * Middleware de cache pour les routes Express
 * Utilise le système de cache pour optimiser les requêtes
 */

const { cache, CACHE_DURATIONS } = require('./cache');

/**
 * Middleware de cache générique
 * @param {string} keyPrefix - Préfixe de la clé de cache
 * @param {number} ttl - Durée de vie en secondes
 * @param {Function} keyGenerator - Fonction pour générer la clé (optionnel)
 */
function cacheMiddleware(keyPrefix, ttl = 300, keyGenerator = null) {
    return async (req, res, next) => {
        // Ne pas mettre en cache les requêtes POST/PUT/DELETE
        if (req.method !== 'GET') {
            return next();
        }

        // Générer la clé de cache
        let cacheKey;
        if (keyGenerator) {
            cacheKey = keyGenerator(req);
        } else {
            cacheKey = `${keyPrefix}:${req.user?.id || 'anonymous'}:${req.path}`;
        }

        // Vérifier le cache
        const cached = cache.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        // Intercepter la réponse pour la mettre en cache
        const originalJson = res.json.bind(res);
        res.json = (data) => {
            // Mettre en cache uniquement les réponses réussies
            if (res.statusCode >= 200 && res.statusCode < 300) {
                cache.set(cacheKey, data, ttl);
            }
            return originalJson(data);
        };

        next();
    };
}

/**
 * Cache pour les données utilisateur
 */
function cacheUser() {
    return cacheMiddleware('user', CACHE_DURATIONS.USER_SESSION, (req) => {
        return `user:${req.user?.id}`;
    });
}

/**
 * Cache pour les membres Discord
 */
function cacheMembers() {
    return cacheMiddleware('members', CACHE_DURATIONS.GUILD_MEMBERS, () => {
        return 'members:lspd';
    });
}

/**
 * Cache pour les grades Discord
 */
function cacheGrades() {
    return cacheMiddleware('grades', CACHE_DURATIONS.CALENDAR_GRADES, () => {
        return 'grades:all';
    });
}

/**
 * Cache pour les événements du calendrier
 */
function cacheEvents() {
    return cacheMiddleware('events', CACHE_DURATIONS.CALENDAR_EVENTS, () => {
        return 'events:calendar';
    });
}

/**
 * Cache pour la configuration
 */
function cacheConfig() {
    return cacheMiddleware('config', CACHE_DURATIONS.CONFIG, () => {
        return 'config:lspd';
    });
}

/**
 * Invalide le cache utilisateur
 */
function invalidateUserCache(userId) {
    cache.deletePattern(`user:${userId}*`);
}

/**
 * Invalide le cache des événements
 */
function invalidateEventsCache() {
    cache.deletePattern('events:*');
}

/**
 * Invalide le cache des membres
 */
function invalidateMembersCache() {
    cache.deletePattern('members:*');
}

/**
 * Invalide tout le cache
 */
function invalidateAllCache() {
    cache.clear();
}

module.exports = {
    cacheMiddleware,
    cacheUser,
    cacheMembers,
    cacheGrades,
    cacheEvents,
    cacheConfig,
    invalidateUserCache,
    invalidateEventsCache,
    invalidateMembersCache,
    invalidateAllCache
};
