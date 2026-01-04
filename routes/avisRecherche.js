const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { getBot, getConfig } = require("../config/config");
const { EmbedBuilder } = require("discord.js");

// Création de la table si elle n'existe pas
(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS lspd_avis_recherche (
                id SERIAL PRIMARY KEY,
                citoyen_id INTEGER REFERENCES citoyens(id),
                citoyen_nom VARCHAR(100),
                citoyen_prenom VARCHAR(100),
                alias VARCHAR(100),
                non_recense BOOLEAN DEFAULT FALSE,
                type_avis VARCHAR(50) NOT NULL,
                motif TEXT NOT NULL,
                description TEXT,
                recompense VARCHAR(100),
                photo TEXT,
                officier VARCHAR(100),
                grade VARCHAR(100),
                statut VARCHAR(50) DEFAULT 'actif',
                discord_message_id VARCHAR(50),
                created_by VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log("✅ Table lspd_avis_recherche vérifiée/créée.");
    } catch (err) {
        console.error("❌ Erreur création table lspd_avis_recherche:", err);
    }
})();

// Helper pour formater le type d'avis
function formatTypeAvis(type) {
    const types = {
        'disparu': { label: 'Personne disparue', color: 0x3498db },
        'most_wanted': { label: 'Most Wanted', color: 0xe74c3c }
    };
    return types[type] || { label: 'Inconnu', color: 0x95a5a6 };
}

