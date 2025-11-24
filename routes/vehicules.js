const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const bot = require("../config/bot");
const config = require("../config/config");
const { checkAuth } = require("../config/middleware");
const { EmbedBuilder } = require("discord.js");

// GET /api/vehicules - Liste de tous les véhicules
router.get('/api/vehicules', checkAuth, async (req, res) => {
    try {
        const { search, mandat_actif, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT v.*, 
                   c.nom as proprietaire_nom, 
                   c.prenom as proprietaire_prenom
            FROM vehicules v
            LEFT JOIN citoyens c ON v.proprietaire_id = c.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        // Filtre de recherche (modèle, plaque)
        if (search) {
            query += ` AND (LOWER(v.modele) LIKE $${paramIndex} OR LOWER(v.plaque) LIKE $${paramIndex})`;
            params.push(`%${search.toLowerCase()}%`);
            paramIndex++;
        }

        // Filtre mandat actif
        if (mandat_actif !== undefined) {
            query += ` AND v.mandat_actif = $${paramIndex}`;
            params.push(mandat_actif === 'true');
            paramIndex++;
        }

        // Order by
        query += ' ORDER BY v.created_at DESC';

        // Pagination
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const { rows } = await pool.query(query, params);

        // Compter le total pour la pagination
        let countQuery = 'SELECT COUNT(*) FROM vehicules v WHERE 1=1';
        const countParams = [];
        let countParamIndex = 1;

        if (search) {
            countQuery += ` AND (LOWER(v.modele) LIKE $${countParamIndex} OR LOWER(v.plaque) LIKE $${countParamIndex})`;
            countParams.push(`%${search.toLowerCase()}%`);
            countParamIndex++;
        }

        if (mandat_actif !== undefined) {
            countQuery += ` AND v.mandat_actif = $${countParamIndex}`;
            countParams.push(mandat_actif === 'true');
        }

        const { rows: countRows } = await pool.query(countQuery, countParams);
        const total = parseInt(countRows[0].count);

        res.json({
            vehicules: rows,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des véhicules:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération des véhicules' });
    }
});

// GET /api/vehicules/:id - Détails d'un véhicule
router.get('/api/vehicules/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query(`
            SELECT v.*, 
                   c.nom as proprietaire_nom, 
                   c.prenom as proprietaire_prenom,
                   c.telephone as proprietaire_telephone,
                   c.date_naissance as proprietaire_date_naissance
            FROM vehicules v
            LEFT JOIN citoyens c ON v.proprietaire_id = c.id
            WHERE v.id = $1
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Véhicule non trouvé' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Erreur lors de la récupération du véhicule:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération du véhicule' });
    }
});

