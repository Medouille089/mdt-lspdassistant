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

        const { player_id, type, reason, date_from, date_end, grade } = req.body;

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

        const bot = getBot();
        const guild = await bot.guilds.fetch(process.env.GUILD_ID);

        const issuerMember = await guild.members.fetch(req.user.id).catch(() => null);
        const targetMember = await guild.members.fetch(player_id).catch(() => null);

        const issued_by_name = issuerMember?.displayName || req.user?.username || "Utilisateur inconnu";
        const player_name = targetMember?.displayName || "Utilisateur inconnu";

        const issuerGrade = grade || "Grade inconnu";

        const insertRes = await pool.query(
            `INSERT INTO lspd_sanctions(
                player_id, player_discord_id,
                type, reason, date_from, date_end,
                issued_by, issued_by_discord_id, issuer_grade
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [
                player_name, player_id,
                roleInfo.id_discord, reason, date_from, date_end || null,
                issued_by_name, req.user.id, issuerGrade
            ]
        );

        const sanction = insertRes.rows[0];

        // Ajout rôle Discord + MP
        if (targetMember) {
            const role = guild.roles.cache.get(roleInfo.id_discord);
            if (role) await targetMember.roles.add(role).catch(err => console.error("Erreur ajout rôle:", err));

            const embed = new EmbedBuilder()
                .setTitle('Sanction reçue')
                .addFields(
                    { name: 'Type', value: roleInfo.nom, inline: false },
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

        // Logs Discord (inchangé)
        const logsChannel = await guild.channels.fetch(LOGS_CHANNEL_ID).catch(() => null);
        if (logsChannel?.isTextBased()) {
            const embedLog = new EmbedBuilder()
                .setColor(0x0b1b5a)
                .setTitle(`Nouvelle sanction - ${player_name}`)
                .setDescription(`${issued_by_name} a appliqué une sanction à ${player_name}`)
                .addFields([
                    {
                        name: "Détails de la sanction",
                        value: `**Type :** ${roleInfo.nom}\n **Raison :** ${reason}\n **Date du** : ${formatDate(date_from)}\n **Date au :** ${formatDate(date_end)}\n **Grade :** ${issuerGrade}`
                    },
                    {
                        name: "ID's",
                        value: `> <@${req.user.id}> (\`${req.user.id}\`)\n> <@${player_id}> (\`${player_id}\`)`
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

// POST /api/sanctions/revoke/:id → révoque la sanction
router.post('/api/sanctions/revoke/:id', async (req, res) => {
    try {
        if (!req.user || !req.user.id)
            return res.status(401).json({ error: "Vous devez être connecté pour révoquer une sanction" });

        const sanctionId = req.params.id;
        const bot = getBot();
        const guild = await bot.guilds.fetch(process.env.GUILD_ID);

        // Récupère la sanction avec jointure rôle + grade stocké
        const sanctionRes = await pool.query(
            `SELECT s.*, r.nom AS type_name 
             FROM lspd_sanctions s
             LEFT JOIN lspd_sanctions_roles r ON s.type = r.id_discord
             WHERE s.id = $1`,
            [sanctionId]
        );
        if (!sanctionRes.rows.length) return res.status(404).json({ error: "Sanction introuvable" });

        const sanction = sanctionRes.rows[0];

        // Utilisateur qui révoque
        const revokerMember = await guild.members.fetch(req.user.id).catch(() => null);
        const revokerName = revokerMember?.displayName || req.user.username || 'Utilisateur inconnu';

        // Joueur sanctionné
        const targetMember = await guild.members.fetch(sanction.player_discord_id).catch(() => null);
        const targetName = targetMember?.displayName || sanction.player_id;

        // Retire le rôle correspondant
        if (targetMember) {
            const role = guild.roles.cache.get(sanction.type);
            if (role) {
                await targetMember.roles.remove(role).catch(err =>
                    console.error("Erreur retrait rôle:", err)
                );

                const issuerGrade = sanction.issuer_grade || "Grade inconnu";

                const embedMP = new EmbedBuilder()
                    .setTitle('Sanction révoquée')
                    .addFields(
                        { name: 'Type', value: sanction.type_name || sanction.type, inline: false },
                        { name: 'Raison', value: sanction.reason, inline: false },
                        { name: 'Date de', value: formatDate(sanction.date_from), inline: true },
                        { name: 'Date à', value: formatDate(sanction.date_end), inline: true },
                        { name: '\u200B', value: '\u200B', inline: true },
                        { name: 'Agent révoquant', value: revokerName, inline: true },
                        { name: 'Grade', value: issuerGrade, inline: true }
                    )
                    .setColor('#FFA500')
                    .setFooter({
                        text: "LSPD Assistant",
                        iconURL: bot?.user?.displayAvatarURL({ extension: 'png', size: 256 })
                    })
                    .setTimestamp();

                await targetMember.send({ embeds: [embedMP] }).catch(() => console.log('MP impossible'));
            }
        }

        // Marque la sanction comme révoquée
        await pool.query(
            `UPDATE lspd_sanctions 
             SET archived = TRUE, revoked_by = $1 
             WHERE id = $2`,
            [revokerName, sanctionId]
        );

        // Logs Discord
        const logsChannel = await guild.channels.fetch(LOGS_CHANNEL_ID).catch(() => null);
        if (logsChannel?.isTextBased()) {
            const embedLog = new EmbedBuilder()
                .setColor(0xffa500)
                .setTitle(`Sanction révoquée`)
                .setDescription(`${revokerName} a révoqué la sanction de ${targetName}`)
                .addFields([
                    {
                        name: "Détails de la sanction",
                        value: `**Type :** ${sanction.type_name || "Inconnu"}\n**Raison :** ${sanction.reason}\n**Date du :** ${formatDate(sanction.date_from)}\n**Date au :** ${formatDate(sanction.date_end)}\n**Grade :** ${sanction.issuer_grade || "Grade inconnu"}`
                    },
                    {
                        name: "ID's",
                        value: `> <@${req.user.id}> (\`${req.user.id}\`)\n> <@${sanction.player_discord_id}> (\`${sanction.player_discord_id}\`)\n> ID Sanction : ${sanction.id}`
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
        console.error("Erreur API revoke:", err);
        res.status(500).json({ error: 'Erreur lors de la révocation' });
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
        const bot = getBot();
        const guild = await bot.guilds.fetch(process.env.GUILD_ID);

        // jointure pour récupérer le nom du rôle sanction
        const result = await pool.query(`
            SELECT s.*, r.nom AS type_name
            FROM lspd_sanctions s
            LEFT JOIN lspd_sanctions_roles r ON s.type = r.id_discord
            ORDER BY s.created_at DESC
        `);

        // transformation
        const sanctions = await Promise.all(result.rows.map(async s => {
            // on récupère le membre sanctionné via son ID Discord (player_id)
            let member = null;
            try {
                member = await guild.members.fetch(s.player_id);
            } catch (e) {
                // si pas trouvé, on laisse null
            }

            return {
                ...s,
                type: s.type_name || s.type, // affiche le nom du rôle
                displayName: member?.displayName || s.player_id, // nom lisible côté front
                date_from: s.date_from?.toISOString().split('T')[0],
                date_end: s.date_end?.toISOString().split('T')[0],
                created_at: s.created_at?.toISOString().replace('T', ' ').split('.')[0]
            };
        }));

        res.json(sanctions);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur récupération sanctions' });
    }
});

// GET /api/officer/sanctions?userId=<discord_id>
router.get('/api/officer/sanctions', checkAuth, async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: "userId manquant" });

        const result = await pool.query(
            `SELECT s.id,s.player_id, s.type, s.reason, s.date_from, s.date_end, s.issued_by, s.archived, s.revoked_by, r.nom AS type_name
             FROM lspd_sanctions s
             LEFT JOIN lspd_sanctions_roles r ON s.type = r.id_discord
             WHERE s.player_discord_id = $1
             ORDER BY s.date_from DESC`,
            [userId]
        );

        // Convert dates au format JJ/MM/AAAA
        const sanctions = result.rows.map(r => ({
            ...r,
            type: r.type_name || r.type, // remplace l'ID par le nom si trouvé
            date_from: r.date_from?.toISOString().split('T')[0],
            date_end: r.date_end?.toISOString().split('T')[0]
        }));

        res.json(sanctions);
    } catch (err) {
        console.error('Erreur récupération sanctions officer:', err);
        res.status(500).json({ error: 'Impossible de récupérer les sanctions de l’agent' });
    }
});


// Récupérer infos d'un agent par son Discord ID
router.get('/api/discord/member/:userId', checkAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const bot = getBot();
        const guild = await bot.guilds.fetch(process.env.GUILD_ID);
        const member = await guild.members.fetch(userId).catch(() => null);

        if (!member) return res.status(404).json({ error: "Membre introuvable" });

        res.json({ displayName: member.displayName });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Impossible de récupérer le membre Discord" });
    }
});


