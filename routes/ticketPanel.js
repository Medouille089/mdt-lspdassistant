const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { getBot } = require('../config/config');

router.get('/api/ticket-categories', async (req,res)=>{
    try{
        const result = await db.query('SELECT * FROM lspd_ticket_categories ORDER BY id');
        res.json(result.rows);
    } catch(err){console.error(err); res.status(500).send('Erreur serveur');}
});

router.post('/api/ticket-categories', async (req,res)=>{
    const {title, emoji, description, ping_roles, allowed_roles, target_channel_id} = req.body;
    try{
        const result = await db.query(
            `INSERT INTO lspd_ticket_categories (title, emoji, description, ping_roles, allowed_roles, target_channel_id)
             VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
             [title, emoji, description, ping_roles, allowed_roles, target_channel_id]
        );
        res.json(result.rows[0]);
    }catch(err){console.error(err); res.status(500).send('Erreur serveur');}
});

router.get('/api/discord-channels', async (req,res)=>{
    try{
        const bot = getBot();
        const guild = bot.guilds.cache.first();
        const channels = guild.channels.cache
            .filter(ch => ch.type === 0) // text
            .map(ch => ({id: ch.id, name: ch.name, type: 'text'}));
        res.json(channels);
    }catch(err){console.error(err); res.status(500).send('Erreur serveur');}
});

router.post('/api/send-panel', async (req,res)=>{
    try{
        const bot = getBot();
        const {channel_id, embed} = req.body;
        const channel = bot.channels.cache.get(channel_id);
        if(!channel) return res.status(400).send('Salon non trouvé');

        const categories = await db.query('SELECT * FROM lspd_ticket_categories');

        const selectMenu = {
            type: 1,
            components: [{
                type: 3,
                custom_id: 'select_ticket_category',
                placeholder: 'Ouvrir un ticket...',
                options: categories.rows.map(cat => ({
                    label: `${cat.emoji} ${cat.title}`,
                    value: `${cat.id}`,
                    description: cat.description.slice(0, 100)
                }))
            }]
        };

        await channel.send({
            embeds: [{
                title: embed.title || '🎫 Tickets LSPD',
                description: embed.description || '',
                color: embed.color || 0x00ff00,
                thumbnail: embed.thumbnail ? {url: embed.thumbnail} : undefined,
                footer: embed.footer ? {text: embed.footer} : undefined,
                timestamp: new Date()
            }],
            components: [selectMenu]
        });

        res.send('Panel envoyé sur Discord ✅');
    }catch(err){console.error(err); res.status(500).send('Erreur serveur');}
});

module.exports = router;
