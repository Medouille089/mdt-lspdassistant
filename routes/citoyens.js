const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const bot = require("../config/bot");
const config = require("../config/config");
const { checkAuth } = require("../config/middleware");
const { EmbedBuilder } = require("discord.js");
const {
    cacheCitoyens,
    cacheCitoyenDetail,
    invalidateCitoyensCache,
    invalidateCitoyenCache
} = require("../config/cacheMiddleware");

// GET /api/citoyens - Liste de tous les citoyens
router.get('/api/citoyens', checkAuth, cacheCitoyens(), async (req, res) => {
    try {
        const { search, mandat_actif, limit = 50, offset = 0 } = req.query;

        let query = 'SELECT * FROM citoyens WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        // Filtre de recherche (nom, prénom, téléphone)
        if (search) {
            query += ` AND (LOWER(nom) LIKE $${paramIndex} OR LOWER(prenom) LIKE $${paramIndex} OR telephone LIKE $${paramIndex})`;
            params.push(`%${search.toLowerCase()}%`);
            paramIndex++;
        }

        // Filtre mandat actif
        if (mandat_actif !== undefined) {
            query += ` AND mandat_actif = $${paramIndex}`;
            params.push(mandat_actif === 'true');
            paramIndex++;
        }

        // Order by
        query += ' ORDER BY created_at DESC';

        // Pagination
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const { rows } = await pool.query(query, params);

        // Compter le total pour la pagination
        let countQuery = 'SELECT COUNT(*) FROM citoyens WHERE 1=1';
        const countParams = [];
        let countParamIndex = 1;

        if (search) {
            countQuery += ` AND (LOWER(nom) LIKE $${countParamIndex} OR LOWER(prenom) LIKE $${countParamIndex} OR telephone LIKE $${countParamIndex})`;
            countParams.push(`%${search.toLowerCase()}%`);
            countParamIndex++;
        }

        if (mandat_actif !== undefined) {
            countQuery += ` AND mandat_actif = $${countParamIndex}`;
            countParams.push(mandat_actif === 'true');
        }

        const { rows: countRows } = await pool.query(countQuery, countParams);
        const total = parseInt(countRows[0].count);

        res.json({
            citoyens: rows,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des citoyens:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération des citoyens' });
    }
});

// GET /api/citoyens/:id - Détails d'un citoyen
router.get('/api/citoyens/:id', checkAuth, cacheCitoyenDetail(), async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query(`
            SELECT id, nom, prenom, date_naissance, nationalite, genre, telephone, adresse, gang_affilie, note_interne, emploi, mandat_actif, photo, created_at, updated_at, created_by, updated_by,
                permis_A, permis_B, permis_C, permis_PPA, permis_BRAVO, permis_ASD
            FROM citoyens
            WHERE id = $1
        `, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Citoyen non trouvé' });
        }
        const citoyen = rows[0];
        citoyen.permis_A = !!citoyen.permis_A;
        citoyen.permis_B = !!citoyen.permis_B;
        citoyen.permis_C = !!citoyen.permis_C;
        citoyen.permis_PPA = !!citoyen.permis_PPA;
        citoyen.permis_BRAVO = !!citoyen.permis_BRAVO;
        citoyen.permis_ASD = !!citoyen.permis_ASD;
        res.json(citoyen);
    } catch (error) {
        console.error('Erreur lors de la récupération du citoyen:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération du citoyen' });
    }
});

