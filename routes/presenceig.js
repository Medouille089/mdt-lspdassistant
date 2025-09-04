// routes/presenceig.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { GUILD_ID } = require("../config/env");
const bot = require("../config/bot");

const ROLE_ID = '1096965866245066801';


router.get('/admin', async (req, res) => {
    try {

        const messages = await db.query('SELECT * FROM lspd_presenceig');


        const guild = await bot.guilds.fetch(GUILD_ID);
        const guildMembers = await guild.members.fetch();
        const roleMembers = guildMembers.filter(m => m.roles.cache.has(ROLE_ID));


        const channel = guild.channels.cache.get("1166063964380209222");

        const result = await Promise.all(messages.rows.map(async msg => {
            let m;
            try {
                m = await channel.messages.fetch(msg.message_id);
            } catch {
                return null;
            }
            if (!m) return null;

            // Pour chaque réaction, fetch tous les votants
            const reactions = await Promise.all(
                Array.from(m.reactions.cache.values()).map(async r => {
                    const users = await r.users.fetch();
                    return {
                        emoji: r.emoji.name,
                        users: Array.from(users.values()).filter(u => !u.bot).map(u => {
                            const member = guildMembers.get(u.id);

                            return {
                                id: u.id,
                                username: member ? (member.nickname || member.user.username) : u.username
                            };
                        })
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

            return {
                message_id: msg.message_id,
                content: msg.content,
                reactions,
                notVoted,
                timestamp: m.createdAt
            };
        }));


        res.json(result.filter(Boolean));
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