async function revokeExpiredSanctions() {
    try {
        const bot = getBot();
        const guild = await bot.guilds.fetch(process.env.GUILD_ID);

        // Récupère toutes les sanctions actives avec date_end passée
        const result = await pool.query(
            `SELECT s.*, r.nom AS type_name
             FROM lspd_sanctions s
             LEFT JOIN lspd_sanctions_roles r ON s.type = r.id_discord
             WHERE archived = FALSE AND date_end IS NOT NULL AND date_end <= CURRENT_DATE`
        );

        for (const sanction of result.rows) {
            const targetMember = await guild.members.fetch(sanction.player_discord_id).catch(() => null);
            const targetName = targetMember?.displayName || sanction.player_id;

            // Retire le rôle
            if (targetMember) {
                const role = guild.roles.cache.get(sanction.type);
                if (role) await targetMember.roles.remove(role).catch(err => console.error("Erreur retrait rôle:", err));

                // --- MP ---
                const embedMP = new EmbedBuilder()
                    .setTitle('Sanction arrivée à terme')
                    .addFields(
                        { name: 'Type', value: sanction.type_name || sanction.type, inline: false },
                        { name: 'Raison', value: sanction.reason, inline: false },
                        { name: 'Date de', value: formatDate(sanction.date_from), inline: true },
                        { name: 'Date à', value: formatDate(sanction.date_end), inline: true },
                        { name: '\u200B', value: '\u200B', inline: true },
                        { name: 'Sanction arrivée à terme', value: 'Automatique', inline: true },
                    )
                    .setColor('#FFA500')
                    .setFooter({
                        text: "LSPD Assistant",
                        iconURL: bot?.user?.displayAvatarURL({ extension: 'png', size: 256 })
                    })
                    .setTimestamp();

                await targetMember.send({ embeds: [embedMP] }).catch(() => console.log('MP impossible'));
            }

            // --- Log Discord ---
            const logsChannel = await guild.channels.fetch(LOGS_CHANNEL_ID).catch(() => null);
            if (logsChannel?.isTextBased()) {
                const embedLog = new EmbedBuilder()
                    .setColor(0xffa500)
                    .setTitle(`Sanction arrivée à terme - ${targetName}`)
                    .setDescription(`Sanction arrivée à terme pour ${targetName}`)
                    .addFields([
                        {
                            name: "Détails de la sanction",
                            value: `**Type :** ${sanction.type_name || "Inconnu"}\n**Raison :** ${sanction.reason}\n**Date du :** ${formatDate(sanction.date_from)}\n**Date au :** ${formatDate(sanction.date_end)}`
                        },
                        {
                            name: "ID's",
                            value: `> <@${sanction.issued_by_discord_id}> (\`${sanction.issued_by_discord_id}\`)\n> <@${sanction.player_discord_id}> (\`${sanction.player_discord_id}\`)\n> ID Sanction : ${sanction.id}`
                        }
                    ])
                    .setFooter({
                        text: "LSPD Assistant",
                        iconURL: bot?.user?.displayAvatarURL({ extension: 'png', size: 256 })
                    })
                    .setTimestamp();

                await logsChannel.send({ embeds: [embedLog] });
                console.log(`✅ Log automatique sanction ${sanction.id} envoyé`);
            }

            // Archive la sanction
            await pool.query(
                `UPDATE lspd_sanctions SET archived = TRUE, revoked_by = $1 WHERE id = $2`,
                ['LSPD Assistant', sanction.id]
            );
        }
    } catch (err) {
        console.error("Erreur lors du retrait automatique des sanctions :", err);
    }
}