// POST /api/vehicules - Créer un nouveau véhicule
router.post('/api/vehicules', checkAuth, async (req, res) => {
    try {
        const {
            modele,
            plaque,
            couleur,
            proprietaire_id,
            mandat_actif,
            photo,
            created_by
        } = req.body;

        // Validation des champs requis
        if (!modele || !plaque) {
            return res.status(400).json({ error: 'Le modèle et la plaque sont requis' });
        }

        // Vérifier si la plaque existe déjà
        const { rows: existingPlaque } = await pool.query(
            'SELECT id FROM vehicules WHERE LOWER(plaque) = LOWER($1)',
            [plaque]
        );

        if (existingPlaque.length > 0) {
            return res.status(400).json({ error: 'Cette plaque d\'immatriculation existe déjà' });
        }

        // Vérifier que le propriétaire existe si fourni
        if (proprietaire_id) {
            const { rows: citoyenRows } = await pool.query(
                'SELECT id FROM citoyens WHERE id = $1',
                [proprietaire_id]
            );
            if (citoyenRows.length === 0) {
                return res.status(400).json({ error: 'Propriétaire introuvable' });
            }
        }

        const user = req.user;
        const createdBy = created_by || user.guild_member?.nick || user.displayName || user.username;

        const { rows } = await pool.query(
            `INSERT INTO vehicules 
            (modele, plaque, couleur, proprietaire_id, mandat_actif, photo, created_by, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            RETURNING *`,
            [
                modele,
                plaque.toUpperCase(),
                couleur || null,
                proprietaire_id || null,
                mandat_actif || false,
                photo || null,
                createdBy
            ]
        );

        const newVehicule = rows[0];

        // Récupérer les infos du propriétaire pour le log
        let proprietaireInfo = 'Aucun';
        if (proprietaire_id) {
            const { rows: propRows } = await pool.query(
                'SELECT nom, prenom FROM citoyens WHERE id = $1',
                [proprietaire_id]
            );
            if (propRows.length > 0) {
                proprietaireInfo = `${propRows[0].nom} ${propRows[0].prenom}`;
            }
        }

        // Logs Discord
        const conf = await config.getConfig();
        if (conf.logs_more_tables) {
            try {
                const logsChannel = await bot.channels.fetch(conf.logs_more_tables);
                if (logsChannel?.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setColor(0x3498db)
                        .setTitle('🚗 Nouveau véhicule enregistré')
                        .setDescription(`**${modele}** - Plaque: **${plaque.toUpperCase()}**`)
                        .addFields(
                            { name: 'ID', value: `#${newVehicule.id}`, inline: true },
                            { name: 'Modèle', value: modele, inline: true },
                            { name: 'Plaque', value: plaque.toUpperCase(), inline: true },
                            { name: 'Couleur', value: couleur || 'Non renseignée', inline: true },
                            { name: 'Propriétaire', value: proprietaireInfo, inline: true },
                            { name: 'Mandat actif', value: mandat_actif ? '⚠️ Oui' : 'Non', inline: true },
                            { name: 'Créé par', value: `<@${user.id}> (${createdBy})`, inline: false }
                        )
                        .setFooter({
                            text: 'LSPD Assistant',
                            iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 })
                        })
                        .setTimestamp();

                    if (photo) {
                        embed.setThumbnail(photo);
                    }

                    await logsChannel.send({ embeds: [embed] });
                }
            } catch (logError) {
                console.error('Erreur lors de l\'envoi du log Discord:', logError);
            }
        }

        res.status(201).json(newVehicule);
    } catch (error) {
        console.error('Erreur lors de la création du véhicule:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la création du véhicule' });
    }
});

// PUT /api/vehicules/:id - Mettre à jour un véhicule
router.put('/api/vehicules/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            modele,
            plaque,
            couleur,
            proprietaire_id,
            mandat_actif,
            photo
        } = req.body;

        // Validation des champs requis
        if (!modele || !plaque) {
            return res.status(400).json({ error: 'Le modèle et la plaque sont requis' });
        }

        const user = req.user;
        const updatedBy = user.guild_member?.nick || user.displayName || user.username;

        // Vérifier si le véhicule existe
        const { rows: existingRows } = await pool.query('SELECT * FROM vehicules WHERE id = $1', [id]);
        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Véhicule non trouvé' });
        }

        const oldVehicule = existingRows[0];

        // Vérifier si la plaque existe déjà (sauf pour ce véhicule)
        const { rows: existingPlaque } = await pool.query(
            'SELECT id FROM vehicules WHERE LOWER(plaque) = LOWER($1) AND id != $2',
            [plaque, id]
        );

        if (existingPlaque.length > 0) {
            return res.status(400).json({ error: 'Cette plaque d\'immatriculation existe déjà' });
        }

        // Vérifier que le propriétaire existe si fourni
        if (proprietaire_id) {
            const { rows: citoyenRows } = await pool.query(
                'SELECT id FROM citoyens WHERE id = $1',
                [proprietaire_id]
            );
            if (citoyenRows.length === 0) {
                return res.status(400).json({ error: 'Propriétaire introuvable' });
            }
        }

        const { rows } = await pool.query(
            `UPDATE vehicules 
            SET modele = $1, plaque = $2, couleur = $3, proprietaire_id = $4, 
                mandat_actif = $5, photo = $6, updated_by = $7, updated_at = NOW()
            WHERE id = $8
            RETURNING *`,
            [
                modele,
                plaque.toUpperCase(),
                couleur || null,
                proprietaire_id || null,
                mandat_actif || false,
                photo || null,
                updatedBy,
                id
            ]
        );

        const updatedVehicule = rows[0];

        // Logs Discord
        const conf = await config.getConfig();
        if (conf.logs_more_tables) {
            try {
                const logsChannel = await bot.channels.fetch(conf.logs_more_tables);
                if (logsChannel?.isTextBased()) {
                    const changes = [];
                    if (oldVehicule.modele !== modele) changes.push(`Modèle: ${oldVehicule.modele} → ${modele}`);
                    if (oldVehicule.plaque !== plaque.toUpperCase()) changes.push(`Plaque: ${oldVehicule.plaque} → ${plaque.toUpperCase()}`);
                    if (oldVehicule.couleur !== couleur) changes.push(`Couleur: ${oldVehicule.couleur || 'Aucune'} → ${couleur || 'Aucune'}`);
                    if (oldVehicule.proprietaire_id !== proprietaire_id) changes.push(`Propriétaire modifié`);
                    if (oldVehicule.mandat_actif !== mandat_actif) changes.push(`Mandat actif: ${oldVehicule.mandat_actif ? 'Oui' : 'Non'} → ${mandat_actif ? 'Oui' : 'Non'}`);

                    if (changes.length > 0) {
                        const embed = new EmbedBuilder()
                            .setColor(0xe67e22)
                            .setTitle('✏️ Véhicule modifié')
                            .setDescription(`**${modele}** - Plaque: **${plaque.toUpperCase()}**`)
                            .addFields(
                                { name: 'ID', value: `#${id}`, inline: true },
                                { name: 'Modifications', value: changes.join('\n'), inline: false },
                                { name: 'Modifié par', value: `<@${user.id}> (${updatedBy})`, inline: false }
                            )
                            .setFooter({
                                text: 'LSPD Assistant',
                                iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 })
                            })
                            .setTimestamp();

                        await logsChannel.send({ embeds: [embed] });
                    }
                }
            } catch (logError) {
                console.error('Erreur lors de l\'envoi du log Discord:', logError);
            }
        }

        res.json(updatedVehicule);
    } catch (error) {
        console.error('Erreur lors de la mise à jour du véhicule:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la mise à jour du véhicule' });
    }
});

