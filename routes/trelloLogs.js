const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { checkAuth } = require('../config/middleware');

/**
 * GET /api/trello/logs
 * Récupère les logs du Trello avec pagination
 */
router.get('/api/trello/logs', checkAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const logType = req.query.type; // Filtrer par type si fourni
        const userId = req.query.user_id; // Filtrer par utilisateur si fourni
        const search = req.query.search; // Recherche globale
        
        let query = `
            SELECT 
                tl.id, 
                tl.log_type, 
                tl.user_id, 
                tl.user_name, 
                tl.action_description, 
                tl.details, 
                tl.color, 
                tl.created_at,
                lap.photo_url
            FROM trello_logs tl
            LEFT JOIN lspd_agent_profiles lap ON tl.user_id = lap.discord_id
        `;
        let countQuery = `SELECT COUNT(*) FROM trello_logs tl`;
        const params = [];
        const conditions = [];
        
        // Filtrer par type si fourni
        if (logType) {
            conditions.push(`tl.log_type = $${params.length + 1}`);
            params.push(logType);
        }
        
        // Filtrer par utilisateur si fourni
        if (userId) {
            conditions.push(`tl.user_id = $${params.length + 1}`);
            params.push(userId);
        }
        
        // Recherche globale dans tous les champs
        if (search && search.trim()) {
            const searchParam = `%${search.trim()}%`;
            conditions.push(`(
                tl.user_name ILIKE $${params.length + 1} OR 
                tl.action_description ILIKE $${params.length + 1} OR 
                tl.details::text ILIKE $${params.length + 1} OR
                tl.log_type ILIKE $${params.length + 1}
            )`);
            params.push(searchParam);
        }
        
        // Ajouter les conditions WHERE
        if (conditions.length > 0) {
            const whereClause = ` WHERE ${conditions.join(' AND ')}`;
            query += whereClause;
            countQuery += whereClause;
        }
        
        query += ` ORDER BY tl.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        
        const [logsResult, countResult] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, conditions.length > 0 ? params.slice(0, -2) : [])
        ]);
        
        const totalLogs = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalLogs / limit);
        
        res.json({
            logs: logsResult.rows,
            pagination: {
                currentPage: page,
                totalPages,
                totalLogs,
                limit
            }
        });
    } catch (error) {
        console.error('❌ Erreur récupération logs Trello:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des logs' });
    }
});

/**
 * GET /api/trello/logs/stats
 * Récupère des statistiques sur les logs
 */
router.get('/api/trello/logs/stats', checkAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                log_type,
                COUNT(*) as count
            FROM trello_logs
            WHERE created_at >= NOW() - INTERVAL '30 days'
            GROUP BY log_type
            ORDER BY count DESC
        `);
        
        res.json({ stats: result.rows });
    } catch (error) {
        console.error('❌ Erreur récupération stats logs:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
});

router.get('/api/trello/logs/members', checkAuth, async (req, res) => {
    try {
        const bot = require('../config/bot');
        const { GUILD_ID } = require('../config/env');
        
        // Récupérer le required_role_id depuis la config
        const configResult = await pool.query('SELECT required_role_id FROM configlspd LIMIT 1');
        const requiredRoleId = configResult.rows[0]?.required_role_id;
        
        if (!requiredRoleId || !bot || !bot.isReady()) {
            return res.json({ members: [] });
        }
        
        const guild = bot.guilds.cache.get(GUILD_ID);
        
        if (!guild) {
            return res.json({ members: [] });
        }
        
        const role = guild.roles.cache.get(requiredRoleId);
        
        if (!role) {
            return res.json({ members: [] });
        }
        
        // Utiliser uniquement le cache existant (pas de fetch qui timeout)
        // Le cache est maintenu à jour par les événements Discord du bot
        const members = role.members.map(member => ({
            id: member.id,
            displayName: member.displayName || member.user.username
        }));
        
        // Trier par nom
        members.sort((a, b) => a.displayName.localeCompare(b.displayName));
        
        console.log(`✅ ${members.length} membres récupérés depuis le cache`);
        
        res.json({ members });
    } catch (error) {
        console.error('❌ Erreur récupération membres:', error);
        res.json({ members: [] });
    }
});

router.delete('/api/trello/logs/cleanup', checkAuth, async (req, res) => {
    try {
        // Vérifier si l'utilisateur est admin
        if (!req.user.isSuperAdmin && !req.user.isCommandStaff) {
            return res.status(403).json({ error: 'Accès refusé' });
        }
        
        const days = parseInt(req.query.days) || 90;
        
        const result = await pool.query(
            `DELETE FROM trello_logs WHERE created_at < NOW() - INTERVAL '${days} days'`
        );
        
        res.json({ 
            success: true, 
            deletedCount: result.rowCount,
            message: `${result.rowCount} logs supprimés (plus de ${days} jours)`
        });
    } catch (error) {
        console.error('❌ Erreur nettoyage logs:', error);
        res.status(500).json({ error: 'Erreur lors du nettoyage des logs' });
    }
});

module.exports = router;
