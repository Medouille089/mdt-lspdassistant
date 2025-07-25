const express = require("express");
const router = express.Router();
const multer = require("multer");
const pool = require("../config/db");
const config = require("../config/config");
const { getBot } = require("../config/config");
const { AttachmentBuilder, EmbedBuilder, ChannelType } = require("discord.js");
const upload = multer({ storage: multer.memoryStorage() });

router.post("/api/incident", upload.array("pieces"), async (req, res) => {
  const bot = getBot();
  const conf = await config.getConfig();
  const forumChannelId = conf.incident_thread_id;
  const logsChannelId = conf.logs_channel;
  try {
    const {
      date, heure, officier, grade,
      recit, implique, type, lieu
    } = req.body;
    const files = req.files;

    const forum = await bot.channels.fetch(forumChannelId);
    const botUser = await bot.user;

    const { rows } = await pool.query("SELECT COUNT(*) FROM incidents");
    const count = parseInt(rows[0].count, 10) + 1;
    const incidentId = `INC${count.toString().padStart(4, "0")}`;

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
        { name: "Grade", value: grade || "Non précisé", inline: true },
        { name: "Officiers impliqués", value: implique || "Aucun" },
        { name: "Type", value: type || "Non précisé", inline: true },
        { name: "Lieu", value: lieu || "Non précisé", inline: true },
      )
      .setFooter({
        text: "LSPD Assistant",
        iconURL: botUser.displayAvatarURL()
      })
      .setColor(0x0b1b5a)
      .setTimestamp();

    const thread = await forum.threads.create({
      name: `${incidentId} - ${formattedDate}`,
      message: { embeds: [embed] },
      autoArchiveDuration: 1440,
    });

    if (files?.length > 0) {
      for (const file of files) {
        const attachment = new AttachmentBuilder(file.buffer, {
          name: file.originalname
        });
        await thread.send({ files: [attachment] });
      }
    }

    await pool.query(`
      INSERT INTO incidents 
      (incident_id, date_incident, heure_incident, officier_redacteur, grade, recit, officier_implique, type_rapport, lieu_incident, discord_thread_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    `, [
      incidentId, date, heure, officier, grade,
      recit, implique, type, lieu, thread.id
    ]);

    const logsChannel = await bot.channels.fetch(logsChannelId);
    if (logsChannel?.isTextBased()) {
      const embedLog = new EmbedBuilder()
        .setColor(0x0b1b5a)
        .setTitle(`Nouveau rapport d'incident - ${incidentId}`)
        .setDescription(`**${officier}** a créé un nouveau rapport - <#${thread.id}> \`${incidentId}\``)
        .addFields({
          name: "ID's",
          value: `> <@${req.user?.id || 'Utilisateur inconnu'}> (\`${req.user?.id || 'ID inconnu'}\`) \n> <#${thread.id}> (\`${thread.id}\`)`,
          inline: false
        })
        .setFooter({
          text: "LSPD Assistant",
          iconURL: botUser.displayAvatarURL({ extension: 'png', size: 256 })
        })
        .setTimestamp();

      await logsChannel.send({ embeds: [embedLog] });
      console.log('Log création rapport envoyé');
    }

    res.json({
      message: "Rapport enregistré et envoyé !",
      incidentId: incidentId
    });

  } catch (err) {
    console.error("Erreur API /api/incident :", err);
    res.status(500).json({ error: "Erreur lors de l’envoi du rapport." });
  }
});

router.get('/api/getIncident', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        incident_id,
        date_incident,
        heure_incident,
        officier_redacteur,
        grade,
        recit,
        officier_implique,
        type_rapport,
        lieu_incident,
        discord_thread_id
      FROM incidents
      ORDER BY date_incident DESC, heure_incident DESC
    `);

    const bot = getBot(); // Assure-toi que le bot est prêt

    const withImages = await Promise.all(result.rows.map(async row => {
      let images = [];

      try {
        const thread = await bot.channels.fetch(row.discord_thread_id);

        if (thread?.isThread()) {
          const messages = await thread.messages.fetch({ limit: 100 });

          messages.forEach(msg => {
            msg.attachments.forEach(att => {
              if (att.contentType?.startsWith("image/")) {
                images.push(att.url);
              }
            });
          });
        }
      } catch (err) {
        console.error(`Erreur lors de la récupération des images du thread ${row.discord_thread_id}:`, err);
      }

      return {
        id: row.incident_id,
        date: row.date_incident.toISOString().split('T')[0],
        heure: row.heure_incident,
        officier: row.officier_redacteur,
        grade: row.grade,
        recit: row.recit,
        implique: row.officier_implique,
        type: row.type_rapport,
        lieu: row.lieu_incident,
        threadId: row.discord_thread_id,
        images
      };
    }));

    res.json(withImages);

  } catch (err) {
    console.error('Erreur GET /api/incidents :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


module.exports = router;
