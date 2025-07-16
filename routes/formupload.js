const express = require("express");
const router = express.Router();
const multer = require("multer");
const { EmbedBuilder } = require("discord.js");
const bot = require("../config/bot");
const { getConfig } = require("../config/config");
const path = require("path");
const fs = require("fs");

const upload = multer({ dest: "uploads/" });

router.post("/send-embed", upload.array("images"), async (req, res) => {
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

    // Nettoyage
    files.forEach(file => fs.unlink(file.path, () => {}));

    res.json({ message: "Embed avec images envoyé avec succès." });

  } catch (err) {
    console.error("Erreur envoi embed:", err);
    res.status(500).json({ message: "Erreur lors de l'envoi du message." });
  }
});

module.exports = router;