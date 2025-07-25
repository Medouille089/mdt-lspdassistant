const express = require("express");
const router = express.Router();
const pool = require("./db");
const { loadConfig, getConfig, getBot } = require("./config");

const { EmbedBuilder } = require("discord.js");

// Fonction utilitaire pour fetch un channel avec gestion d'erreur
async function safeFetchChannel(bot, channelId) {
  try {
    return await bot.channels.fetch(channelId);
  } catch (err) {
    console.error(`Impossible de récupérer le salon ${channelId}:`, err.message);
    return null;
  }
}

// GET config
router.get("/api/config", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM configlspd LIMIT 1");
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Configuration introuvable" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erreur get config:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// PUT config
router.put("/api/config", async (req, res) => {
  const {
    required_role_id,
    supervisor_role_id,
    thread_id,
    archive_tag,
    logs_channel,
    commandstaff_id,
    convocation_id,
    incident_thread_id,
    arrestation_thread_id, // Ajout du champ arrestation_thread_id
  } = req.body;

  try {
    const oldResult = await pool.query("SELECT * FROM configlspd LIMIT 1");
    const oldConfig = oldResult.rows[0];

    const result = await pool.query(
      `UPDATE configlspd SET 
        required_role_id = $1,
        supervisor_role_id = $2,
        thread_id = $3,
        archive_tag = $4,
        logs_channel = $5,
        commandstaff_id = $6,
        convocation_id = $7,
        incident_thread_id = $8,
        arrestation_thread_id = $9
       WHERE id = 1 RETURNING *`,
      [
        required_role_id,
        supervisor_role_id,
        thread_id,
        archive_tag,
        logs_channel,
        commandstaff_id,
        convocation_id,
        incident_thread_id,
        arrestation_thread_id
      ]
    );

    await loadConfig();

    // ---- Préparer le log ----
    const conf = getConfig();

    if (conf.logs_channel && req.user) {
      const bot = getBot();

      // Récupération sécurisée du salon logs
      const logsChannel = await safeFetchChannel(bot, conf.logs_channel);
      if (!logsChannel) {
        console.warn(`Salon logs introuvable (ID: ${conf.logs_channel}), aucun log ne sera envoyé.`);
      }

      // Log rôle requis
      if (oldConfig.required_role_id !== required_role_id && logsChannel) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle("Rôle requis modifié")
          .setDescription(`<@${req.user.id}> a modifié la configuration du rôle requis`)
          .addFields({
            name: "ID's",
            value: `> <@${req.user.id}> (\`${req.user.id}\`)\n> Avant: <@&${oldConfig.required_role_id}> (\`${oldConfig.required_role_id}\`)\n> Après: <@&${required_role_id}> (\`${required_role_id}\`)`,
            inline: false,
          })
          .setFooter({
            text: "LSPD Assistant",
            iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 }),
          })
          .setTimestamp();

        await logsChannel.send({ embeds: [embed] });
      }

      // Log rôle superviseur
      if (oldConfig.supervisor_role_id !== supervisor_role_id && logsChannel) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle("Rôle Superviseur modifié")
          .setDescription(`<@${req.user.id}> a modifié la configuration du rôle superviseur`)
          .addFields({
            name: "ID's",
            value: `> <@${req.user.id}> (\`${req.user.id}\`)\n> Avant: <@&${oldConfig.supervisor_role_id}> (\`${oldConfig.supervisor_role_id}\`)\n> Après: <@&${supervisor_role_id}> (\`${supervisor_role_id}\`)`,
            inline: false,
          })
          .setFooter({
            text: "LSPD Assistant",
            iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 }),
          })
          .setTimestamp();

        await logsChannel.send({ embeds: [embed] });
      }

      // Log thread_id
      if (oldConfig.thread_id !== thread_id && logsChannel) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle("🔧 Thread ID Bracelets modifié")
          .setDescription(`<@${req.user.id}> a modifié la configuration de l'ID du thread des bracelets`)
          .addFields({
            name: "ID's",
            value: `> <@${req.user.id}> (\`${req.user.id}\`)\n> Avant: <#${oldConfig.thread_id}> (\`${oldConfig.thread_id}\`)\n> Après: <#${thread_id}> (\`${thread_id}\`)`,
            inline: false,
          })
          .setFooter({
            text: "LSPD Assistant",
            iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 }),
          })
          .setTimestamp();

        await logsChannel.send({ embeds: [embed] });
      }

      // Log archive_tag
      if (oldConfig.archive_tag !== archive_tag && logsChannel) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle("Tag d'archives bracelets modifié")
          .setDescription(`<@${req.user.id}> a modifié la configuration du tag d'archive des bracelets`)
          .addFields({
            name: "ID's",
            value: `> <@${req.user.id}> (\`${req.user.id}\`)\n> Avant: \`${oldConfig.archive_tag}\`\n> Après: \`${archive_tag}\``,
            inline: false,
          })
          .setFooter({
            text: "LSPD Assistant",
            iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 }),
          })
          .setTimestamp();

        await logsChannel.send({ embeds: [embed] });
      }

      // Log logs_channel
      if (oldConfig.logs_channel !== logs_channel && logsChannel) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle("Salon des logs modifié")
          .setDescription(`<@${req.user.id}> a modifié la configuration du salon des logs`)
          .addFields({
            name: "ID's",
            value: `> <@${req.user.id}> (\`${req.user.id}\`)\n> Avant: <#${oldConfig.logs_channel}> (\`${oldConfig.logs_channel}\`)\n> Après: <#${logs_channel}> (\`${logs_channel}\`)`,
            inline: false,
          })
          .setFooter({
            text: "LSPD Assistant",
            iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 }),
          })
          .setTimestamp();

        await logsChannel.send({ embeds: [embed] });
      }

      // Log rôle command staff
      if (oldConfig.commandstaff_id !== commandstaff_id && logsChannel) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle("Rôle Command Staff modifié")
          .setDescription(`<@${req.user.id}> a modifié la configuration du rôle command staff`)
          .addFields({
            name: "ID's",
            value: `> <@${req.user.id}> (\`${req.user.id}\`)\n> Avant: <@&${oldConfig.commandstaff_id}> (\`${oldConfig.commandstaff_id}\`)\n> Après: <@&${commandstaff_id}> (\`${commandstaff_id}\`)`,
            inline: false,
          })
          .setFooter({
            text: "LSPD Assistant",
            iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 }),
          })
          .setTimestamp();

        await logsChannel.send({ embeds: [embed] });
      }

      // Log convocation_id (avec safe fetch)
      if (oldConfig.convocation_id !== convocation_id) {
        const convocationChannel = await safeFetchChannel(bot, convocation_id);

        if (convocationChannel) {
          const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle("Salon Convocation modifié")
            .setDescription(`<@${req.user.id}> a modifié la configuration du salon convocation`)
            .addFields({
              name: "ID's",
              value: `> <@${req.user.id}> (\`${req.user.id}\`)\n> Avant: <#${oldConfig.convocation_id}> (\`${oldConfig.convocation_id}\`)\n> Après: <#${convocation_id}> (\`${convocation_id}\`)`,
              inline: false,
            })
            .setFooter({
              text: "LSPD Assistant",
              iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 }),
            })
            .setTimestamp();

          await convocationChannel.send({ embeds: [embed] });
        }
      }

      // Log incident_thread_id (avec safe fetch)
      if (oldConfig.incident_thread_id !== incident_thread_id && logsChannel) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle("🔧 Thread ID Incidents modifié")
          .setDescription(`<@${req.user.id}> a modifié la configuration de l'ID du thread des incidents`)
          .addFields({
            name: "ID's",
            value: `> <@${req.user.id}> (\`${req.user.id}\`)\n> Avant: <#${oldConfig.incident_thread_id}> (\`${oldConfig.incident_thread_id}\`)\n> Après: <#${incident_thread_id}> (\`${incident_thread_id}\`)`,
            inline: false,
          })
          .setFooter({
            text: "LSPD Assistant",
            iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 }),
          })
          .setTimestamp();

        await logsChannel.send({ embeds: [embed] });
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erreur update config:", err);
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

module.exports = router;