// PUT /api/vehicules/:id/notes - Mettre à jour les notes d'un véhicule
router.put('/api/vehicules/:id/notes', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const user = req.user;
        const updatedBy = user.guild_member?.nick || user.displayName || user.username;

        // Vérifier si le véhicule existe
        const { rows: existingRows } = await pool.query('SELECT * FROM vehicules WHERE id = $1', [id]);
        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Véhicule non trouvé' });
        }

        const { rows } = await pool.query(
            `UPDATE vehicules 
            SET notes = $1, updated_by = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING *`,
            [notes || null, updatedBy, id]
        );

        res.json(rows[0]);
    } catch (error) {
        console.error('Erreur lors de la mise à jour des notes:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la mise à jour des notes' });
    }
});

// DELETE /api/vehicules/:id - Supprimer un véhicule
router.delete('/api/vehicules/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // Vérifier si le véhicule existe
        const { rows: existingRows } = await pool.query(`
            SELECT v.*, c.nom as proprietaire_nom, c.prenom as proprietaire_prenom
            FROM vehicules v
            LEFT JOIN citoyens c ON v.proprietaire_id = c.id
            WHERE v.id = $1
        `, [id]);

        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Véhicule non trouvé' });
        }

        const vehicule = existingRows[0];
        await pool.query('DELETE FROM vehicules WHERE id = $1', [id]);

        // Logs Discord
        const conf = await config.getConfig();
        if (conf.logs_more_tables) {
            try {
                const logsChannel = await bot.channels.fetch(conf.logs_more_tables);
                if (logsChannel?.isTextBased()) {
                    const user = req.user;
                    const deletedBy = user.guild_member?.nick || user.displayName || user.username;

                    const proprietaireInfo = vehicule.proprietaire_nom
                        ? `${vehicule.proprietaire_nom} ${vehicule.proprietaire_prenom}`
                        : 'Aucun';

                    const embed = new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setTitle('🗑️ Véhicule supprimé')
                        .setDescription(`**${vehicule.modele}** - Plaque: **${vehicule.plaque}**`)
                        .addFields(
                            { name: 'ID', value: `#${vehicule.id}`, inline: true },
                            { name: 'Propriétaire', value: proprietaireInfo, inline: true },
                            { name: 'Supprimé par', value: `<@${user.id}> (${deletedBy})`, inline: false }
                        )
                        .setFooter({
                            text: 'LSPD Assistant',
                            iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 })
                        })
                        .setTimestamp();

                    await logsChannel.send({ embeds: [embed] });
                }
            } catch (logError) {
                console.error('Erreur lors de l\'envoi du log Discord:', logError);
            }
        }

        res.json({ message: 'Véhicule supprimé avec succès' });
    } catch (error) {
        console.error('Erreur lors de la suppression du véhicule:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la suppression du véhicule' });
    }
});

module.exports = router;