// POST /api/avis-recherche - Créer un nouvel avis
router.post('/api/avis-recherche', async (req, res) => {
    try {
        const {
            citoyen_id,
            citoyen_nom,
            citoyen_prenom,
            alias,
            non_recense,
            type_avis,
            motif,
            description,
            recompense,
            photo,
            officier,
            grade
        } = req.body;

        // Validation : soit un citoyen_id, soit non_recense avec nom/prenom
        if (!non_recense && !citoyen_id) {
            return res.status(400).json({ error: 'Veuillez sélectionner une personne ou utiliser le mode non recensé' });
        }
        
        if (non_recense && (!citoyen_nom || !citoyen_prenom)) {
            return res.status(400).json({ error: 'Nom et prénom requis pour une personne non recensée' });
        }
        
        if (!type_avis || !motif) {
            return res.status(400).json({ error: 'Type d\'avis et motif requis' });
        }

        const user = req.user;
        const createdBy = user?.guild_member?.nick || user?.displayName || user?.username || officier;

        // Insertion en BDD
        const { rows } = await pool.query(
            `INSERT INTO lspd_avis_recherche 
            (citoyen_id, citoyen_nom, citoyen_prenom, alias, non_recense, type_avis, motif, description, recompense, photo, officier, grade, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *`,
            [citoyen_id || null, citoyen_nom, citoyen_prenom, alias || null, non_recense || false, type_avis, motif, description || null, recompense || null, photo || null, officier, grade, createdBy]
        );

        const avisRecherche = rows[0];

        // Activer le mandat sur le citoyen (seulement si recensé)
        if (citoyen_id && !non_recense) {
            try {
                await pool.query(
                    `UPDATE citoyens SET mandat_actif = true, updated_at = NOW() WHERE id = $1`,
                    [citoyen_id]
                );
            } catch (mandatErr) {
                // La colonne mandat_actif n'existe peut-être pas encore, ignorer
                console.log('Note: colonne mandat_actif non mise à jour (peut-être inexistante)');
            }
        }

        // Envoi sur Discord
        const bot = getBot();
        const conf = await getConfig();
        const channelId = conf?.avis_recherche_channel_id;

        if (bot && channelId) {
            try {
                const channel = await bot.channels.fetch(channelId);
                if (channel?.isTextBased()) {
                    const typeInfo = formatTypeAvis(type_avis);

                    const identite = alias ? `${citoyen_prenom} ${citoyen_nom} (alias: ${alias})` : `${citoyen_prenom} ${citoyen_nom}`;
                    const nonRecenseTag = non_recense ? ' ⚠️ Non recensé' : '';
                    
                    const embed = new EmbedBuilder()
                        .setTitle(`${typeInfo.emoji} ${typeInfo.label.toUpperCase()}`)
                        .setDescription(`**${identite}**${nonRecenseTag}`)
                        .setColor(typeInfo.color)
                        .addFields(
                            { name: '👤 Identité', value: identite, inline: true },
                            { name: '📋 Motif', value: motif, inline: false }
                        )
                        .setFooter({
                            text: `Publié par ${officier} • LSPD Assistant`,
                            iconURL: bot.user.displayAvatarURL()
                        })
                        .setTimestamp();

                    if (description) {
                        embed.addFields({ name: '📝 Description', value: description, inline: false });
                    }

                    if (recompense) {
                        embed.addFields({ name: '💰 Récompense', value: recompense, inline: true });
                    }

                    if (photo) {
                        embed.setThumbnail(photo);
                    }

                    const message = await channel.send({ embeds: [embed] });

                    // Sauvegarder l'ID du message Discord
                    await pool.query(
                        `UPDATE lspd_avis_recherche SET discord_message_id = $1 WHERE id = $2`,
                        [message.id, avisRecherche.id]
                    );
                }
            } catch (discordErr) {
                console.error('Erreur envoi Discord avis recherche:', discordErr);
            }
        }

        // Log dans le channel de logs
        if (bot && conf?.logs_channel) {
            try {
                const logsChannel = await bot.channels.fetch(conf.logs_channel);
                if (logsChannel?.isTextBased()) {
                    const embedLog = new EmbedBuilder()
                        .setColor(0x0b1b5a)
                        .setTitle('📋 Nouvel avis de recherche')
                        .setDescription(`${createdBy} a publié un avis de recherche`)
                        .addFields(
                            { name: 'Personne recherchée', value: `${citoyen_prenom} ${citoyen_nom}`, inline: true },
                            { name: 'Dangerosité', value: dangerosite, inline: true },
                            { name: 'ID', value: `#${avisRecherche.id}`, inline: true }
                        )
                        .setFooter({ text: 'LSPD Assistant', iconURL: bot.user.displayAvatarURL() })
                        .setTimestamp();

                    await logsChannel.send({ embeds: [embedLog] });
                }
            } catch (logErr) {
                console.error('Erreur log Discord:', logErr);
            }
        }

        res.status(201).json(avisRecherche);
    } catch (error) {
        console.error('Erreur création avis de recherche:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/avis-recherche - Liste des avis de recherche
router.get('/api/avis-recherche', async (req, res) => {
    try {
        const { statut = 'actif', limit = 50, offset = 0 } = req.query;

        let query = 'SELECT * FROM lspd_avis_recherche WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (statut && statut !== 'tous') {
            query += ` AND statut = $${paramIndex++}`;
            params.push(statut);
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), parseInt(offset));

        const { rows } = await pool.query(query, params);

        // Compter le total
        let countQuery = 'SELECT COUNT(*) FROM lspd_avis_recherche WHERE 1=1';
        const countParams = [];
        if (statut && statut !== 'tous') {
            countQuery += ' AND statut = $1';
            countParams.push(statut);
        }
        const countResult = await pool.query(countQuery, countParams);

        res.json({
            avisRecherche: rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Erreur récupération avis de recherche:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/avis-recherche/:id - Détail d'un avis
router.get('/api/avis-recherche/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query('SELECT * FROM lspd_avis_recherche WHERE id = $1', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Avis de recherche non trouvé' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Erreur récupération avis:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PATCH /api/avis-recherche/:id/cloturer - Clôturer un avis
router.patch('/api/avis-recherche/:id/cloturer', async (req, res) => {
    try {
        const { id } = req.params;

        const { rows } = await pool.query(
            `UPDATE lspd_avis_recherche SET statut = 'cloture', updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Avis de recherche non trouvé' });
        }

        // Désactiver le mandat sur le citoyen
        try {
            await pool.query(
                `UPDATE citoyens SET mandat_actif = false, updated_at = NOW() WHERE id = $1`,
                [rows[0].citoyen_id]
            );
        } catch (mandatErr) {
            console.log('Note: colonne mandat_actif non mise à jour');
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Erreur clôture avis:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /api/avis-recherche/:id - Supprimer un avis
router.delete('/api/avis-recherche/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { rows } = await pool.query(
            `DELETE FROM lspd_avis_recherche WHERE id = $1 RETURNING *`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Avis de recherche non trouvé' });
        }

        res.json({ message: 'Avis de recherche supprimé', avis: rows[0] });
    } catch (error) {
        console.error('Erreur suppression avis:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
