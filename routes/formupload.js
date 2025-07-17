const express = require("express");
const router = express.Router();
const multer = require("multer");
const { EmbedBuilder } = require("discord.js");
const bot = require("../config/bot");
const fs = require("fs");

// Multer pour stocker sur disque (uploads/)
const diskUpload = multer({ dest: "uploads/" });

// Multer pour stockage en mémoire (buffer)
const memoryUpload = multer();

router.post("/send-embed", diskUpload.array("images"), async (req, res) => {
  const { nom, prenom } = req.body;
  const files = req.files; // tableau d'images

  if (!nom || !prenom) {
    return res.status(400).json({ message: "Nom et prénom requis" });
  }

  try {
    const channelId = "1394971904489558116"; // ID de ton salon Discord
    const channel = await bot.channels.fetch(channelId);
    if (!channel) return res.status(404).json({ message: "Salon introuvable" });

    const embed = new EmbedBuilder()
      .setTitle("📥 Nouveau formulaire reçu")
      .addFields(
        { name: "Nom", value: nom, inline: true },
        { name: "Prénom", value: prenom, inline: true }
      )
      .setColor(0x3498db)
      .setTimestamp();

    const attachments = files.map(file => ({
      attachment: fs.createReadStream(file.path),
      name: file.originalname,
    }));

    await channel.send({
      embeds: [embed],
      files: attachments,
    });

    // Nettoyage : suppression des fichiers du disque après envoi
    files.forEach(file => fs.unlink(file.path, err => {
      if (err) console.error("Erreur suppression fichier :", err);
    }));

    res.json({ message: "Embed avec images envoyé avec succès." });

  } catch (err) {
    console.error("Erreur envoi embed:", err);
    res.status(500).json({ message: "Erreur lors de l'envoi du message." });
  }
});

router.post('/upload-convocation', memoryUpload.single('image'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).send('Aucune image reçue');
    }

    const channelId = '1394971904489558116';
    const channel = await bot.channels.fetch(channelId);
    if (!channel) return res.status(404).send('Salon introuvable');

    await channel.send({
      content: '📩 Nouvelle convocation officielle :',
      files: [{
        attachment: req.file.buffer,
        name: 'convocation.png'
      }]
    });

    res.status(200).send('Image envoyée avec succès !');
  } catch (error) {
    console.error('Erreur envoi convocation :', error);
    res.status(500).send('Erreur serveur');
  }
});

module.exports = router;
