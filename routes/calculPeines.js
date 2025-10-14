const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { AttachmentBuilder } = require('discord.js');
const { getBot } = require('../config/config');

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
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
