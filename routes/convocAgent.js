const express = require('express');
const router = express.Router();
const { getBot, getConfig } = require('../config/config');
const { EmbedBuilder } = require('discord.js');

// Helper → formatage date en JJ/MM/AAAA
function formatDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return "N/A";
    return d.toLocaleDateString('fr-FR');
}

router.post('/api/convocations', async (req, res) => {
    try {
        const { agentId, date, lieu, raison, officier, grade } = req.body;
        if (!agentId || !date || !lieu || !raison) 
            return res.status(400).json({ error: "Champs obligatoires manquants" });

        const bot = getBot();
        const guild = await bot.guilds.fetch(process.env.GUILD_ID);
        const member = await guild.members.fetch(agentId).catch(() => null);

        const agentName = member?.displayName || "Utilisateur inconnu";
        const formattedDate = formatDate(date);

        // --- MP Discord ---
        if (member) {
            const embed = new EmbedBuilder()
                .setTitle('Convocation')
                .addFields(
                    { name: 'Agent convoqué', value: agentName },
                    { name: 'Date', value: formattedDate, inline: true },
                    { name: 'Lieu', value: lieu, inline: true },
                    { name: 'Raison', value: raison },
                    { name: 'Agent convoquant', value: officier, inline: true },
                    { name: 'Grade', value: grade, inline: true }
                )
                .setColor(0x0b1b5a)
                .setFooter({ text: 'LSPD Assistant', iconURL: bot.user.displayAvatarURL() })
                .setTimestamp();

            await member.send({ embeds: [embed] }).catch(() => console.log('MP impossible'));
        }

        // --- Log Discord ---
        const config = getConfig();
        const logsChannelId = config.logs_channel;
        if (logsChannelId) {
            const logsChannel = await guild.channels.fetch(logsChannelId).catch(() => null);
            if (logsChannel?.isTextBased()) {
                const embedLog = new EmbedBuilder()
                    .setTitle(`Nouvelle convocation - ${agentName}`)
                    .setDescription(`${officier} a convoqué ${agentName}`)
                    .addFields([
                        { name: 'Date', value: formattedDate },
                        { name: 'Lieu', value: lieu },
                        { name: 'Raison', value: raison },
                        { name: 'Grade', value: grade },
                        { 
                            name: "ID's",
                            value: `> Convoqueur : <@${req.user?.id || "inconnu"}> (\`${req.user?.id || "inconnu"}\`)\n> Convoqué : <@${agentId}> (\`${agentId}\`)`
                        }
                    ])
                    .setColor(0x0b1b5a)
                    .setFooter({ text: 'LSPD Assistant', iconURL: bot.user.displayAvatarURL() })
                    .setTimestamp();

                await logsChannel.send({ embeds: [embedLog] });
            }
        }

        res.json({ message: 'Convocation envoyée !' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur lors de l\'envoi de la convocation' });
    }
});

module.exports = router;
