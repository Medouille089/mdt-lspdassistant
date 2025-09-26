const express = require("express");
const router = express.Router();
const multer = require("multer");
const pool = require("../config/db");
const config = require("../config/config");
const { getBot } = require("../config/config");
const { AttachmentBuilder, EmbedBuilder, ChannelType } = require("discord.js");
const upload = multer({ storage: multer.memoryStorage() });

async function createOrGetThread(forum, situationsChannel, situationsArray, data, files = []) {
  const { incidentId, formattedDate, officier, embed } = data;

  try {
    // Cherche un thread existant dans les situations
    if (situationsArray && situationsArray.length > 0) {
      const activeThreads = await situationsChannel.threads.fetch();

      for (const situationData of situationsArray) {
        if (situationData.id) {
          const existingThread = activeThreads.threads.get(situationData.id);
          if (existingThread) {
            console.log(`Thread situation trouvé: ${existingThread.name} (${existingThread.id})`);

            // Envoie l'embed avec les images dans le thread existant
            if (files.length > 0) {
              const attachments = files.map(f => new AttachmentBuilder(f.buffer, { name: f.originalname }));
              await existingThread.send({ embeds: [embed], files: attachments });
            } else {
              await existingThread.send({ embeds: [embed] });
            }

            return existingThread;
          }
        }
      }

      console.log("Aucun thread situation valide trouvé, création d'un nouveau thread dans le forum incidents");
    }

    // Création d'un nouveau thread dans le forum incidents
    const newThread = await forum.threads.create({
      name: `${incidentId} - ${formattedDate} - ${officier}`,
      message: {
        embeds: [embed],
        files: files.map(f => new AttachmentBuilder(f.buffer, { name: f.originalname }))
      }
    });

    console.log(`Nouveau thread créé dans incidents: ${newThread.name} (${newThread.id})`);
    return newThread;

  } catch (error) {
    console.error("Erreur lors de la gestion du thread:", error);
    throw error;
  }
}

router.post("/api/incident", upload.array("pieces"), async (req, res) => {
  const bot = getBot();
  const conf = await config.getConfig();
  const situationForumChannelId = conf.situations_thread_id;
  const forumChannelId = conf.incident_thread_id;
  const logsChannelId = conf.logs_channel;

  try {
    const { date, heure, officier, grade, recit, implique, type, lieu, situations } = req.body;
    const situationsArray = JSON.parse(situations || "[]");

    const forum = await bot.channels.fetch(forumChannelId);
    const situationsChannel = await bot.channels.fetch(situationForumChannelId);
    const botUser = await bot.user;

    const { rows } = await pool.query("SELECT COUNT(*) FROM incidents");
    const count = parseInt(rows[0].count, 10) + 1;
    const incidentId = `INC${count.toString().padStart(4, "0")}`;

    const [yyyy, mm, dd] = date.split("-");
    const formattedDate = `${dd}/${mm}/${yyyy}`;

    const isLocal = process.env.IS_LOCAL === "true";
    const baseUrl = isLocal
      ? "http://localhost:3001/viewIncident.html"
      : "https://lspd-assistant.fr/viewIncident.html";
    const incidentLink = `${baseUrl}?id=${incidentId}`;

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
        { name: "Consulter le rapport", value: `[Voir le rapport d'incident ${incidentId}](${incidentLink})` }
      )
      .setFooter({ text: "LSPD Assistant", iconURL: botUser.displayAvatarURL() })
      .setColor(0x0b1b5a)
      .setTimestamp();

    const files = req.files || [];
    const imageFiles = (files || []).filter(f => f.mimetype.startsWith("image/"));

    const thread = await createOrGetThread(
      forum,
      situationsChannel,
      situationsArray,
      {
        incidentId,
        formattedDate,
        officier,
        embed
      }
    );

    if (imageFiles.length > 0) {
      const attachments = imageFiles.map(f => new AttachmentBuilder(f.buffer, { name: f.originalname }));
      await thread.send({ files: attachments });
    }

    thread.setLocked(true);

    // ⚡ Enregistrer en base **avec le récit**
    await pool.query(`
      INSERT INTO incidents 
      (incident_id, date_incident, heure_incident, officier_redacteur, grade, recit, officier_implique, type_rapport, lieu_incident, discord_thread_id, discord_message_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `, [
      incidentId, date, heure, officier, grade,
      recit || '', // obligatoire pour NOT NULL
      implique, type, lieu, thread.id, thread.lastMessageId
    ]);

    // ⚡ Log Discord
    const logsChannel = await bot.channels.fetch(logsChannelId);
    if (logsChannel?.isTextBased()) {
      const embedLog = new EmbedBuilder()
        .setColor(0x0b1b5a)
        .setTitle(`Nouveau rapport d'incident - ${incidentId}`)
        .setDescription(`${req.user?.guild_member.nick || 'Utilisateur inconnu'} a créé un nouveau rapport - <#${thread.id}> \`${incidentId}\``)
        .addFields({
          name: "ID's",
          value: `> <@${req.user?.id || 'Utilisateur inconnu'}> (\`${req.user?.id || 'ID inconnu'}\`) \n> <#${thread.id}> (\`${thread.id}\`)`,
          inline: false
        })
        .setFooter({ text: "LSPD Assistant", iconURL: botUser.displayAvatarURL({ extension: 'png', size: 256 }) })
        .setTimestamp();

      await logsChannel.send({ embeds: [embedLog] });
    }

    res.json({ message: "Rapport enregistré et envoyé !", incidentId, link: incidentLink });

  } catch (err) {
    console.error("Erreur API /api/incident :", err);
    res.status(500).json({ error: "Erreur lors de l’envoi du rapport." });
  }
});

