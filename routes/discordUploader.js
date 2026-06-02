const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getBot } = require('../config/config');

// Mémoire: on envoie directement à Discord, pas de stockage local
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// GET -> lister les salons du serveur cible, filtrés par catégorie (parentId)
// query: guild_id (optionnel), category_id (optionnel)
router.get('/api/discord/channels', async (req, res) => {
  try {
    const guildId = req.query.guild_id || process.env.UPLOAD_GUILD_ID || process.env.GUILD_ID;
    if (!guildId) return res.status(400).json({ error: 'guild_id manquant' });
    const categoryId = req.query.category_id || process.env.UPLOAD_CATEGORY_ID || null;

    const bot = getBot();
    if (!bot) return res.status(500).json({ error: 'Bot Discord non initialisé' });

    const guild = await bot.guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.status(404).json({ error: 'Guilde introuvable' });

    const channels = await guild.channels.fetch();
    const list = [];
    channels.forEach(c => {
      // On ne prend que les text channels dont le parentId correspond à la catégorie demandée
      if (c && c.type === 0 && String(c.parentId) === String(categoryId)) {
        list.push({ id: c.id, name: c.name });
      }
    });

    // Trier par nom
    list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    res.json({ channels: list });
  } catch (err) {
    console.error('GET /api/discord/channels error', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// POST -> upload des fichiers vers un channel (single ou multiple)
// champs: channel_id, files[]
router.post('/api/discord/upload', upload.array('files', 10), async (req, res) => {
  try {
    const { channel_id } = req.body;
    if (!channel_id) return res.status(400).json({ error: 'channel_id manquant' });
    if (!req.files || !req.files.length) return res.status(400).json({ error: 'Aucun fichier' });

    const bot = getBot();
    if (!bot) return res.status(500).json({ error: 'Bot Discord non initialisé' });

    const channel = await bot.channels.fetch(channel_id).catch(() => null);
    if (!channel || !channel.isTextBased()) return res.status(404).json({ error: 'Salon introuvable ou non textuel' });

    const uploaded = [];
    for (const f of req.files) {
      // Discord.js v14 accepts attachments as { attachment: Buffer, name }
      try {
        const msg = await channel.send({ files: [{ attachment: f.buffer, name: f.originalname }] });
        // Extraire l'URL CDN depuis le message attachments
        const urls = [];
        for (const atch of msg.attachments.values()) {
          urls.push(atch.url);
        }
        uploaded.push({ name: f.originalname, urls });
      } catch (e) {
        console.error('Erreur envoi fichier discord:', e);
        uploaded.push({ name: f.originalname, error: e.message });
      }
    }

    res.json({ uploaded });
  } catch (err) {
    console.error('POST /api/discord/upload error', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

module.exports = router;
