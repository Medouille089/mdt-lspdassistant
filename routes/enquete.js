const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { EmbedBuilder } = require('discord.js');

// GET - Liste des enquêtes avec pagination et filtres
router.get('/api/rapports-enquete', async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', superviseurId = '' } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT * FROM lspd_rapports_enquete
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (search) {
            query += ` AND (
                numero_dossier ILIKE $${paramIndex} OR
                sujet ILIKE $${paramIndex} OR
                superviseur_nom ILIKE $${paramIndex} OR
                superviseur_prenom ILIKE $${paramIndex}
            )`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (superviseurId) {
            query += ` AND superviseur_id = $${paramIndex}`;
            params.push(superviseurId);
            paramIndex++;
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Compter le total
        let countQuery = 'SELECT COUNT(*) FROM lspd_rapports_enquete WHERE 1=1';
        const countParams = [];
        let countParamIndex = 1;

        if (search) {
            countQuery += ` AND (
                numero_dossier ILIKE $${countParamIndex} OR
                sujet ILIKE $${countParamIndex} OR
                superviseur_nom ILIKE $${countParamIndex} OR
                superviseur_prenom ILIKE $${countParamIndex}
            )`;
            countParams.push(`%${search}%`);
            countParamIndex++;
        }

        if (superviseurId) {
            countQuery += ` AND superviseur_id = $${countParamIndex}`;
            countParams.push(superviseurId);
        }

        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            enquetes: result.rows,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Erreur GET /api/rapports-enquete:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET - Détails d'une enquête avec toutes les données liées
router.get('/api/rapports-enquete/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;

        // Enquête principale
        const enqueteResult = await client.query(
            'SELECT * FROM lspd_rapports_enquete WHERE id = $1',
            [id]
        );

        if (enqueteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Enquête non trouvée' });
        }

        const enquete = enqueteResult.rows[0];

        // Agents assignés
        const agentsResult = await client.query(
            'SELECT * FROM lspd_enquete_agents WHERE enquete_id = $1',
            [id]
        );

        // Suspects
        const suspectsResult = await client.query(
            'SELECT * FROM lspd_enquete_suspects WHERE enquete_id = $1',
            [id]
        );

        // Rapports liés
        const rapportsResult = await client.query(
            'SELECT * FROM lspd_enquete_rapports WHERE enquete_id = $1 ORDER BY rapport_date DESC',
            [id]
        );

        res.json({
            ...enquete,
            agents: agentsResult.rows,
            suspects: suspectsResult.rows,
            rapports: rapportsResult.rows
        });
    } catch (error) {
        console.error('Erreur GET /api/rapports-enquete/:id:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    } finally {
        client.release();
    }
});

// POST - Créer une nouvelle enquête
router.post('/api/rapports-enquete', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const {
            superviseur,
            agents,
            sujet,
            motifs,
            suspects,
            rapports,
            infos_complementaires
        } = req.body;

        // Générer le numéro de dossier
        const numeroResult = await client.query('SELECT generate_numero_dossier()');
        const numero_dossier = numeroResult.rows[0].generate_numero_dossier;

        // Insérer l'enquête principale
        const enqueteResult = await client.query(
            `INSERT INTO lspd_rapports_enquete (
                numero_dossier, superviseur_id, superviseur_nom, superviseur_prenom, 
                superviseur_matricule, sujet, motifs, infos_complementaires, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [
                numero_dossier,
                superviseur?.id || null,
                superviseur?.nom || null,
                superviseur?.prenom || null,
                superviseur?.matricule || null,
                sujet,
                motifs,
                infos_complementaires || null,
                req.session?.user?.username || 'System'
            ]
        );

        const enqueteId = enqueteResult.rows[0].id;

        // Insérer les agents
        if (agents && agents.length > 0) {
            for (const agent of agents) {
                await client.query(
                    `INSERT INTO lspd_enquete_agents (
                        enquete_id, agent_id, agent_nom, agent_prenom, agent_matricule
                    ) VALUES ($1, $2, $3, $4, $5)`,
                    [enqueteId, agent.id, agent.nom, agent.prenom, agent.matricule]
                );
            }
        }

        // Insérer les suspects
        if (suspects && suspects.length > 0) {
            for (const suspect of suspects) {
                await client.query(
                    `INSERT INTO lspd_enquete_suspects (
                        enquete_id, citoyen_id, citoyen_nom, citoyen_prenom
                    ) VALUES ($1, $2, $3, $4)`,
                    [enqueteId, suspect.id, suspect.nom, suspect.prenom]
                );
            }
        }

        // Insérer les rapports liés
        if (rapports && rapports.length > 0) {
            for (const rapport of rapports) {
                await client.query(
                    `INSERT INTO lspd_enquete_rapports (
                        enquete_id, rapport_type, rapport_id, rapport_titre, rapport_date
                    ) VALUES ($1, $2, $3, $4, $5)`,
                    [enqueteId, rapport.type, rapport.id, rapport.titre, rapport.date]
                );
            }
        }

        await client.query('COMMIT');

        // Log Discord
        try {
            const discordClient = req.app.get('discordClient');
            if (discordClient) {
                const channel = await discordClient.channels.fetch(process.env.DISCORD_LOG_CHANNEL_ID);
                if (channel) {
                    const embed = new EmbedBuilder()
                        .setColor('#0B1B5A')
                        .setTitle('📋 Nouveau Rapport d\'Enquête')
                        .addFields(
                            { name: 'Numéro de dossier', value: numero_dossier, inline: true },
                            { name: 'Sujet', value: sujet, inline: false },
                            { name: 'Superviseur', value: superviseur ? `${superviseur.prenom} ${superviseur.nom}` : 'Non assigné', inline: true },
                            { name: 'Agents assignés', value: agents?.length > 0 ? `${agents.length} agent(s)` : 'Aucun', inline: true },
                            { name: 'Suspects', value: suspects?.length > 0 ? `${suspects.length} suspect(s)` : 'Aucun', inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: `Créé par ${req.session?.user?.username || 'System'}` });

                    await channel.send({ embeds: [embed] });
                }
            }
        } catch (discordError) {
            console.error('Erreur Discord:', discordError);
        }

        res.status(201).json({ 
            id: enqueteId, 
            numero_dossier,
            message: 'Rapport d\'enquête créé avec succès' 
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur POST /api/rapports-enquete:', error);
        res.status(500).json({ error: 'Erreur lors de la création du rapport d\'enquête' });
    } finally {
        client.release();
    }
});

// PUT - Mettre à jour une enquête
router.put('/api/rapports-enquete/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { id } = req.params;
        const {
            superviseur,
            agents,
            sujet,
            motifs,
            suspects,
            rapports,
            infos_complementaires
        } = req.body;

        // Mettre à jour l'enquête principale
        await client.query(
            `UPDATE lspd_rapports_enquete SET
                superviseur_id = $1,
                superviseur_nom = $2,
                superviseur_prenom = $3,
                superviseur_matricule = $4,
                sujet = $5,
                motifs = $6,
                infos_complementaires = $7,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $8`,
            [
                superviseur?.id || null,
                superviseur?.nom || null,
                superviseur?.prenom || null,
                superviseur?.matricule || null,
                sujet,
                motifs,
                infos_complementaires || null,
                id
            ]
        );

        // Supprimer et réinsérer les agents
        await client.query('DELETE FROM lspd_enquete_agents WHERE enquete_id = $1', [id]);
        if (agents && agents.length > 0) {
            for (const agent of agents) {
                await client.query(
                    `INSERT INTO lspd_enquete_agents (
                        enquete_id, agent_id, agent_nom, agent_prenom, agent_matricule
                    ) VALUES ($1, $2, $3, $4, $5)`,
                    [id, agent.id, agent.nom, agent.prenom, agent.matricule]
                );
            }
        }

        // Supprimer et réinsérer les suspects
        await client.query('DELETE FROM lspd_enquete_suspects WHERE enquete_id = $1', [id]);
        if (suspects && suspects.length > 0) {
            for (const suspect of suspects) {
                await client.query(
                    `INSERT INTO lspd_enquete_suspects (
                        enquete_id, citoyen_id, citoyen_nom, citoyen_prenom
                    ) VALUES ($1, $2, $3, $4)`,
                    [id, suspect.id, suspect.nom, suspect.prenom]
                );
            }
        }

        // Supprimer et réinsérer les rapports liés
        await client.query('DELETE FROM lspd_enquete_rapports WHERE enquete_id = $1', [id]);
        if (rapports && rapports.length > 0) {
            for (const rapport of rapports) {
                await client.query(
                    `INSERT INTO lspd_enquete_rapports (
                        enquete_id, rapport_type, rapport_id, rapport_titre, rapport_date
                    ) VALUES ($1, $2, $3, $4, $5)`,
                    [id, rapport.type, rapport.id, rapport.titre, rapport.date]
                );
            }
        }

        await client.query('COMMIT');

        res.json({ message: 'Rapport d\'enquête mis à jour avec succès' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur PUT /api/rapports-enquete/:id:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du rapport d\'enquête' });
    } finally {
        client.release();
    }
});

// DELETE - Supprimer une enquête (uniquement Command-Staff)
router.delete('/api/rapports-enquete/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Vérifier les permissions (Command-Staff uniquement)
        const userGrade = req.session?.user?.grade || '';
        const commandStaffGrades = ['Chief of Police', 'Assistant Chief', 'Deputy Chief', 'Commander'];
        
        if (!commandStaffGrades.includes(userGrade)) {
            return res.status(403).json({ 
                error: 'Permission refusée. Seul le Command-Staff peut supprimer des enquêtes.' 
            });
        }

        // Supprimer l'enquête (CASCADE supprimera automatiquement les données liées)
        const result = await pool.query(
            'DELETE FROM lspd_rapports_enquete WHERE id = $1 RETURNING numero_dossier',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Enquête non trouvée' });
        }

        res.json({ 
            message: 'Rapport d\'enquête supprimé avec succès',
            numero_dossier: result.rows[0].numero_dossier
        });

    } catch (error) {
        console.error('Erreur DELETE /api/rapports-enquete/:id:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression du rapport d\'enquête' });
    }
});

module.exports = router;
