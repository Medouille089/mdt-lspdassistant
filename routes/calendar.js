const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { checkAuth } = require('../config/middleware');
const { getConfig } = require('../config/config');
const bot = require('../config/bot');
const { EmbedBuilder } = require('discord.js');
const { GUILD_ID } = require('../config/env');

router.get('/api/calendar/grades', checkAuth, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM lspd_grades LIMIT 1');
        const row = rows[0];

        const grades = [
            { id: row.rookie_role_id, name: 'Cadet' },
            { id: row.officier_1_role_id, name: 'Officier I' },
            { id: row.officier_2_role_id, name: 'Officier II' },
            { id: row.officier_3_role_id, name: 'Officier III' },
            { id: row.slo_role_id, name: 'SLO' },
            { id: row.sergent_1_role_id, name: 'Sergent I' },
            { id: row.sergent_2_role_id, name: 'Sergent II' },
            { id: row.sergent_chef_role_id, name: 'Sergent Chef' },
            { id: row.lieutenant_role_id, name: 'Lieutenant' },
            { id: row.lieutenant_chef_role_id, name: 'Lieutenant Chef' },
            { id: row.capitaine_role_id, name: 'Capitaine' },
            { id: row.commandant_role_id, name: 'Commandant' },
            { id: row.chief_role_id, name: 'Chief' }
        ].filter(g => g.id);

        res.json(grades);
    } catch (error) {
        console.error('Erreur lors de la récupération des grades:', error);
        res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
});

router.get('/api/calendar/members', checkAuth, async (req, res) => {
    try {
        if (!bot.isReady()) {
            return res.status(503).json({ error: 'Bot Discord en cours de démarrage, réessayez dans quelques secondes' });
        }

        const configRes = await db.query("SELECT required_role_id FROM configlspd LIMIT 1");
        const REQUIRED_ROLE = configRes.rows[0]?.required_role_id?.trim();

        if (!REQUIRED_ROLE) {
            return res.json([]);
        }

        if (!GUILD_ID) {
            return res.status(500).json({ error: 'Configuration manquante' });
        }

        const guild = bot.guilds.cache.get(GUILD_ID);

        if (!guild) {
            return res.status(500).json({ error: 'Guild Discord introuvable' });
        }

        try {
            await guild.members.fetch();
        } catch (fetchError) {
            console.error('Erreur lors du fetch des membres:', fetchError);
        }

        const members = [];

        guild.members.cache.forEach(member => {
            if (member.user.bot) return;
            if (!member.roles.cache.has(REQUIRED_ROLE)) return;

            members.push({
                id: member.user.id,
                username: member.user.username,
                displayName: member.displayName,
                avatar: member.user.displayAvatarURL()
            });
        });

        members.sort((a, b) => a.displayName.localeCompare(b.displayName));

        console.log(`${members.length} membres LSPD trouvés`);
        res.json(members);
    } catch (error) {
        console.error('Erreur lors de la récupération des membres:', error);
        res.status(500).json({ error: 'Erreur serveur', details: error.message });
    }
});

// Récupérer tous les événements
router.get('/api/calendar/events', checkAuth, async (req, res) => {
    try {
        const query = `
            SELECT 
                id,
                titre,
                description,
                date_debut,
                date_fin,
                type_evenement,
                couleur,
                auteur,
                participants,
                lieu,
                date_creation,
                date_modification,
                grades_concernes,
                personnes_concernees
            FROM evenements_calendrier 
            ORDER BY date_debut ASC
        `;

        const result = await db.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des événements:', error);
        res.status(500).json({
            error: 'Erreur serveur lors de la récupération des événements',
            details: error.message
        });
    }
});

