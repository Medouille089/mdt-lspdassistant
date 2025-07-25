const express = require("express");
const router = express.Router();
const multer = require("multer");
const { AttachmentBuilder, EmbedBuilder, ChannelType } = require("discord.js");
const { getConfig, getBot } = require("../config/config");

const upload = multer();

router.post("/upload-convocation", upload.single("image"), async (req, res) => {
  console.log('--- Route POST /upload-convocation appelée ---');

  const bot = getBot();
  const user = req.user;
  const imageFile = req.file;

  const { nom, prenom, date, heure } = req.body;
  if (!imageFile) return res.status(400).json({ error: "Aucune image reçue." });

  try {
    const conf = await getConfig();
    const forumChannelId = conf.convocation_thread_id;
    const logsChannelId = conf.logs_channel;

    const forumChannel = await bot.channels.fetch(forumChannelId);
    const logsChannel = await bot.channels.fetch(logsChannelId);

    if (forumChannel.type !== ChannelType.GuildForum) {
      console.error("Le salon spécifié n’est pas un salon forum.");
      return res.status(400).json({ error: "Le salon spécifié n’est pas un salon forum valide." });
    }

    const botUser = bot.user;
    const nomComplet = `${nom || "Inconnu"} ${prenom || ""}`.trim();

    const displayDate = date
      ? date.split("-").reverse().join("/")
      : "—";
    const displayHeure = heure
      ? heure.split(":").join("h")
      : "—";

    try {
      const guild = await bot.guilds.fetch(conf.guild_id);
      const member = await guild.members.fetch(user.id);

      const embed = new EmbedBuilder()
        .setTitle("📄 Nouvelle convocation")
        .addFields(
          { name: "Personne concernée", value: nomComplet, inline: true },
          { name: "Envoyée par", value: `<@${member.id}>`, inline: false },
          { name: "Date", value: displayDate, inline: true },
          { name: "Heure", value: displayHeure, inline: true }
        )
        .setColor(0x0b1b5a)
        .setThumbnail(botUser.displayAvatarURL({ extension: 'png' }))
        .setFooter({
          text: "LSPD Assistant",
          iconURL: botUser.displayAvatarURL({ extension: "png", size: 256 })
        })
        .setTimestamp();

      // Crée le thread dans le forum avec l'embed (sans image)
      const convocationThread = await forumChannel.threads.create({
        name: `Convocation - ${nomComplet}`,
        message: {
          embeds: [embed]
        }
      });

      console.log("Thread créé :", convocationThread.name);

      // Envoie l’image dans un second message
      const attachment = new AttachmentBuilder(imageFile.buffer, {
        name: imageFile.originalname
      });

      await convocationThread.send({ files: [attachment] });
      console.log("Image envoyée dans le thread.");

      // LOG
      if (logsChannel?.isTextBased()) {
        const embedLog = new EmbedBuilder()
          .setColor(0x0b1b5a)
          .setTitle(`Nouvelle convocation - ${nomComplet}`)
          .setDescription(`**<@${member.id}>** a envoyé une convocation - <#${convocationThread.id}>`)
          .addFields({
            name: "ID's",
            value: `> <@${member.id}> (\`${member.id}\`) \n> <#${convocationThread.id}> (\`${convocationThread.id}\`)`
          })
          .setFooter({
            text: "LSPD Assistant",
            iconURL: botUser.displayAvatarURL({ extension: 'png', size: 256 })
          })
          .setTimestamp();

        await logsChannel.send({ embeds: [embedLog] });
        console.log("Log convocation envoyé");
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



module.exports = router;
