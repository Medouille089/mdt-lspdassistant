const express = require("express");
const router = express.Router();
const multer = require("multer");
const { AttachmentBuilder, EmbedBuilder, ChannelType } = require("discord.js");
const { getConfig, getBot } = require("../config/config");
const pool = require("../config/db");

const upload = multer();

router.post("/upload-convocation", upload.single("image"), async (req, res) => {

  const bot = getBot();
  const user = req.user;
  const imageFile = req.file;

  const { nom, prenom, date, heure, lieu, motif, officier, grade } = req.body;
  if (!imageFile) return res.status(400).json({ error: "Aucune image reçue." });

  try {
    const conf = await getConfig();
    const forumChannelId = conf.convocation_thread_id;
    const logsChannelId = conf.logs_convocations;

    const forumChannel = await bot.channels.fetch(forumChannelId);
    const logsChannel = await bot.channels.fetch(logsChannelId);

    if (forumChannel.type !== ChannelType.GuildForum) {
      console.error("Le salon spécifié n’est pas un salon forum.");
      return res.status(400).json({ error: "Le salon spécifié n’est pas un salon forum valide." });
    }

    const botUser = bot.user;
    const nomComplet = `${nom || "Inconnu"} ${prenom || ""}`.trim();

    // Si user vient d'un middleware d'auth, on peut fetch Member du serveur si besoin
    try {

      const embed = new EmbedBuilder()
        .setTitle("Nouvelle convocation")
        .addFields(
          { name: "Personne concernée", value: nomComplet, inline: true },
          { name: "Envoyée par", value: `<@${req.user.id}>`, inline: false }
        )
        .setColor(0x0b1b5a)
        .setThumbnail(botUser.displayAvatarURL({ extension: 'png' }))
        .setFooter({
          text: "LSPD Assistant",
          iconURL: botUser.displayAvatarURL({ extension: "png", size: 256 })
        })
        .setTimestamp();

      // Crée le thread dans le forum avec l'embed (sans image)
      // Formater la date pour n'afficher que JJ/MM
      const dateFormatted = new Date(date).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit'
      });

      const convocationThread = await forumChannel.threads.create({
        name: `${nomComplet} - ${dateFormatted} à ${heure} - ${(user.guild_member.nick).substring(0, 2)}`,
        message: {
          embeds: [embed]
        }
      });


      // Envoie l’image dans un second message
      const attachment = new AttachmentBuilder(imageFile.buffer, {
        name: imageFile.originalname
      });

      await convocationThread.send({ files: [attachment] });


      // Handle empty date/heure fields
      const safeDate = date && date.trim() !== '' ? date : null;
      const safeHeure = heure && heure.trim() !== '' ? heure : null;
      await pool.query(`
        INSERT INTO lspd_convocations (nom, prenom, date, heure, lieu, motif, officer, grade)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [nom, prenom, safeDate, safeHeure, lieu, motif, officier, grade]);

      // LOG
      if (logsChannel?.isTextBased()) {
        const embedLog = new EmbedBuilder()
          .setColor(0x0b1b5a)
          .setTitle(`Nouvelle convocation - ${nomComplet}`)
          .setDescription(`${req.user?.guild_member.nick || 'Utilisateur inconnu'} a envoyé une convocation - <#${convocationThread.id}>`)
          .addFields({
            name: "ID's",
            value: `> <@${req.user?.id || 'Utilisateur inconnu'}> (\`${user?.id || 'ID inconnu'}\`) \n> <#${convocationThread.id}> (\`${convocationThread.id}\`)`
          })
          .setFooter({
            text: "LSPD Assistant",
            iconURL: botUser.displayAvatarURL({ extension: 'png', size: 256 })
          })
          .setTimestamp();

        await logsChannel.send({ embeds: [embedLog] });
      }

      res.json({ success: true, message: "Convocation envoyée avec succès." });

    } catch (error) {
      console.error("Erreur envoi convocation :", error);
      res.status(500).json({ error: "Erreur lors de l’envoi de la convocation." });
    }
  } catch (error) {
    console.error("Erreur générale :", error);
    res.status(500).json({ error: "Erreur lors du traitement de la requête." });
  }
});

router.get("/api/getConvocation", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM lspd_convocations ORDER BY date DESC, heure DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Erreur lors de la récupération des convocations :", error);
    res.status(500).json({ error: "Erreur lors de la récupération des convocations." });
  }
});

module.exports = router;
