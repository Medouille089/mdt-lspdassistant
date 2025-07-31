const express = require("express");
const router = express.Router();
const multer = require("multer");
const pool = require("../config/db");
const config = require("../config/config");
const { getBot } = require("../config/config");
const { AttachmentBuilder, EmbedBuilder, ChannelType } = require("discord.js");
const upload = multer({ storage: multer.memoryStorage() });

async function createOrGetThread(forum, situationsChannel, situationsArray, data) {
  const { incidentId, formattedDate, officier, embed, recit } = data;

  try {
    if (situationsArray && situationsArray.length > 0) {
      console.log("Tentative de récupération du thread situation:", situationsArray);

      const activeThreads = await situationsChannel.threads.fetch();

      for (const situationData of situationsArray) {
        if (situationData.id) {
          const existingThread = activeThreads.threads.get(situationData.id);
          if (existingThread) {
            console.log(`Thread situation trouvé: ${existingThread.name} (${existingThread.id})`);

            return existingThread;
          }
        }
      }

      console.log("Aucun thread situation valide trouvé, création d'un nouveau thread dans le forum incidents");
    }

    const newThread = await forum.threads.create({
      name: `${incidentId} - ${formattedDate} - ${officier}`,
      message: {
        embeds: [embed],
        content: `**Récit des faits :**\n${recit || 'Aucun récit fourni'}`
      }
    });

    console.log(`Nouveau thread créé dans incidents: ${newThread.name} (${newThread.id})`);
    return newThread;

  } catch (error) {
    console.error("Erreur lors de la gestion du thread:", error);

    const fallbackThread = await forum.threads.create({
      name: `${incidentId} - ${formattedDate} - ${officier}`,
      message: {
        embeds: [embed],
        content: `**Récit des faits :**\n${recit || 'Aucun récit fourni'}`
      }
    });

    console.log(`Thread fallback créé: ${fallbackThread.name} (${fallbackThread.id})`);
    return fallbackThread;
  }
}

router.post("/api/incident", upload.array("pieces"), async (req, res) => {
  const bot = getBot();
  const conf = await config.getConfig();
  const situationForumChannelId = conf.situations_thread_id;
  const forumChannelId = conf.incident_thread_id;
  const logsChannelId = conf.logs_channel;
  try {
    const {
      date, heure, officier, grade,
      recit, implique, type, lieu, situations
    } = req.body;
    const files = req.files;
    const situationsArray = JSON.parse(situations || "[]");

    console.log("Données reçues:");
    console.log("- situations (raw):", situations);
    console.log("- situationsArray (parsed):", situationsArray);
    console.log("- Type de situationsArray:", Array.isArray(situationsArray) ? 'Array' : typeof situationsArray);

    const forum = await bot.channels.fetch(forumChannelId);
    const situationsChannel = await bot.channels.fetch(situationForumChannelId);
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

    const thread = await createOrGetThread(forum, situationsChannel, situationsArray, {
      incidentId,
      formattedDate,
      officier,
      embed,
      recit
    });

    console.log(`Thread utilisé : ${thread.id}`);

    if (files?.length > 0) {
      for (const file of files) {
        const attachment = new AttachmentBuilder(file.buffer, {
          name: file.originalname
        });
        await thread.send({ files: [attachment] });
      }
    }

    thread.setLocked(true);

    await pool.query(`
      INSERT INTO incidents 
      (incident_id, date_incident, heure_incident, officier_redacteur, grade, recit, officier_implique, type_rapport, lieu_incident, discord_thread_id, discord_message_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `, [
      incidentId, date, heure, officier, grade,
      recit, implique, type, lieu, thread.id, thread.lastMessageId
    ]);

    const logsChannel = await bot.channels.fetch(logsChannelId);
    if (logsChannel?.isTextBased()) {
      const embedLog = new EmbedBuilder()
        .setColor(0x0b1b5a)
        .setTitle(`Nouveau rapport d'incident - ${incidentId}`)
        .setDescription(`<@${req.user?.id}> a créé un nouveau rapport - <#${thread.id}> \`${incidentId}\``)
        .addFields({
          name: "ID's",
          value: `> ${req.user?.id || 'Utilisateur inconnu'}> (\`${req.user?.id || 'ID inconnu'}\`) \n> <#${thread.id}> (\`${thread.id}\`)`,
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
        discord_thread_id,
        discord_message_id
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

    const { incidentId, date, heure, officier, grade, recit, implique, type, lieu, discord_thread_id, messageId, editBy } = req.body;
    const files = req.files;

    if (!incidentId) {
      return res.status(400).json({ error: 'incidentId manquant' });
    }

    await pool.query(`
      UPDATE incidents 
      SET date_incident = $1, heure_incident = $2, officier_redacteur = $3, grade = $4, recit = $5, 
          officier_implique = $6, type_rapport = $7, lieu_incident = $8
      WHERE incident_id = $9
    `, [date, heure, officier, grade, recit, implique, type, lieu, incidentId]);

    // Si pas de discord_thread_id, on termine ici
    if (!discord_thread_id || discord_thread_id === 'null' || discord_thread_id === 'undefined') {
      console.log("Pas de thread Discord à mettre à jour");
      return res.json({ message: "Incident mis à jour avec succès (sans Discord)." });
    }


    const situationsChannel = await getBot().channels.fetch(situationsChannelId);
    const thread = await situationsChannel.threads.fetch(discord_thread_id);
    if (!thread) {
      return res.status(404).json({ error: 'Thread non trouvé ou invalide.' });
    }
    console.log(`Thread récupéré : ${thread.name} (${thread.id})`);
    const botUser = await getBot().user;
    const botMessage = await thread.messages.fetch(messageId);
    if (botMessage) {
      if (files && files.length > 0) {
        for (const file of files) {
          const attachment = new AttachmentBuilder(file.buffer, { name: file.originalname });
          await botMessage.edit({ content: `Modifié par : ${editBy} (|| <@${req.user?.id}> ||)`, files: [attachment] });
        }
      }
    }
    const logsChannel = await bot.channels.fetch(logsChannelId);
    if (logsChannel?.isTextBased()) {
      const embedLog = new EmbedBuilder()
        .setColor(0x0b1b5a)
        .setTitle(`Modification d'un rapport d'incident - ${incidentId}`)
        .setDescription(`<@${req.user?.id}> a modifié le rapport de la situation - <#${thread.id}> \`${incidentId}\` `)
        .addFields({
          name: "ID's",
          value: `> <@${req.user?.id || 'Utilisateur inconnu'}> (\`${req.user?.id || 'ID inconnu'}\`) \n> <#${thread.id}> (\`${thread.id}\`) \n> ${botMessage.url || 'Aucun message ID'} (\`${messageId}\`)`,
          inline: false
        })
        .setFooter({
          text: "LSPD Assistant",
          iconURL: botUser.displayAvatarURL({ extension: 'png', size: 256 })
        })
        .setTimestamp();

      await logsChannel.send({ embeds: [embedLog] });
      console.log('Log modification rapport envoyé');
    }


    console.log(`Thread mis à jour : ${thread.id}`);

    res.json({ message: "Incident mis à jour avec succès." });
  } catch (err) {
    console.error('Erreur PUT /api/updateIncident :', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l’incident.' });
  }
});

module.exports = router;
