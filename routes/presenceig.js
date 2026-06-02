// routes/presenceig.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { GUILD_ID, PRESENCE_ROLE_ID, PRESENCE_CHANNEL_ID } = require("../config/env");
const bot = require("../config/bot");


router.get('/admin', async (req, res) => {
    try {
        // Récupère uniquement le dernier message
        const messages = await db.query('SELECT * FROM lspd_presenceig ORDER BY id DESC LIMIT 1');

        if (messages.rows.length === 0) {
            return res.json([]); // Aucun message
        }

        const msgDb = messages.rows[0];

        const guild = await bot.guilds.fetch(GUILD_ID);
        const guildMembers = await guild.members.fetch();
        const roleMembers = guildMembers.filter(m => m.roles.cache.has(PRESENCE_ROLE_ID));
        const channel = guild.channels.cache.get(PRESENCE_CHANNEL_ID);

        let m;
        try {
            m = await channel.messages.fetch(msgDb.message_id);
        } catch {
            return res.json([]); // Message introuvable
        }

        // Pour chaque réaction, fetch tous les votants
        const reactions = await Promise.all(
            Array.from(m.reactions.cache.values()).map(async r => {
                const users = await r.users.fetch();
                return {
                    emoji: r.emoji.name,
                    users: Array.from(users.values())
                        .filter(u => !u.bot)
                        .map(u => {
                            const member = guildMembers.get(u.id);
                            return {
                                id: u.id,
                                username: member ? (member.nickname || member.user.username) : u.username
                            };
                        })
                        .sort((a, b) => a.username.localeCompare(b.username))
                };
            })
        );

        const votedIds = new Set();
        reactions.forEach(r => r.users.forEach(u => votedIds.add(u.id)));

        const notVoted = Array.from(roleMembers.values())
            .filter(member => !votedIds.has(member.id))
            .filter(member => !member.user.bot)
            .map(member => ({ id: member.id, username: member.nickname || member.user.username }))
            .sort((a, b) => a.username.localeCompare(b.username));

        const result = {
            message_id: msgDb.message_id,
            content: msgDb.content,
            reactions,
            notVoted,
            timestamp: m.createdAt
        };

        res.json([result]);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
