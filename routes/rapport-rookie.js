const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { getBot, getConfig } = require('../config/config');
const { EmbedBuilder } = require('discord.js');
const { checkAuth } = require('../config/middleware');

const LOGS_CHANNEL_ID = '1409873897654063265';

// Helper → formatage des dates en JJ/MM/AAAA
function formatDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR');
}

// routes/rapport-rookie.js
router.get('/api/agents-rookie', async (req, res) => {
    try {
        const bot = getBot();
        if (!bot?.isReady()) return res.status(500).json({ error: "Bot Discord non connecté" });

        const guild = await bot.guilds.fetch(process.env.GUILD_ID);
        if (!guild) return res.status(500).json({ error: "Guild introuvable" });

        // Récupérer le rookie_role_id en BDD
        const { rows } = await pool.query(`SELECT rookie_role_id FROM lspd_grades LIMIT 1`);
        if (!rows.length) return res.status(500).json({ error: "Aucun rookie_role_id trouvé" });

        const rookieRoleId = rows[0].rookie_role_id;
        const role = guild.roles.cache.get(rookieRoleId);
        if (!role) return res.status(500).json({ error: "Rôle Discord introuvable" });

        await guild.members.fetch();
        const rookies = role.members.map(m => ({
            discord_id: m.user.id,
            username: m.displayName,
        }));

        res.json(rookies);
    } catch (err) {
        console.error("Erreur API /agents:", err);
        res.status(500).json({ error: 'Erreur lors de la récupération des rookies' });
    }
});

// routes/rapport-rookie.js
router.post('/api/rapport-rookie', checkAuth, async (req, res) => {
    try {
        const {
            agent, conduite, radio, procedures, ville,
            trello, mdt, hierarchie, attitude, appreciation,
            officier, grade
        } = req.body;

        const bot = getBot();
        if (!bot?.isReady()) return res.status(500).json({ error: "Bot Discord non connecté" });

        const guild = await bot.guilds.fetch(process.env.GUILD_ID);
        if (!guild) return res.status(500).json({ error: "Guild introuvable" });

        const member = await guild.members.fetch(agent);

        // Récupérer la configuration pour choper le channel
        const config = getConfig();
        const reportChannelId = config.rapport_rookie_channel_id;
        if (!reportChannelId) return res.status(500).json({ error: "ID du channel de rapport rookie introuvable" });

        // Embed principal pour le rapport
        const embed = new EmbedBuilder()
            .setColor(0x0b1b5a) // bleu
            .setTitle("Rapport Rookie")
            .addFields(
                { name: "Rapport sur", value: `${member.displayName}`, inline: false },
                { name: "Agent qui rédige", value: officier || "Inconnu", inline: true },
                { name: "Grade", value: grade || "Grade inconnu", inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: "Conduite", value: conduite || "⚪️", inline: false },
                { name: "Radio", value: radio || "⚪️", inline: true },
                { name: "Procédures", value: procedures || "⚪️", inline: false },
                { name: "Connaissance de la ville", value: ville || "⚪️", inline: false },
                { name: "Trello", value: trello || "⚪️", inline: false },
                { name: "MDT", value: mdt || "⚪️", inline: false },
                { name: "Connaissance de la Hiérarchie", value: hierarchie || "⚪️", inline: false },
                { name: "Attitude", value: attitude || "Non renseigné", inline: false },
                { name: "Appréciation Globale", value: appreciation || "Non renseigné", inline: false }
            )
            .setThumbnail(bot.user.displayAvatarURL())
            .setFooter({ text: "LSPD Assistant", iconURL: bot.user.displayAvatarURL() })
            .setTimestamp();

        const channel = await bot.channels.fetch(reportChannelId);
        if (!channel) return res.status(500).json({ error: "Salon de rapport introuvable" });

        const sentMessage = await channel.send({ embeds: [embed] });

        const authorId = req.user.id; 

        const logEmbed = new EmbedBuilder()
            .setColor(0x0b1b5a)
            .setTitle("Nouveau rapport rookie")
            .setDescription(`${officier || "Un agent"} a soumis un nouveau rapport pour ${member.displayName}`)
            .addFields(
                {
                    name: "ID's",
                    value: `> <@${authorId}> (\`${authorId}\`)\n> <@${member.id}> (\`${member.id}\`)\n> ${sentMessage.url}`,
                    inline: false
                }
            )
            .setFooter({ text: "LSPD Assistant", iconURL: bot.user.displayAvatarURL() })
            .setTimestamp();

        const logChannelId = config.logs_channel;
        if (logChannelId) {
            const logChannel = await bot.channels.fetch(logChannelId);
            if (logChannel) await logChannel.send({ embeds: [logEmbed] });
        }

        res.json({ success: true, message: "Rapport envoyé avec succès !" });

    } catch (err) {
        console.error("Erreur POST /rapport-rookie:", err);
        res.status(500).json({ error: "Impossible d’envoyer le rapport" });
    }
});

module.exports = router;