// ---------------------- Planification quotidienne ----------------------
function scheduleDailySanctionCheck() {
    const now = new Date();

    // Prochain minuit
    const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0, 0, 0, 0
    );

    const msUntilMidnight = nextMidnight - now;

    // Check à minuit
    setTimeout(() => {
        revokeExpiredSanctions();
        setInterval(revokeExpiredSanctions, 24 * 60 * 60 * 1000); // tous les jours à minuit
    }, msUntilMidnight);

    // Check à minuit + 10 minutes
    setTimeout(() => {
        revokeExpiredSanctions();
        setInterval(revokeExpiredSanctions, 24 * 60 * 60 * 1000); // tous les jours à minuit+10
    }, msUntilMidnight + 10 * 60 * 1000);
}

// ---------------------- Mode test pour une heure précise ----------------------
function scheduleTestSanctionCheck(hour = 12, minute = 35) {
    const now = new Date();
    const nextTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hour,
        minute,
        0,
        0
    );
    if (nextTime < now) nextTime.setDate(nextTime.getDate() + 1);

    const msUntilNextTime = nextTime - now;
    console.log(`⏱ Planifié test de sanctions dans ${msUntilNextTime / 1000}s`);

    setTimeout(() => {
        revokeExpiredSanctions();
    }, msUntilNextTime);
}

scheduleDailySanctionCheck();

// Mode test dé-commentable si besoin
// scheduleTestSanctionCheck(12, 35);

module.exports = router;
