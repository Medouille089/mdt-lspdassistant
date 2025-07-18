const express = require("express");
const router = express.Router();
const multer = require("multer");
const { EmbedBuilder } = require("discord.js");
const bot = require("../config/bot");
const config = require("../config/config");
const fs = require("fs");

const memoryUpload = multer();

router.post('/upload-convocation', memoryUpload.single('image'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).send('Aucune image reçue');
    }

    const { nom, prenom } = req.body;
    if (!nom || !prenom) {
      return res.status(400).send('Nom et prénom requis');
    }

    const conf = await config.getConfig();
    const channelId = conf.convocation_id;
    const logsChannelId = conf.logs_channel;

    if (!channelId || !logsChannelId) {
      return res.status(500).send('Configuration des salons manquante');
    }

    const convocationChannel = await bot.channels.fetch(channelId);
    const logsChannel = await bot.channels.fetch(logsChannelId);

    if (!convocationChannel || !logsChannel?.isTextBased()) {
      return res.status(404).send('Salon introuvable');
    }

    // Envoi de la convocation
    const sentMessage = await convocationChannel.send({
      content: `📩 Nouvelle convocation officielle pour ${nom} ${prenom} :`,
      files: [{
        attachment: req.file.buffer,
        name: 'convocation.png'
      }]
    });

    // Création du lien du message envoyé
    const pingMessageURL = `https://discord.com/channels/${sentMessage.guildId}/${sentMessage.channelId}/${sentMessage.id}`;

    // Construction de l'embed pour le log
    const embedLog = new EmbedBuilder()
      .setColor(0x0b1b5a)
      .setTitle("Nouvelle convocation")
      .setDescription(`<@${req.user.id}> a publié une nouvelle convocation - [Voir la convocation](${pingMessageURL})`)
      .addFields({
        name: "ID's",
        value: `> <@${req.user.id}> (\`${req.user.id}\`) \n> [Message](${pingMessageURL}) (\`${sentMessage.id}\`)`,
        inline: false
      })
      .setFooter({
        text: "LSPD Assistant",
        iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 })
      })
      .setTimestamp();

    await logsChannel.send({ embeds: [embedLog] });

    console.log('Log bot envoyé dans LOGS_CHANNEL');
    res.status(200).send('Image envoyée avec succès !');
  } catch (error) {
    console.error('Erreur envoi convocation :', error);
    res.status(500).send('Erreur serveur');
  }
});

module.exports = router;
