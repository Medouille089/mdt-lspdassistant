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

/**
 * Cache pour la liste des citoyens
 */
function cacheCitoyens() {
    return cacheMiddleware('citoyens', CACHE_DURATIONS.CITOYENS_LIST, (req) => {
        const { search, mandat_actif, limit, offset } = req.query;
        return `citoyens:list:${search || 'all'}:${mandat_actif || 'all'}:${limit || 50}:${offset || 0}`;
    });
}

/**
 * Cache pour le détail d'un citoyen
 */
function cacheCitoyenDetail() {
    return cacheMiddleware('citoyen', CACHE_DURATIONS.CITOYEN_DETAIL, (req) => {
        return `citoyen:${req.params.id}`;
    });
}

/**
 * Cache pour la liste des véhicules
 */
function cacheVehicules() {
    return cacheMiddleware('vehicules', CACHE_DURATIONS.VEHICULES_LIST, (req) => {
        const { search, mandat_actif, proprietaire_id, limit, offset } = req.query;
        return `vehicules:list:${search || 'all'}:${mandat_actif || 'all'}:${proprietaire_id || 'all'}:${limit || 50}:${offset || 0}`;
    });
}

/**
 * Cache pour le détail d'un véhicule
 */
function cacheVehiculeDetail() {
    return cacheMiddleware('vehicule', CACHE_DURATIONS.VEHICULE_DETAIL, (req) => {
        return `vehicule:${req.params.id}`;
    });
}

/**
 * Invalide le cache des citoyens
 */
function invalidateCitoyensCache() {
    cache.deletePattern('citoyens:*');
    cache.deletePattern('citoyen:*');
}

/**
 * Invalide le cache des véhicules
 */
function invalidateVehiculesCache() {
    cache.deletePattern('vehicules:*');
    cache.deletePattern('vehicule:*');
}

/**
 * Invalide le cache d'un citoyen spécifique et ses véhicules
 */
function invalidateCitoyenCache(citoyenId) {
    cache.deletePattern(`citoyen:${citoyenId}*`);
    cache.deletePattern('citoyens:list:*');
    cache.deletePattern('vehicules:*'); // Les véhicules affichent le nom du propriétaire
}

/**
 * Invalide le cache d'un véhicule spécifique
 */
function invalidateVehiculeCache(vehiculeId) {
    cache.deletePattern(`vehicule:${vehiculeId}*`);
    cache.deletePattern('vehicules:list:*');
}

/**
 * Cache pour la liste des arrestations
 */
function cacheArrestations() {
    return cacheMiddleware('arrestations', CACHE_DURATIONS.ARRESTATIONS_LIST, (req) => {
        const { search, limit, offset } = req.query;
        return `arrestations:list:${search || 'all'}:${limit || 50}:${offset || 0}`;
    });
}

/**
 * Cache pour le détail d'une arrestation
 */
function cacheArrestationDetail() {
    return cacheMiddleware('arrestation', CACHE_DURATIONS.ARRESTATIONS_LIST, (req) => {
        return `arrestation:${req.query.id || req.params.id}`;
    });
}

/**
 * Cache pour la liste des incidents
 */
function cacheIncidents() {
    return cacheMiddleware('incidents', CACHE_DURATIONS.INCIDENTS_LIST, (req) => {
        const { search, limit, offset } = req.query;
        return `incidents:list:${search || 'all'}:${limit || 50}:${offset || 0}`;
    });
}

/**
 * Cache pour le détail d'un incident
 */
function cacheIncidentDetail() {
    return cacheMiddleware('incident', CACHE_DURATIONS.INCIDENTS_LIST, (req) => {
        return `incident:${req.query.id || req.params.id}`;
    });
}

/**
 * Cache pour la liste des bracelets
 */
function cacheBracelets() {
    return cacheMiddleware('bracelets', CACHE_DURATIONS.BRACELETS_LIST, (req) => {
        const { limit, offset } = req.query;
        return `bracelets:list:${limit || 50}:${offset || 0}`;
    });
}

/**
 * Cache pour l'historique des bracelets
 */
function cacheBraceletsHistorique() {
    return cacheMiddleware('bracelets_historique', CACHE_DURATIONS.BRACELETS_LIST, (req) => {
        const { limit, offset } = req.query;
        return `bracelets:historique:${limit || 50}:${offset || 0}`;
    });
}

/**
 * Invalide le cache des arrestations
 */
function invalidateArrestationsCache() {
    cache.deletePattern('arrestations:*');
    cache.deletePattern('arrestation:*');
}

/**
 * Invalide le cache des incidents
 */
function invalidateIncidentsCache() {
    cache.deletePattern('incidents:*');
    cache.deletePattern('incident:*');
}

/**
 * Invalide le cache des bracelets
 */
function invalidateBraceletsCache() {
    cache.deletePattern('bracelets:*');
}

module.exports = {
    cacheMiddleware,
    cacheUser,
    cacheMembers,
    cacheGrades,
    cacheEvents,
    cacheConfig,
    cacheCitoyens,
    cacheCitoyenDetail,
    cacheVehicules,
    cacheVehiculeDetail,
    cacheArrestations,
    cacheArrestationDetail,
    cacheIncidents,
    cacheIncidentDetail,
    cacheBracelets,
    cacheBraceletsHistorique,
    invalidateUserCache,
    invalidateEventsCache,
    invalidateMembersCache,
    invalidateAllCache,
    invalidateCitoyensCache,
    invalidateVehiculesCache,
    invalidateCitoyenCache,
    invalidateVehiculeCache,
    invalidateArrestationsCache,
    invalidateIncidentsCache,
    invalidateBraceletsCache
};
