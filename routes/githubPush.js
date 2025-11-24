const express = require('express');
const router = express.Router();
const bot = require('../config/bot');

// Remplace par l'ID du salon Discord où tu veux envoyer le message
defaultChannelId = '1409873615226404974'; // À personnaliser

router.post('/github-push', async (req, res) => {
  try {
    const push = req.body;
    const channel = bot.channels.cache.get(defaultChannelId);

    // Extraction des infos du payload GitHub
    const added = push.head_commit?.added?.length || 0;
    const modified = push.head_commit?.modified?.length || 0;
    const removed = push.head_commit?.removed?.length || 0;
    const author = push.pusher?.name || 'Inconnu';
    const repoUrl = push.repository?.html_url || '';
    const commitMsg = push.head_commit?.message || '';
    const date = new Date().toLocaleString();

    // Formate le message comme dans l'exemple
    const embed = {
      title: '📌 Nouveau Commit dans Fantastic',
      description: `${commitMsg}\nMerge branch '${push.ref}' of ${repoUrl}`,
      fields: [
        { name: 'Auteur', value: author },
        { name: 'Récapitulatif des fichiers', value: `🟢 Fichiers ajoutés : ${added}\n🟡 Fichiers modifiés : ${modified}\n🔴 Fichiers supprimés : ${removed}` },
        { name: 'Lignes ajoutées', value: '?', inline: true },
        { name: 'Lignes supprimées', value: '?', inline: true }
      ],
      footer: { text: `Push effectué par ${author} • ${date}` }
    };

    if (channel) await channel.send({ embeds: [embed] });
    res.sendStatus(200);
  } catch (err) {
    console.error('Erreur envoi push Discord:', err);
    res.sendStatus(500);
  }
});


module.exports = router;
