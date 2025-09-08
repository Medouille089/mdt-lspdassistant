const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { getBot, getConfig } = require('../config/config');
const { EmbedBuilder } = require('discord.js');

const LOGS_CHANNEL_ID = '1409873897654063265';

// Helper → formatage des dates en JJ/MM/AAAA
function formatDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR');
}

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
                username: m.displayName,
                roles: m.roles.cache.map(r => r.id)
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
            roles: member.roles,
            sanctions: result.rows
                .filter(s => s.player_id === member.username)
                .map(s => ({
                    id: s.id,
                    type: s.type,
                    reason: s.reason,
                    date_from: formatDate(s.date_from),
                    date_end: formatDate(s.date_end),
                    issued_by: s.issued_by,
                    revoked_by: s.revoked_by || null,
                    created_at: formatDate(s.created_at)
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

        if (!player_id || !type || !reason || !date_from) {
            return res.status(400).json({ error: "Champs obligatoires manquants" });
        }

        const roleRes = await pool.query(
            `SELECT id_discord, nom FROM lspd_sanctions_roles WHERE id_discord = $1 LIMIT 1`,
            [type]
        );

        if (!roleRes.rows.length) {
            return res.status(400).json({ error: "Type de sanction inconnu" });
        }

        const roleInfo = roleRes.rows[0];
        const roleId = roleInfo.id_discord;
        const roleName = roleInfo.nom;

        const bot = getBot();
        const guild = await bot.guilds.fetch(process.env.GUILD_ID);

        // Récupération des display names
        const issuerMember = await guild.members.fetch(req.user.id).catch(() => null);
        const issued_by_name = issuerMember?.displayName || req.user?.username || "Utilisateur inconnu";

        const targetMember = await guild.members.fetch(player_id).catch(() => null);
        const player_name = targetMember?.displayName || "Utilisateur inconnu";

        const insertRes = await pool.query(
            `INSERT INTO lspd_sanctions(player_id, type, reason, date_from, date_end, issued_by) 
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [player_name, roleId, reason, date_from, date_end || null, issued_by_name]
        );
        const sanction = insertRes.rows[0];

        if (targetMember) {
            const role = guild.roles.cache.get(roleId);
            if (role) await targetMember.roles.add(role).catch(err => console.error("Erreur ajout rôle:", err));

            const issuerGrade = req.body.grade || "Grade inconnu";

            const embed = new EmbedBuilder()
                .setTitle('Sanction reçue')
                .addFields(
                    { name: 'Type', value: roleName, inline: false },
                    { name: 'Raison', value: reason, inline: false },
                    { name: 'Date de', value: formatDate(date_from), inline: true },
                    { name: 'Date à', value: formatDate(date_end), inline: true },
                    { name: '\u200B', value: '\u200B', inline: true },
                    { name: 'Agent sanctionneur', value: issued_by_name, inline: true },
                    { name: 'Grade', value: issuerGrade, inline: true }
                )
                .setColor('#FF0000')
                .setFooter({
                    text: "LSPD Assistant",
                    iconURL: bot?.user?.displayAvatarURL({ extension: 'png', size: 256 })
                })
                .setTimestamp();

            await targetMember.send({ embeds: [embed] }).catch(() => console.log('MP impossible'));
        }

        const logsChannel = await guild.channels.fetch(LOGS_CHANNEL_ID).catch(() => null);
        if (logsChannel?.isTextBased()) {
            const embedLog = new EmbedBuilder()
                .setColor(0x0b1b5a)
                .setTitle(`Nouvelle sanction - ${player_name}`)
                .setDescription(`${issued_by_name} a appliqué une sanction à ${player_name}`)
                .addFields([
                    {
                        name: "Détails de la sanction",
                        value: `**Type :** ${roleName}\n **Raison :** ${reason}\n **Date du** : ${formatDate(date_from)}\n **Date au :** ${formatDate(date_end)}`
                    },
                    {
                        name: "Utilisateurs",
                        value: `> Sanctionneur : ${issued_by_name}\n> Sanctionné : ${player_name}`
                    }
                ])
                .setFooter({
                    text: "LSPD Assistant",
                    iconURL: bot?.user?.displayAvatarURL({ extension: 'png', size: 256 })
                })
                .setTimestamp();

            await logsChannel.send({ embeds: [embedLog] });
            console.log("✅ Log sanction envoyé");
        }

        res.json({ message: 'Sanction appliquée !', sanction });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur lors de l\'application de la sanction' });
    }
});

// GET /api/sanctions/roles
router.get('/api/sanctions/roles', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id_discord, nom FROM lspd_sanctions_roles ORDER BY nom ASC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Erreur API /sanctions/roles:", err);
        res.status(500).json({ error: 'Erreur lors de la récupération des rôles de sanction' });
    }
});

// GET /api/sanctions/all
router.get('/api/sanctions/all', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM lspd_sanctions ORDER BY created_at DESC`);
        res.json(result.rows.map(s => ({
            ...s,
            date_from: s.date_from?.toISOString().split('T')[0],
            date_end: s.date_end?.toISOString().split('T')[0],
            created_at: s.created_at?.toISOString().replace('T', ' ').split('.')[0]
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur récupération sanctions' });
    }
});

// POST /api/sanctions/revoke/:id
router.post('/api/sanctions/revoke/:id', async (req, res) => {
    try {
        if (!req.user || !req.user.id)
            return res.status(401).json({ error: "Vous devez être connecté pour révoquer une sanction" });

        const id = req.params.id;
        const bot = getBot();
        const guild = await bot.guilds.fetch(process.env.GUILD_ID);

        const revokerMember = await guild.members.fetch(req.user.id).catch(() => null);
        const revokerName = revokerMember?.displayName || req.user.username || 'Utilisateur inconnu';

        const sanctionRes = await pool.query(`SELECT * FROM lspd_sanctions WHERE id = $1`, [id]);
        if (!sanctionRes.rows.length) return res.status(404).json({ error: "Sanction introuvable" });

        const sanction = sanctionRes.rows[0];

        const targetMember = await guild.members.fetch(sanction.player_id).catch(() => null);
        const targetName = targetMember?.displayName || sanction.player_id; // ici player_id est déjà un nom

        await pool.query(
            `UPDATE lspd_sanctions SET archived = TRUE, revoked_by = $1 WHERE id = $2`,
            [revokerName, id]
        );

        const logsChannel = await guild.channels.fetch(LOGS_CHANNEL_ID).catch(() => null);
        if (logsChannel?.isTextBased()) {
            const embedLog = new EmbedBuilder()
                .setColor(0xffa500)
                .setTitle(`Sanction révoquée`)
                .setDescription(`${revokerName} a révoqué la sanction de ${targetName}`)
                .addFields([
                    { name: "Détails de la sanction", value: `**Type :** ${sanction.type}\n**Raison :** ${sanction.reason}\n**Date du :** ${formatDate(sanction.date_from)}\n**Date au :** ${formatDate(sanction.date_end)}` },
                    {
                        name: "Utilisateurs",
                        value: `> Sanctionneur : ${revokerName}\n> Sanctionné : ${targetName}\n> ID Sanction : ${sanction.id}`
                    }

                ])
                .setFooter({
                    text: "LSPD Assistant",
                    iconURL: bot?.user?.displayAvatarURL({ extension: 'png', size: 256 })
                })
                .setTimestamp();

            await logsChannel.send({ embeds: [embedLog] });
            console.log("✅ Log révocation envoyé");
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur révocation' });
    }
});

module.exports = router;
