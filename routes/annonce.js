const express = require('express');
const router = express.Router();


const pool = require('../config/db');
const { checkAuth } = require('../config/middleware');
const { getBot, getConfig } = require('../config/config');
const { EmbedBuilder } = require('discord.js');


// GET l'annonce active (hors dismiss utilisateur)
router.get('/api/annonce-active', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM lspd_annonce WHERE active=TRUE ORDER BY created_at DESC LIMIT 1`);
    if (!rows.length) return res.json(null);
    const annonce = rows[0];
    // Vérifie expiration
    if (new Date() > annonce.expires_at) {
      await pool.query('UPDATE lspd_annonce SET active=FALSE WHERE id=$1', [annonce.id]);
      return res.json(null);
    }
    res.json({
      id: annonce.id,
      texte: annonce.texte,
      auteur: annonce.auteur,
      dureeSec: annonce.duree_sec,
      createdAt: annonce.created_at,
      expiresAt: annonce.expires_at
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur annonce' });
  }
});


// POST une nouvelle annonce (admin seulement)
router.post('/api/annonce', checkAuth, async (req, res) => {
  const { texte, auteur, dureeSec } = req.body;
  if (!texte || !auteur || !dureeSec) return res.status(400).json({ error: 'Champs manquants' });
  try {
    // Désactive les anciennes annonces
    await pool.query('UPDATE lspd_annonce SET active=FALSE WHERE active=TRUE');
    // Ajoute la nouvelle annonce
    const now = new Date();
    const expires = new Date(now.getTime() + Number(dureeSec) * 1000);
    await pool.query(
      'INSERT INTO lspd_annonce (texte, auteur, duree_sec, created_at, expires_at, active) VALUES ($1,$2,$3,$4,$5,TRUE)',
      [texte, auteur, Number(dureeSec), now, expires]
    );

    // Log Discord dans logs_channel
    try {
      const bot = getBot();
      const conf = getConfig();
      const logsChannelId = conf.logs_channel;
          if (logsChannelId) {
            const logsChannel = await bot.channels.fetch(logsChannelId);
            if (logsChannel?.isTextBased()) {
              // Cherche le displayName brut (pas username)
              let displayName = req.user?.displayName;
              if (!displayName && bot && bot.guilds && req.user?.id) {
                try {
                  const guild = bot.guilds.cache.first() || (await bot.guilds.fetch());
                  const member = await guild.members.fetch(req.user.id);
                  displayName = member.displayName;
                } catch {}
              }
              const embed = new EmbedBuilder()
                .setColor(0xffc107)
                .setTitle('Nouvelle annonce')
                .setDescription(`${displayName || req.user?.username || 'Utilisateur inconnu'} a posté une annonce.`)
                .addFields(
                  { name: 'Contenu', value: '> ' + (texte.length > 200 ? texte.slice(0, 197) + '...' : texte), inline: false },
                  { name: "ID's", value: `> <@${req.user.id}> (\`${req.user.id}\`)`, inline: false }
                )
                .setFooter({ text: 'LSPD Assistant', iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 }) })
                .setTimestamp();
              await logsChannel.send({ embeds: [embed] });
            }
          }
    } catch (discordError) {
      console.error('Erreur lors de la notification Discord (annonce):', discordError);
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'annonce' });
  }
});


// DELETE pour retirer l'annonce (admin)
router.delete('/api/annonce', checkAuth, async (req, res) => {
  try {
    await pool.query('UPDATE lspd_annonce SET active=FALSE WHERE active=TRUE');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur suppression annonce' });
  }
});

// POST dismiss (fermeture croix) pour un utilisateur
router.post('/api/annonce-dismiss', async (req, res) => {
  const { annonceId, userId } = req.body;
  if (!annonceId || !userId) return res.status(400).json({ error: 'Champs manquants' });
  try {
    await pool.query('INSERT INTO lspd_annonce_dismiss (annonce_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [annonceId, userId]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Erreur dismiss annonce' });
  }
});

// GET pour savoir si l'utilisateur a dismiss l'annonce
router.get('/api/annonce-dismiss/:annonceId/:userId', async (req, res) => {
  const { annonceId, userId } = req.params;
  try {
    const { rows } = await pool.query('SELECT 1 FROM lspd_annonce_dismiss WHERE annonce_id=$1 AND user_id=$2', [annonceId, userId]);
    res.json({ dismissed: rows.length > 0 });
  } catch (e) {
    res.status(500).json({ error: 'Erreur dismiss check' });
  }
});

module.exports = router;
