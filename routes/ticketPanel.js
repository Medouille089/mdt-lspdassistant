const express = require('express');
const router = express.Router();
const db = require('../config/db');
const conf = require('../config/config');
const { getBot } = require('../config/config');
const { EmbedBuilder } = require('discord.js');

/**
 * Log une action dans le salon de logs
 */
async function logAction({ action, description, userId, guildId, pings = [], extraFields = [] }) {
    const bot = getBot();
    const guild = bot.guilds.cache.get(guildId);
    if (!guild) return console.warn('Guild introuvable pour logAction');

    const member = guild.members.cache.get(userId);
    const displayName = member ? member.displayName : userId;

    const config = conf.getConfig();
    const logsChannelId = config.logs_channel;
    const logsChannel = guild.channels.cache.get(logsChannelId);
    if (!logsChannel) return console.warn('Salon de logs introuvable pour logAction');

    const fieldsValue = pings.map(p => {
        let value = `${p.mention} (${p.id})`;
        if (p.oldValue !== undefined || p.newValue !== undefined) {
            value += `\n> Avant: ${p.oldValue || '–'}\n> Après: ${p.newValue || '–'}`;
        }
        return value;
    }).join('\n');

    const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle(action)
        .setDescription(`${displayName} ${description}`)
        .addFields({ name: "ID's", value: fieldsValue || 'Aucun', inline: false });

    if (extraFields.length > 0) {
        extraFields.forEach(f => embed.addFields(f));
    }

    embed.setFooter({ text: "LSPD Assistant", iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 }) })
        .setTimestamp();

    await logsChannel.send({ embeds: [embed] });
}

// --- Récupération des catégories ---
router.get('/api/ticket-categories', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM lspd_ticket_categories ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur serveur');
    }
});

// --- POST Ticket Category ---
router.post('/api/ticket-categories', async (req, res) => {
    try {
        let {
            title, emoji, description, roles = [], target_channel_id,
            prefix = '', welcome_message = '', embed_color = '#00ff00', visible = true
        } = req.body;

        roles = roles || [];

        const result = await db.query(
            `INSERT INTO lspd_ticket_categories
            (title, emoji, description, roles, target_channel_id, prefix, welcome_message, embed_color, visible)
            VALUES($1,$2,$3,$4::varchar[],$5,$6,$7,$8,$9) RETURNING *`,
            [title, emoji, description, roles, target_channel_id, prefix, welcome_message, embed_color, visible]
        );

        const newCategory = result.rows[0];

        const rolesPings = (newCategory.roles || []).map(rid => ({
            mention: `> <@&${rid}>`,
            id: `\`${rid}\``
        }));

        await logAction({
            action: 'Catégorie ajoutée',
            description: 'a ajouté une nouvelle catégorie',
            userId: req.user.id,
            guildId: process.env.GUILD_ID,
            pings: [
                { mention: `> <@${req.user.id}>`, id: `\`${req.user.id}\`` },
                { mention: `> <#${target_channel_id}>`, id: `\`${target_channel_id}\`` },
                ...rolesPings
            ],
            extraFields: [
                {
                    name: 'Contenu en BDD',
                    value: `> Title: ${title}\n> Description: ${description || '-'}\n> Prefix: ${prefix || '-'}\n> Message: ${welcome_message || '-'}`
                }
            ]
        });

        res.json(newCategory);
    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur serveur');
    }
});

// --- Suppression d'une catégorie ---
router.delete('/api/ticket-categories/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const oldCategoryRes = await db.query('SELECT * FROM lspd_ticket_categories WHERE id=$1', [id]);
        if (!oldCategoryRes.rows[0]) return res.status(404).send('Catégorie introuvable');
        const oldCategory = oldCategoryRes.rows[0];

        await db.query('DELETE FROM lspd_ticket_categories WHERE id = $1', [id]);

        const rolesPings = (oldCategory.roles || []).map(rid => ({
            mention: `> <@&${rid}>`,
            id: `\`${rid}\``
        }));

        await logAction({
            action: 'Catégorie supprimée',
            description: 'a supprimé une catégorie',
            userId: req.user.id,
            guildId: process.env.GUILD_ID,
            pings: [
                { mention: `> <@${req.user.id}>`, id: `\`${req.user.id}\`` },
                { mention: `> <#${oldCategory.target_channel_id}>`, id: `\`${oldCategory.target_channel_id}\`` },
                ...rolesPings
            ],
            extraFields: [
                {
                    name: 'Contenu supprimé',
                    value: `> Title: ${oldCategory.title}\n> Description: ${oldCategory.description || '-'}\n> Prefix: ${oldCategory.prefix || '-'}\n> Message: ${oldCategory.welcome_message || '-'}`
                }
            ]
        });

        res.sendStatus(204);
    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur serveur');
    }
});