router.get('/api/calendar/events/periode/:debut/:fin', checkAuth, async (req, res) => {
    try {
        const { debut, fin } = req.params;

        const query = `
            SELECT 
                id,
                titre,
                description,
                date_debut,
                date_fin,
                type_evenement,
                couleur,
                auteur,
                participants,
                lieu,
                date_creation
            FROM evenements_calendrier 
            WHERE (date_debut BETWEEN $1 AND $2) 
               OR (date_fin BETWEEN $1 AND $2)
               OR (date_debut <= $1 AND date_fin >= $2)
            ORDER BY date_debut ASC
        `;

        const result = await db.query(query, [debut, fin]);
        res.json(result.rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des événements par période:', error);
        res.status(500).json({
            error: 'Erreur serveur lors de la récupération des événements',
            details: error.message
        });
    }
});

router.post('/api/calendar/events', checkAuth, async (req, res) => {
    try {
        const {
            titre,
            description,
            dateDebut,
            dateFin,
            heureDebut,
            heureFin,
            typeEvenement,
            couleur,
            lieu,
            auteur,
            gradesConcernes,
            personnesConcernees
        } = req.body;

        if (!titre || !dateDebut || !dateFin || !typeEvenement || !auteur) {
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

        const dateDebutComplete = `${dateDebut} ${heureDebut || '00:00'}`;
        const dateFinComplete = `${dateFin} ${heureFin || '23:59'}`;

        const query = `
            INSERT INTO evenements_calendrier (
                titre,
                description,
                date_debut,
                date_fin,
                type_evenement,
                couleur,
                auteur,
                lieu,
                grades_concernes,
                personnes_concernees
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `;

        const values = [
            titre,
            description,
            dateDebutComplete,
            dateFinComplete,
            typeEvenement,
            couleur || '#3498db',
            auteur,
            lieu,
            gradesConcernes || null,
            personnesConcernees || null
        ];

        const result = await db.query(query, values);
        const newEvent = result.rows[0];

        // Envoyer un log Discord
        try {
            await sendEventLog(newEvent, 'creation');
        } catch (logError) {
            console.error('Erreur lors de l\'envoi du log Discord:', logError);
        }

        res.status(201).json({
            success: true,
            message: 'Événement créé avec succès',
            event: newEvent
        });

    } catch (error) {
        console.error('Erreur lors de la création de l\'événement:', error);
        res.status(500).json({
            error: 'Erreur serveur lors de la création de l\'événement',
            details: error.message
        });
    }
});

router.put('/api/calendar/events/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            titre,
            description,
            dateDebut,
            dateFin,
            heureDebut,
            heureFin,
            typeEvenement,
            couleur,
            lieu
        } = req.body;

        const dateDebutComplete = `${dateDebut} ${heureDebut || '00:00'}`;
        const dateFinComplete = `${dateFin} ${heureFin || '23:59'}`;

        const query = `
            UPDATE evenements_calendrier 
            SET 
                titre = $1,
                description = $2,
                date_debut = $3,
                date_fin = $4,
                type_evenement = $5,
                couleur = $6,
                lieu = $7,
                date_modification = CURRENT_TIMESTAMP
            WHERE id = $8
            RETURNING *
        `;

        const values = [
            titre,
            description,
            dateDebutComplete,
            dateFinComplete,
            typeEvenement,
            couleur,
            lieu,
            id
        ];

        const result = await db.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Événement non trouvé'
            });
        }

        const updatedEvent = result.rows[0];

        try {
            await sendEventLog(updatedEvent, 'modification');
        } catch (logError) {
            console.error('Erreur lors de l\'envoi du log Discord:', logError);
        }

        res.json({
            success: true,
            message: 'Événement mis à jour avec succès',
            event: updatedEvent
        });

    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'événement:', error);
        res.status(500).json({
            error: 'Erreur serveur lors de la mise à jour de l\'événement',
            details: error.message
        });
    }
});

router.delete('/api/calendar/events/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const selectQuery = 'SELECT * FROM evenements_calendrier WHERE id = $1';
        const selectResult = await db.query(selectQuery, [id]);

        if (selectResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Événement non trouvé'
            });
        }

        const deletedEvent = selectResult.rows[0];

        const deleteQuery = 'DELETE FROM evenements_calendrier WHERE id = $1';
        await db.query(deleteQuery, [id]);

        try {
            await sendEventLog(deletedEvent, 'suppression');
        } catch (logError) {
            console.error('Erreur lors de l\'envoi du log Discord:', logError);
        }

        res.json({
            success: true,
            message: 'Événement supprimé avec succès'
        });

    } catch (error) {
        console.error('Erreur lors de la suppression de l\'événement:', error);
        res.status(500).json({
            error: 'Erreur serveur lors de la suppression de l\'événement',
            details: error.message
        });
    }
});

async function sendEventLog(event, action) {
    try {
        const conf = await getConfig();
        if (!conf.logs_channel_calendrier) {
            console.log('Canal de logs calendrier non configuré');
            return;
        }

        const logsChannel = await bot.channels.fetch(conf.logs_channel_calendrier);
        if (!logsChannel?.isTextBased()) {
            console.log('Canal de logs calendrier invalide');
            return;
        }

        const colors = {
            'creation': 0x4caf50,
            'modification': 0xff9800,
            'suppression': 0xf44336
        };

        const titles = {
            'creation': '➕ Nouvel événement créé',
            'modification': '✏️ Événement modifié',
            'suppression': '🗑️ Événement supprimé'
        };

        const embed = new EmbedBuilder()
            .setColor(colors[action] || 0x3498db)
            .setTitle(titles[action] || 'Événement')
            .setTimestamp()
            .setFooter({
                text: 'LSPD Assistant - Calendrier',
                iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 })
            })
            .addFields(
                { name: 'Titre', value: event.titre, inline: false },
                { name: 'Type', value: event.type_evenement, inline: true },
                { name: 'Auteur', value: event.auteur, inline: true }
            );

        if (event.date_debut && event.date_fin) {
            const dateDebut = new Date(event.date_debut).toLocaleString('fr-FR');
            const dateFin = new Date(event.date_fin).toLocaleString('fr-FR');
            embed.addFields({
                name: 'Période',
                value: `Du ${dateDebut}\nAu ${dateFin}`,
                inline: false
            });
        }

        if (event.lieu) {
            embed.addFields({ name: 'Lieu', value: event.lieu, inline: true });
        }

        if (event.description) {
            embed.addFields({
                name: 'Description',
                value: event.description.substring(0, 1024),
                inline: false
            });
        }

        await logsChannel.send({ embeds: [embed] });

    } catch (error) {
        console.error('Erreur lors de l\'envoi du log Discord:', error);
    }
}

module.exports = router;
