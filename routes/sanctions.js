const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { getBot, getConfig } = require('../config/config');
const { EmbedBuilder } = require('discord.js');

// GET /api/agents → récupère tous les agents LSPD actifs avec leur historique
router.get('/api/agents', async (req, res) => {
    try {
        const bot = getBot();
        if (!bot?.isReady()) return res.status(500).json({ error: "Bot Discord non connecté" });

        const config = getConfig();
        const requiredRoleId = config.required_role_id;

        const guild = await bot.guilds.fetch(process.env.GUILD_ID);
        if (!guild) return res.status(500).json({ error: "Guild introuvable" });

        const role = guild.roles.cache.get(requiredRoleId);
        if (!role) return res.status(500).json({ error: "Rôle Discord introuvable" });

        await guild.members.fetch();
        const membersWithRole = role.members
            .map(m => ({
                discord_id: m.user.id,
                username: m.displayName
            }))
            .filter(m => /^\d/.test(m.username));

        if (!membersWithRole.length) return res.json([]);

        const discordIds = membersWithRole.map(m => m.discord_id);
        const result = await pool.query(
            `SELECT * FROM lspd_sanctions 
             WHERE player_id = ANY($1::varchar[])
             AND archived = FALSE
             ORDER BY created_at DESC`,
            [discordIds]
        );

        const agents = membersWithRole.map(member => ({
            discord_id: member.discord_id,
            username: member.username,
            sanctions: result.rows
                .filter(s => s.player_id === member.discord_id)
                .map(s => ({
                    id: s.id,
                    type: s.type,
                    reason: s.reason,
                    date_from: s.date_from,
                    date_end: s.date_end,
                    issued_by: s.issued_by,
                    created_at: s.created_at
                }))
        }));

        res.json(agents);
    } catch (err) {
        console.error("Erreur API /agents:", err);
        res.status(500).json({ error: 'Erreur lors de la récupération des agents Discord' });
    }
});

// POST /api/sanctions → applique une sanction
router.post('/api/sanctions', async (req, res) => {
    try {
        if (!req.user || !req.user.id)
            return res.status(401).json({ error: "Vous devez être connecté pour appliquer une sanction" });

        const { player_id, type, reason, date_from, date_end } = req.body;
        const issued_by = req.user.id;

        if (!player_id || !type || !reason || !date_from) {
            return res.status(400).json({ error: "Champs obligatoires manquants" });
        }

        const insertRes = await pool.query(
            `INSERT INTO lspd_sanctions(player_id, type, reason, date_from, date_end, issued_by) 
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [player_id, type, reason, date_from, date_end || null, issued_by]
        );
        const sanction = insertRes.rows[0];

        const bot = getBot();
        const guild = await bot.guilds.fetch(process.env.GUILD_ID);
        const member = await guild.members.fetch(player_id);

        if (member) {
            const role = member.guild.roles.cache.find(r => r.name === type);
            if (role) await member.roles.add(role);

            const embed = new EmbedBuilder()
                .setTitle('Sanction reçue')
                .addFields(
                    { name: 'Type', value: type },
                    { name: 'Raison', value: reason },
                    { name: 'Date de', value: date_from },
                    { name: 'Date à', value: date_end || 'N/A' }
                )
                .setColor('Red');

            await member.send({ embeds: [embed] }).catch(() => console.log('MP impossible'));
        }

        res.json({ message: 'Sanction appliquée !', sanction });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur lors de l\'application de la sanction' });
    }
});

module.exports = router;
