const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { AttachmentBuilder } = require('discord.js');
const { getBot, getConfig } = require('../config/config');
const pool = require('../config/db');

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

// POST /api/calcul-peine - Sauvegarder un calcul
router.post('/calcul-peine', async (req, res) => {
    const { citizen_id, details, total_amende, total_peine } = req.body;
    const officer_id = req.user ? req.user.id : 'Unknown';

    try {
        const result = await pool.query(
            `INSERT INTO calcul_peine (citizen_id, officer_id, details, total_amende, total_peine)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [citizen_id || null, officer_id, JSON.stringify(details), total_amende, total_peine]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Erreur sauvegarde calcul peine:', err);
        res.status(500).json({ error: 'Erreur serveur lors de la sauvegarde' });
    }
});

// GET /api/calcul-peine - Lister les calculs (filtre optionnel par citoyen)
router.get('/calcul-peine', async (req, res) => {
    const { citizen_id } = req.query;
    let query = `
        SELECT cp.*, c.nom, c.prenom 
        FROM calcul_peine cp
        LEFT JOIN citoyens c ON cp.citizen_id = c.id
    `;
    const params = [];
    
    if (citizen_id) {
        query += ` WHERE cp.citizen_id = $1`;
        params.push(citizen_id);
    }
    
    query += ` ORDER BY cp.date DESC LIMIT 50`;

    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Erreur récupération calculs peine:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /api/calcul-peine/:id - Supprimer un calcul (Command Staff uniquement)
router.delete('/calcul-peine/:id', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });

    try {
        // Vérification Command Staff
        const config = getConfig();
        const commandStaffRoleId = config.commandstaff_id;
        
        const bot = getBot();
        const guild = await bot.guilds.fetch(require('../config/env').GUILD_ID);
        const member = await guild.members.fetch(req.user.id);
        
        const isCommandStaff = member.roles.cache.has(commandStaffRoleId);

        if (!isCommandStaff) {
            return res.status(403).json({ error: 'Permission refusée (Command Staff requis)' });
        }

        await pool.query('DELETE FROM calcul_peine WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Erreur suppression calcul peine:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.post('/exportCalculPeines', upload.single('screenshot'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Aucune image fournie' });
        }
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: 'Utilisateur non authentifié' });
        }

        const discordClient = getBot();

        if (!discordClient || !discordClient.isReady()) {
            return res.status(503).json({ message: 'Le bot Discord n\'est pas connecté' });
        }

        const discordUser = await discordClient.users.fetch(req.user.id);

        if (!discordUser) {
            return res.status(404).json({ message: 'Utilisateur Discord non trouvé' });
        }

        const attachment = new AttachmentBuilder(req.file.buffer, {
            name: 'calcul-peines.png'
        });

        await discordUser.send({
            content: '📊 **Calcul de peines exporté**\n\nVoici le récapitulatif complet de vos délits enregistrés avec les totaux et peines calculées :',
            files: [attachment]
        });

        res.json({
            success: true,
            message: 'Screenshot envoyé avec succès via Discord DM'
        });

    } catch (error) {
        console.error('Erreur lors de l\'export du calcul de peines:', error);

        if (error.code === 50007) {
            return res.status(403).json({
                message: 'Impossible d\'envoyer un DM. Vérifiez que vos DMs sont ouverts.'
            });
        }

        res.status(500).json({
            message: 'Erreur lors de l\'envoi du calcul de peines',
            error: error.message
        });
    }
});

module.exports = router;