// POST /api/citoyens - Créer un nouveau citoyen
router.post('/api/citoyens', checkAuth, async (req, res) => {
    try {
        const {
            nom,
            prenom,
            date_naissance,
            nationalite,
            genre,
            telephone,
            emploi,
            adresse,
            gang_affilie,
            note_interne,
            mandat_actif,
            photo,
            created_by,
            permis_A,
            permis_B,
            permis_C,
            permis_PPA,
            permis_BRAVO,
            permis_ASD,
            note
        } = req.body;

        // Validation des champs requis
        if (!nom || !prenom || !date_naissance || !nationalite || !genre) {
            return res.status(400).json({ error: 'Champs requis manquants' });
        }

        const user = req.user;
        const createdBy = created_by || user.guild_member?.nick || user.displayName || user.username;

        const { rows } = await pool.query(
            `INSERT INTO citoyens 
            (nom, prenom, date_naissance, nationalite, genre, telephone, emploi, adresse, gang_affilie, note_interne, mandat_actif, photo, created_by, created_at, updated_at,
            permis_A, permis_B, permis_C, permis_PPA, permis_BRAVO, permis_ASD, note)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), $14, $15, $16, $17, $18, $19, $20)
            RETURNING *`,
            [
                nom,
                prenom,
                date_naissance,
                nationalite,
                genre,
                telephone || null,
                emploi || null,
                adresse || null,
                gang_affilie || null,
                note_interne || null,
                mandat_actif || false,
                photo || null,
                createdBy,
                !!permis_A,
                !!permis_B,
                !!permis_C,
                !!permis_PPA,
                !!permis_BRAVO,
                !!permis_ASD,
                note || null
            ]
        );

        const newCitoyen = rows[0];

        // Logs Discord
        const conf = await config.getConfig();
        if (conf.logs_more_tables) {
            try {
                const logsChannel = await bot.channels.fetch(conf.logs_more_tables);
                if (logsChannel?.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setColor(0x27ae60)
                        .setTitle('🆕 Nouveau citoyen enregistré')
                        .setDescription(`**${nom} ${prenom}** a été enregistré dans la base de données`)
                        .addFields(
                            { name: 'ID', value: `#${newCitoyen.id}`, inline: true },
                            { name: 'Date de naissance', value: new Date(date_naissance).toLocaleDateString('fr-FR'), inline: true },
                            { name: 'Nationalité', value: nationalite, inline: true },
                            { name: 'Genre', value: genre, inline: true },
                            { name: 'Téléphone', value: telephone || 'Non renseigné', inline: true },
                            { name: 'Emploi', value: emploi || 'Non renseigné', inline: true },
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

        // Invalider le cache
        invalidateCitoyensCache();

        res.status(201).json(newCitoyen);
    } catch (error) {
        console.error('Erreur lors de la création du citoyen:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la création du citoyen' });
    }
});

// PUT /api/citoyens/:id - Mettre à jour un citoyen
router.put('/api/citoyens/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nom,
            prenom,
            date_naissance,
            nationalite,
            genre,
            telephone,
            emploi,
            adresse,
            gang_affilie,
            note_interne,
            mandat_actif,
            photo,
            permis_A,
            permis_B,
            permis_C,
            permis_PPA,
            permis_BRAVO,
            permis_ASD,
            note
        } = req.body;

        // Validation des champs requis
        if (!nom || !prenom || !date_naissance || !nationalite || !genre) {
            return res.status(400).json({ error: 'Champs requis manquants' });
        }

        const user = req.user;
        const updatedBy = user.guild_member?.nick || user.displayName || user.username;

        // Vérifier si le citoyen existe
        const { rows: existingRows } = await pool.query('SELECT * FROM citoyens WHERE id = $1', [id]);
        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Citoyen non trouvé' });
        }

        const oldCitoyen = existingRows[0];

        const { rows } = await pool.query(
            `UPDATE citoyens 
            SET nom = $1, prenom = $2, date_naissance = $3, nationalite = $4, genre = $5, 
                telephone = $6, emploi = $7, adresse = $8, gang_affilie = $9, note_interne = $10, mandat_actif = $11, photo = $12, updated_by = $13, updated_at = NOW(),
                permis_A = $14, permis_B = $15, permis_C = $16, permis_PPA = $17, permis_BRAVO = $18, permis_ASD = $19, note = $20
            WHERE id = $21
            RETURNING *`,
            [
                nom,
                prenom,
                date_naissance,
                nationalite,
                genre,
                telephone || null,
                emploi || null,
                adresse || null,
                gang_affilie || null,
                note_interne || null,
                mandat_actif || false,
                photo || null,
                updatedBy,
                !!permis_A,
                !!permis_B,
                !!permis_C,
                !!permis_PPA,
                !!permis_BRAVO,
                !!permis_ASD,
                note || null,
                id
            ]
        );
// DELETE /api/citoyens/:id - Supprimer un citoyen
router.delete('/api/citoyens/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query('DELETE FROM citoyens WHERE id = $1 RETURNING *', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Citoyen non trouvé' });
        }
        invalidateCitoyensCache();
        res.json({ success: true, deleted: rows[0] });
    } catch (error) {
        console.error('Erreur lors de la suppression du citoyen:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la suppression du citoyen' });
    }
});

        const updatedCitoyen = rows[0];

        // Logs Discord
        const conf = await config.getConfig();
        if (conf.logs_more_tables) {
            try {
                const logsChannel = await bot.channels.fetch(conf.logs_more_tables);
                if (logsChannel?.isTextBased()) {
                    const changes = [];
                    if (oldCitoyen.nom !== nom) changes.push(`Nom: ${oldCitoyen.nom} → ${nom}`);
                    if (oldCitoyen.prenom !== prenom) changes.push(`Prénom: ${oldCitoyen.prenom} → ${prenom}`);
                    if (oldCitoyen.telephone !== telephone) changes.push(`Téléphone: ${oldCitoyen.telephone || 'vide'} → ${telephone || 'vide'}`);
                    if (oldCitoyen.emploi !== emploi) changes.push(`Emploi: ${oldCitoyen.emploi || 'vide'} → ${emploi || 'vide'}`);
                    if (oldCitoyen.mandat_actif !== mandat_actif) changes.push(`Mandat: ${oldCitoyen.mandat_actif ? 'Oui' : 'Non'} → ${mandat_actif ? 'Oui' : 'Non'}`);

                    const embed = new EmbedBuilder()
                        .setColor(0xf39c12)
                        .setTitle('📝 Citoyen modifié')
                        .setDescription(`**${nom} ${prenom}** (#${id}) a été modifié`)
                        .addFields(
                            { name: 'Modifié par', value: `<@${user.id}> (${updatedBy})`, inline: false },
                            { name: 'Changements', value: changes.length > 0 ? changes.join('\n') : 'Aucun changement détecté', inline: false }
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

        // Invalider le cache de ce citoyen et des listes
        invalidateCitoyenCache(id);

        res.json(updatedCitoyen);
    } catch (error) {
        console.error('Erreur lors de la mise à jour du citoyen:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la mise à jour du citoyen' });
    }
});

// DELETE /api/citoyens/:id - Supprimer un citoyen
router.delete('/api/citoyens/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // Vérifier si le citoyen existe
        const { rows: existingRows } = await pool.query('SELECT * FROM citoyens WHERE id = $1', [id]);
        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Citoyen non trouvé' });
        }

        const citoyen = existingRows[0];
        await pool.query('DELETE FROM citoyens WHERE id = $1', [id]);

        // Logs Discord
        const conf = await config.getConfig();
        if (conf.logs_more_tables) {
            try {
                const logsChannel = await bot.channels.fetch(conf.logs_more_tables);
                if (logsChannel?.isTextBased()) {
                    const user = req.user;
                    const deletedBy = user.guild_member?.nick || user.displayName || user.username;

                    const embed = new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setTitle('🗑️ Citoyen supprimé')
                        .setDescription(`**${citoyen.nom} ${citoyen.prenom}** (#${id}) a été supprimé de la base de données`)
                        .addFields(
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

        // Invalider le cache
        invalidateCitoyensCache();

        res.json({ message: 'Citoyen supprimé avec succès' });
    } catch (error) {
        console.error('Erreur lors de la suppression du citoyen:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la suppression du citoyen' });
    }
});

module.exports = router;
