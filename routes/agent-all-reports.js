const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { getBot } = require('../config/config');
const { GUILD_ID } = require('../config/env');

/**
 * Route unifiée pour récupérer TOUS les rapports d'un agent
 * GET /api/agent-reports/:agentId
 * 
 * Retourne tous les types de rapports :
 * - Arrestations
 * - Incidents
 * - Interrogatoires
 * - Enquêtes
 */
router.get('/api/agent-reports/:agentId', async (req, res) => {
    try {
        const { agentId } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        // Récupérer le nom Discord de l'agent pour les recherches textuelles
        let agentDisplayName = '';
        try {
            const bot = getBot();
            if (bot?.isReady()) {
                const guild = await bot.guilds.fetch(process.env.GUILD_ID || GUILD_ID);
                if (guild) {
                    const member = await guild.members.fetch(agentId).catch(() => null);
                    if (member) {
                        agentDisplayName = member.displayName;
                    }
                }
            }
        } catch (err) {
            console.warn('Erreur récupération nom Discord:', err.message);
        }

        // Tableau pour stocker tous les rapports
        let allReports = [];

        // 1. RAPPORTS D'ARRESTATION
        try {
            const arrestationsResult = await pool.query(`
        SELECT 
          id, 
          titre_rapport, 
          date_arrestation, 
          suspects_impliques,
          'arrestation' as type
        FROM lspd_rapports_arrestation
        WHERE officier_redacteur = $1 
           OR agents_impliques::text ILIKE '%' || $1 || '%'
        ORDER BY date_arrestation DESC
        LIMIT $2
      `, [agentId, limit]);

            arrestationsResult.rows.forEach(row => {
                let suspects = 'Aucun';
                try {
                    const suspArr = typeof row.suspects_impliques === 'string'
                        ? JSON.parse(row.suspects_impliques)
                        : row.suspects_impliques;
                    if (suspArr && suspArr.length > 0) {
                        suspects = suspArr.map(s => s.name).join(', ');
                    }
                } catch (e) { }

                allReports.push({
                    id: row.id,
                    type: 'arrestation',
                    titre: row.titre_rapport || `Rapport d'arrestation #${row.id}`,
                    date: row.date_arrestation,
                    details: `Suspect(s): ${suspects}`,
                    url: `/view-rapport-arrestation?id=${row.id}`
                });
            });
        } catch (err) {
            console.error('Erreur chargement arrestations:', err);
        }

        // 2. RAPPORTS D'INCIDENT
        try {
            const incidentsResult = await pool.query(`
        SELECT DISTINCT
          i.id,
          i.incident_id,
          i.date_incident,
          i.lieu_incident,
          i.officier_redacteur_id
        FROM incidents i
        LEFT JOIN incident_agents ia ON i.id = ia.incident_id
        WHERE i.officier_redacteur_id = $1 
           OR ia.agent_discord_id = $1
        ORDER BY i.date_incident DESC
        LIMIT $2
      `, [agentId, limit]);

            incidentsResult.rows.forEach(row => {
                allReports.push({
                    id: row.incident_id,
                    type: 'incident',
                    titre: `Incident ${row.incident_id}`,
                    date: row.date_incident,
                    details: `Lieu: ${row.lieu_incident || 'Non précisé'}`,
                    url: `/viewIncident.html?id=${row.incident_id}`
                });
            });
        } catch (err) {
            console.error('Erreur chargement incidents:', err);
        }

        // 3. RAPPORTS D'INTERROGATOIRE
        if (agentDisplayName) {
            try {
                const interrogatoiresResult = await pool.query(`
          SELECT 
            id,
            date_interrogatoire,
            citoyen_nom,
            citoyen_prenom,
            officier_redacteur
          FROM lspd_rapports_interrogatoire
          WHERE officier_redacteur ILIKE '%' || $1 || '%'
          ORDER BY date_interrogatoire DESC
          LIMIT $2
        `, [agentDisplayName, limit]);

                interrogatoiresResult.rows.forEach(row => {
                    allReports.push({
                        id: row.id,
                        type: 'interrogatoire',
                        titre: `Interrogatoire #${row.id}`,
                        date: row.date_interrogatoire,
                        details: `Personne: ${row.citoyen_prenom} ${row.citoyen_nom}`,
                        url: `/view-rapport-interrogatoire?id=${row.id}`
                    });
                });
            } catch (err) {
                console.error('Erreur chargement interrogatoires:', err);
            }
        }

        // 4. RAPPORTS D'ENQUÊTE
        try {
            const enquetesResult = await pool.query(`
        SELECT DISTINCT
          e.id,
          e.numero_dossier,
          e.sujet,
          e.created_at,
          e.superviseur_id
        FROM lspd_rapports_enquete e
        LEFT JOIN lspd_enquete_agents ea ON e.id = ea.enquete_id
        WHERE e.superviseur_id = $1 
           OR ea.agent_id = $1
        ORDER BY e.created_at DESC
        LIMIT $2
      `, [agentId, limit]);

            enquetesResult.rows.forEach(row => {
                allReports.push({
                    id: row.id,
                    type: 'enquete',
                    titre: `Enquête ${row.numero_dossier}`,
                    date: row.created_at,
                    details: row.sujet || 'Sans sujet',
                    url: `/view-rapport-enquete?id=${row.id}`
                });
            });
        } catch (err) {
            console.error('Erreur chargement enquêtes:', err);
        }

        // Trier tous les rapports par date décroissante
        allReports.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Limiter au nombre demandé
        allReports = allReports.slice(0, limit);

        res.json({
            reports: allReports,
            total: allReports.length
        });

    } catch (error) {
        console.error('Erreur GET /api/agent-reports:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
