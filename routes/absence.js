const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { createForumPost } = require('../utils/createForumPost');
const { getBot, getConfig } = require('../config/config');
const { checkAuth } = require('../config/middleware');
const { EmbedBuilder } = require("discord.js");
const { cache } = require('../config/cache');

router.get('/api/absence', checkAuth, async (req, res) => {
    try {
        const cacheKey = 'absence:all';
        const cachedData = cache.get(cacheKey);

        if (cachedData) {
            return res.json(cachedData);
        }


        const query = `
            SELECT 
                id,
                officier,
                grade,
                date_debut,
                date_fin,
                heure_debut,
                heure_fin,
                type_absence,
                motif,
                justificatif,
                statut,
                date_creation,
                date_modification
            FROM absences 
            ORDER BY date_creation DESC
        `;

        const result = await db.query(query);

        cache.set(cacheKey, result.rows, 180);

        res.json(result.rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des absences:', error);
        res.status(500).json({
            error: 'Erreur serveur lors de la récupération des absences',
            details: error.message
        });
    }
});

// Route pour récupérer les absences de l'utilisateur connecté
router.get('/api/absence/mes-absences', checkAuth, async (req, res) => {
    try {
        const userId = req.user?.guild_member.nick;

        const cacheKey = `absence:user:${userId}`;
        const cachedData = cache.get(cacheKey);

        if (cachedData) {
            return res.json(cachedData);
        }

        const query = `
            SELECT 
                id,
                officier,
                grade,
                date_debut,
                date_fin,
                heure_debut,
                heure_fin,
                type_absence,
                motif,
                justificatif,
                statut,
                date_creation,
                date_modification
            FROM absences 
            WHERE officier = ?
            ORDER BY date_creation DESC
        `;

        const result = await db.query(query, [userId]);
        cache.set(cacheKey, result.rows, 180);

        res.json(result.rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des absences utilisateur:', error);
        res.status(500).json({
            error: 'Erreur serveur lors de la récupération de vos absences',
            details: error.message
        });
    }
});

router.get('/api/absence/periode/:debut/:fin', async (req, res) => {
    try {
        const { debut, fin } = req.params;

        const query = `
            SELECT 
                id,
                officier,
                grade,
                date_debut,
                date_fin,
                heure_debut,
                heure_fin,
                type_absence,
                motif,
                justificatif,
                statut,
                date_creation
            FROM absences 
            WHERE (date_debut BETWEEN ? AND ?) 
               OR (date_fin BETWEEN ? AND ?)
               OR (date_debut <= ? AND date_fin >= ?)
            ORDER BY date_debut ASC
        `;

        const result = await db.query(query, [debut, fin, debut, fin, debut, fin]);
        res.json(result.rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des absences par période:', error);
        res.status(500).json({
            error: 'Erreur serveur lors de la récupération des absences',
            details: error.message
        });
    }
});

router.post('/api/absence', async (req, res) => {
    try {
        const {
            officier,
            grade,
            dateDebut,
            dateFin,
            heureDebut,
            heureFin,
            typeAbsence,
            motif,
            justificatif
        } = req.body;

        if (!officier || !grade || !dateDebut || !dateFin || !typeAbsence || !motif) {
            return res.status(400).json({
                error: 'Données manquantes',
                message: 'Tous les champs obligatoires doivent être remplis'
            });
        }

        if (new Date(dateFin) < new Date(dateDebut)) {
            return res.status(400).json({
                error: 'Dates invalides',
                message: 'La date de fin ne peut pas être antérieure à la date de début'
            });
        }

        const query = `
            INSERT INTO absences (
                officier,
                grade,
                date_debut,
                date_fin,
                heure_debut,
                heure_fin,
                type_absence,
                motif,
                justificatif,
                statut,
                date_creation,
                date_modification
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en_attente', NOW(), NOW()
            )
        `;

        const values = [
            officier,
            grade,
            dateDebut,
            dateFin,
            heureDebut || null,
            heureFin || null,
            typeAbsence,
            motif,
            justificatif || false
        ];

        const result = await db.query(query, values);
        const insertId = result.insertId;
        const selectResult = await db.query('SELECT * FROM absences WHERE id = ?', [insertId]);
        const nouvelleAbsence = selectResult.rows[0];
        const bot = getBot();
        const conf = getConfig();
        const logsChannelId = conf.logs_calendrier;

        try {
            const discordMessage = new EmbedBuilder()
                .setColor(0x0b1b5a)
                .setTitle(`Nouvelle demande d'absence`)
                .setDescription(`${req.user?.guild_member.nick || 'Utilisateur inconnu'} a fait une demande d'absence`)
                .addFields({
                    name: "Infos",
                    value: `> Officier: ${nouvelleAbsence.officier} \n> Grade: ${nouvelleAbsence.grade} \n> Type d'absence: ${nouvelleAbsence.type_absence} \n> Motif: ${nouvelleAbsence.motif}`,
                    inline: false
                }, {
                    name: "ID's",
                    value: `> <@${req.user.id}> (${req.user.id}) \n`,
                    inline: false
                })
                .setFooter({
                    text: "LSPD Assistant",
                    iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 })
                })
                .setTimestamp();

            const logsChannel = await bot.channels.fetch(logsChannelId);
            await logsChannel.send({ embeds: [discordMessage] });

        } catch (discordError) {
            console.error('Erreur lors de la notification Discord:', discordError);
        }

        cache.deletePattern('absence:*');

        res.status(201).json({
            message: 'Absence créée avec succès',
            absence: nouvelleAbsence
        });

    } catch (error) {
        console.error('Erreur lors de la création de l\'absence:', error);
        res.status(500).json({
            error: 'Erreur serveur lors de la création de l\'absence',
            details: error.message
        });
    }
});

router.put('/api/absence/:id/statut', async (req, res) => {
    try {
        const { id } = req.params;
        const { statut, commentaire } = req.body;

        const statutsValides = ['en_attente', 'approuve', 'refuse'];
        if (!statutsValides.includes(statut)) {
            return res.status(400).json({
                error: 'Statut invalide',
                message: 'Le statut doit être: en_attente, approuve ou refuse'
            });
        }

        const query = `
            UPDATE absences 
            SET statut = ?, 
                commentaire_admin = ?,
                date_modification = NOW()
            WHERE id = ?
        `;

        const result = await db.query(query, [statut, commentaire || null, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                error: 'Absence non trouvée',
                message: 'Aucune absence trouvée avec cet ID'
            });
        }

        const selectResult = await db.query('SELECT * FROM absences WHERE id = ?', [id]);
        const absenceModifiee = selectResult.rows[0];
        const bot = getBot(); // Ton client Discord
        const conf = getConfig();
        const logsChannelId = conf.logs_calendrier;

        try {
            const statutTexte = {
                'en_attente': 'En attente',
                'approuve': '✅ Approuvée',
                'refuse': '❌ Refusée'
            };

            const couleur = {
                'en_attente': 0xffa500,
                'approuve': 0x00ff00,
                'refuse': 0xff0000
            };

            const discordMessage = new EmbedBuilder()
                .setColor(couleur[statut])
                .setTitle(`Mise à jour d'absence - ID ${absenceModifiee.id}`)
                .setDescription(`${req.user?.guild_member.nick || 'Utilisateur inconnu'} a mis à jour le statut de l'absence.`)
                .addFields(
                    {
                        name: "Infos de l'absence",
                        value: `> Officier: ${absenceModifiee.officier}\n> Grade: ${absenceModifiee.grade}\n> Type: ${absenceModifiee.type_absence}\n> Motif: ${absenceModifiee.motif}\n> Statut: ${statutTexte[statut]}`,
                        inline: false
                    },
                    {
                        name: "ID Discord",
                        value: `> <@${req.user.id}> (${req.user.id})`,
                        inline: false
                    }
                )
                .setFooter({
                    text: "LSPD Assistant",
                    iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 })
                })
                .setTimestamp();

            const logsChannel = await bot.channels.fetch(logsChannelId);
            await logsChannel.send({ embeds: [discordMessage] });

        } catch (discordError) {
            console.error('Erreur lors de la notification Discord:', discordError);
        }

        cache.deletePattern('absence:*');

        res.json({
            message: 'Statut de l\'absence mis à jour avec succès',
            absence: absenceModifiee
        });

    } catch (error) {
        console.error('Erreur lors de la mise à jour du statut:', error);
        res.status(500).json({
            error: 'Erreur serveur lors de la mise à jour du statut',
            details: error.message
        });
    }
});

