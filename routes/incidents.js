const express = require("express");
const router = express.Router();
const multer = require("multer");
const pool = require("../config/db");
const { getBot } = require("../config/config");
const {
  AttachmentBuilder,
  EmbedBuilder,
  ChannelType
} = require("discord.js");

const upload = multer({ storage: multer.memoryStorage() });

router.post("/api/incident", upload.array("pieces"), async (req, res) => {
  try {
    const {
      date, heure, officier,
      recit, implique, type, lieu
    } = req.body;
    const files = req.files;

    const bot = getBot();
    const forumChannelId = "1395696002702381076";
    const forum = await bot.channels.fetch(forumChannelId);
    const botUser = await bot.user;

    // Obtenir le dernier ID d'incident
    const { rows } = await pool.query("SELECT COUNT(*) FROM incidents");
    const count = parseInt(rows[0].count, 10) + 1;
    const incidentId = `INC${count.toString().padStart(4, "0")}`;

    // Formater la date JJ/MM/AAAA
    const [yyyy, mm, dd] = date.split("-");
    const formattedDate = `${dd}/${mm}/${yyyy}`;

    const embed = new EmbedBuilder()
      .setTitle("Nouveau rapport d'incident")
      .setThumbnail(botUser.displayAvatarURL({ extension: 'png' }))
      .addFields(
        { name: "ID d'incident", value: incidentId },
        { name: "Date", value: formattedDate, inline: true },
        { name: "Heure", value: heure, inline: true },
        { name: "Officier rédacteur", value: officier, inline: true },
        { name: "Officiers impliqués", value: implique || "Aucun" },
        { name: "Type", value: type || "Non précisé", inline: true },
        { name: "Lieu", value: lieu || "Non précisé", inline: true },
        { name: "Récit", value: recit || "Aucun récit fourni" }
      )
      .setFooter({
        text: "LSPD Assistant",
        iconURL: botUser.displayAvatarURL()
      })
      .setColor(0x0b1b5a)
      .setTimestamp();

    // Créer le thread avec le message initial (l'embed)
    const thread = await forum.threads.create({
      name: `${incidentId} - ${formattedDate}`,
      message: {
        embeds: [embed]
      },
      autoArchiveDuration: 1440,
    });

    // Envoyer les fichiers si y'en a
    if (files?.length > 0) {
      for (const file of files) {
        const attachment = new AttachmentBuilder(file.buffer, {
          name: file.originalname
        });
        await thread.send({ files: [attachment] });
      }
    }

    // Enregistrer dans la base de données
    await pool.query(`
      INSERT INTO incidents 
      (incident_id, date_incident, heure_incident, officier_redacteur, recit, officier_implique, type_rapport, lieu_incident, discord_thread_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [
      incidentId, date, heure, officier,
      recit, implique, type, lieu, thread.id
    ]);

    res.json({ message: "Rapport enregistré et envoyé !" });

  } catch (err) {
    console.error("Erreur API /api/incident :", err);
    res.status(500).json({ error: "Erreur lors de l’envoi du rapport." });
  }
});

module.exports = router;