// --- Modification d'une catégorie ---
router.put('/api/ticket-categories/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const oldCategoryRes = await db.query('SELECT * FROM lspd_ticket_categories WHERE id=$1', [id]);
        if (!oldCategoryRes.rows[0]) return res.status(404).send('Catégorie introuvable');
        const oldCategory = oldCategoryRes.rows[0];

        const {
            title, emoji, description, roles, target_channel_id,
            prefix, welcome_message, embed_color, visible
        } = req.body;

        const result = await db.query(
            `UPDATE lspd_ticket_categories SET
             title = COALESCE($1, title),
             emoji = COALESCE($2, emoji),
             description = COALESCE($3, description),
             roles = COALESCE($4, roles)::varchar[],
             target_channel_id = COALESCE($5, target_channel_id),
             prefix = COALESCE($6, prefix),
             welcome_message = COALESCE($7, welcome_message),
             embed_color = COALESCE($8, embed_color),
             visible = COALESCE($9, visible)
             WHERE id = $10
             RETURNING *`,
            [title, emoji, description, roles, target_channel_id, prefix, welcome_message, embed_color, visible, id]
        );

        const newCategory = result.rows[0];

        const rolesPings = (newCategory.roles || []).map(rid => ({
            mention: `> <@&${rid}>`,
            id: `\`${rid}\``
        }));

        await logAction({
            action: 'Catégorie modifiée',
            description: 'a modifié une catégorie',
            userId: req.user.id,
            guildId: process.env.GUILD_ID,
            pings: [
                { mention: `> <@${req.user.id}>`, id: `\`${req.user.id}\`` },
                { mention: `> <#${newCategory.target_channel_id}>`, id: `\`${newCategory.target_channel_id}\`` },
                ...rolesPings
            ],
            extraFields: [
                {
                    name: 'Ancienne config',
                    value: `> Title: ${oldCategory.title}\n> Description: ${oldCategory.description || '-'}\n> Prefix: ${oldCategory.prefix || '-'}\n> Message: ${oldCategory.welcome_message || '-'}`
                },
                {
                    name: 'Nouvelle config',
                    value: `> Title: ${newCategory.title}\n> Description: ${newCategory.description || '-'}\n> Prefix: ${newCategory.prefix || '-'}\n> Message: ${newCategory.welcome_message || '-'}`
                }
            ]
        });

        res.json(newCategory);
    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur serveur');
    }
});

// --- Récupération des rôles Discord ---
router.get('/api/discord-roles', async (req, res) => {
    try {
        const bot = getBot();
        const guild = bot.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) return res.status(400).send('Guild not found');

        const roles = guild.roles.cache
            .filter(r => !r.managed)
            .map(r => ({ id: r.id, name: r.name }));
        res.json(roles);
    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur serveur');
    }
});

// --- Envoi d'un panel ---
router.post('/api/send-panel', async (req, res) => {
    try {
        const bot = getBot();
        const { channel_id, embed } = req.body;
        const channel = bot.channels.cache.get(channel_id);
        if (!channel) return res.status(400).send('Salon non trouvé');

        const categories = await db.query('SELECT id, title, emoji, description FROM lspd_ticket_categories WHERE visible = true ORDER BY id');

        const selectMenu = {
            type: 1,
            components: [{
                type: 3,
                custom_id: 'select_ticket_category',
                placeholder: 'Ouvrir un ticket...',
                options: categories.rows.map(cat => ({
                    label: `${cat.emoji || ''} ${cat.title}`.trim(),
                    value: `${cat.id}`,
                    description: (cat.description || '').slice(0, 100)
                }))
            }]
        };

        const colorInt = 0x0b1b5a;

        await channel.send({
            embeds: [{
                title: embed.title || '🎫 Tickets LSPD',
                description: embed.description || '',
                color: colorInt,
                thumbnail: { url: bot.user.displayAvatarURL() },
                footer: embed.footer ? { text: embed.footer } : undefined,
                timestamp: new Date()
            }],
            components: [selectMenu]
        });

        await logAction({
            action: 'Panel envoyé',
            description: 'a envoyé un panel de tickets',
            userId: req.user.id,
            guildId: process.env.GUILD_ID,
            pings: [{ mention: `> <#${channel_id}>`, id: `\`${channel_id}\`` }]
        });

        res.send('Panel envoyé sur Discord ✅');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur serveur');
    }
});

// --- Récupération des salons Discord ---
router.get('/api/discord-channels', async (req, res) => {
    try {
        const bot = getBot();
        const guild = bot.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) return res.status(400).send('Guild not found');

        const channels = guild.channels.cache
            .filter(ch => ch.type === 0)
            .map(ch => ({ id: ch.id, name: ch.name, type: 'text' }));

        res.json(channels);
    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur serveur');
    }
});

module.exports = router;