router.delete('/api/absence/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Récupérer l'absence avant de la supprimer (MySQL n'a pas RETURNING)
        const selectResult = await db.query('SELECT * FROM absences WHERE id = ?', [id]);

        if (selectResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Absence non trouvée',
                message: 'Aucune absence trouvée avec cet ID'
            });
        }

        const absence = selectResult.rows[0];
        await db.query('DELETE FROM absences WHERE id = ?', [id]);

        cache.deletePattern('absence:*');

        res.json({
            message: 'Absence supprimée avec succès',
            absence: absence
        });

    } catch (error) {
        console.error('Erreur lors de la suppression de l\'absence:', error);
        res.status(500).json({
            error: 'Erreur serveur lors de la suppression de l\'absence',
            details: error.message
        });
    }
});

router.get('/api/absence/stats', async (req, res) => {
    try {
        const query = `
            SELECT 
                COUNT(*) as total_absences,
                COUNT(CASE WHEN statut = 'en_attente' THEN 1 END) as en_attente,
                COUNT(CASE WHEN statut = 'approuve' THEN 1 END) as approuvees,
                COUNT(CASE WHEN statut = 'refuse' THEN 1 END) as refusees,
                COUNT(CASE WHEN type_absence = 'conge' THEN 1 END) as conges,
                COUNT(CASE WHEN type_absence = 'maladie' THEN 1 END) as maladies,
                COUNT(CASE WHEN type_absence = 'formation' THEN 1 END) as formations,
                COUNT(CASE WHEN type_absence = 'personnel' THEN 1 END) as personnelles
            FROM absences
            WHERE date_creation >= CURDATE() - INTERVAL 30 DAY
        `;

        const result = await db.query(query);
        res.json(result.rows[0]);

    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques:', error);
        res.status(500).json({
            error: 'Erreur serveur lors de la récupération des statistiques',
            details: error.message
        });
    }
});

module.exports = router;