router.get('/api/getIncident', async (req, res) => {
  try {
    const { id } = req.query; // possibilité de demander un incident précis
    const query = id
      ? `SELECT * FROM incidents WHERE incident_id=$1`
      : `SELECT * FROM incidents ORDER BY date_incident DESC, heure_incident DESC`;

    const params = id ? [id] : [];
    const result = await pool.query(query, params);
    const bot = getBot();

    const withImages = await Promise.all(result.rows.map(async row => {
      let images = [];
      let threadExists = true;

      if (row.discord_thread_id) {
        try {
          const thread = await bot.channels.fetch(row.discord_thread_id);
          if (!thread?.isThread()) {
            threadExists = false;
          } else {
            const messages = await thread.messages.fetch({ limit: 100 });
            messages.forEach(msg => {
              msg.attachments.forEach(att => {
                if (att.contentType?.startsWith("image/")) images.push(att.url);
              });
            });
          }
        } catch (err) {
          if (err.code !== 10003) {
            console.error(`[ERROR] Problème sur incident ${row.incident_id}:`, err);
          }
          threadExists = false; // thread introuvable ou supprimé
        }
      } else {
        threadExists = false;
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
        threadId: threadExists ? row.discord_thread_id : null,
        messageId: row.discord_message_id,
        images
      };
    }));

    res.json(withImages);

  } catch (err) {
    console.error('Erreur GET /api/incidents :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/api/getSituations', async (req, res) => {
  const bot = getBot();
  try {
    const conf = await config.getConfig();
    const forumChannelId = conf.situations_thread_id;
    const forum = await bot.channels.fetch(forumChannelId);

    const activeThreads = await forum.threads.fetch();

    const situations = Array.from(activeThreads.threads.values()).map(thread => ({
      id: thread.id,
      name: thread.name,
      createdTimestamp: thread.createdTimestamp,
      messageCount: thread.messageCount,
      archived: thread.archived,
      locked: thread.locked
    }));

    res.json(situations);
  } catch (err) {
    console.error('Erreur GET /api/getSituations :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/api/updateIncident', upload.array('pieces'), async (req, res) => {
  const conf = await config.getConfig();
  const bot = getBot();
  const situationsChannelId = conf.situations_thread_id;
  const logsChannelId = conf.logs_channel;

  try {
    const {
      incidentId, date, heure, officier, grade,
      recit, implique, type, lieu, discord_thread_id, editBy
    } = req.body;

    const files = req.files || [];
    const imageFiles = files.filter(f => f.mimetype.startsWith("image/"));

    if (!incidentId) return res.status(400).json({ error: 'incidentId manquant' });

    // Mise à jour en base
    await pool.query(`
      UPDATE incidents 
      SET date_incident=$1, heure_incident=$2, officier_redacteur=$3, grade=$4, recit=$5,
          officier_implique=$6, type_rapport=$7, lieu_incident=$8
      WHERE incident_id=$9
    `, [date, heure, officier, grade, recit, implique, type, lieu, incidentId]);

    if (!discord_thread_id || discord_thread_id === 'null' || discord_thread_id === 'undefined') {
      console.log("Pas de thread Discord à mettre à jour");
      return res.json({ message: "Incident mis à jour avec succès (sans Discord)." });
    }

    const situationsChannel = await bot.channels.fetch(situationsChannelId);
    const thread = await situationsChannel.threads.fetch(discord_thread_id);
    if (!thread) return res.status(404).json({ error: 'Thread non trouvé ou invalide.' });

    const botUser = bot.user;

    const isLocal = process.env.IS_LOCAL === "true";
    const baseUrl = isLocal
      ? "http://localhost:3001/viewIncident.html"
      : "https://lspd-assistant.fr/viewIncident.html";
    const incidentLink = `${baseUrl}?id=${incidentId}`;

    // Crée un nouvel embed pour l'update
    const embed = new EmbedBuilder()
      .setTitle("Mise à jour d'un rapport d'incident")
      .setThumbnail(botUser.displayAvatarURL({ extension: 'png' }))
      .addFields(
        { name: "ID d'incident", value: incidentId },
        { name: "Date", value: date, inline: true },
        { name: "Heure", value: heure, inline: true },
        { name: "Officier rédacteur", value: officier, inline: true },
        { name: "Grade", value: grade || "Non précisé", inline: true },
        { name: "Officiers impliqués", value: implique || "Aucun" },
        { name: "Type", value: type || "Non précisé", inline: true },
        { name: "Lieu", value: lieu || "Non précisé", inline: true },
        { name: "Consulter le rapport", value: `[Voir le rapport d'incident ${incidentId}](${incidentLink})` }
      )

      .setFooter({ text: `Modifié par ${editBy}`, iconURL: botUser.displayAvatarURL() })
      .setColor(0x0b1b5a)
      .setTimestamp();

    const message = await thread.send({ embeds: [embed] });

    // Envoie les images dans un second message
    if (imageFiles.length > 0) {
      const attachments = imageFiles.map(f => new AttachmentBuilder(f.buffer, { name: f.originalname }));
      await thread.send({ files: attachments });
    }

    const logsChannel = await bot.channels.fetch(logsChannelId);
    if (logsChannel?.isTextBased()) {
      const embedLog = new EmbedBuilder()
        .setColor(0x0b1b5a)
        .setTitle(`Modification d'un rapport d'incident - ${incidentId}`)
        .setDescription(`<@${req.user?.id}> a modifié le rapport - <#${thread.id}>`)
        .setFooter({ text: "LSPD Assistant", iconURL: botUser.displayAvatarURL({ extension: 'png', size: 256 }) })
        .setTimestamp();
      await logsChannel.send({ embeds: [embedLog] });
    }

    res.json({ message: "Incident mis à jour avec succès." });

  } catch (err) {
    console.error('Erreur PUT /api/updateIncident :', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l’incident.' });
  }
});


module.exports = router;
