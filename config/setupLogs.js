const express = require("express");
const router = express.Router();
const pool = require("./db");
const { loadConfig, getConfig, getBot } = require("./config");
const { EmbedBuilder } = require("discord.js");

async function safeFetchChannel(bot, channelId) {
  try {
    return await bot.channels.fetch(channelId);
  } catch (err) {
    console.error(`Impossible de récupérer le salon ${channelId}:`, err.message);
    return null;
  }
}

// GET log config
router.get("/api/logs-config", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM configlspd LIMIT 1");
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Configuration introuvable" });
    }
    // Only return log channel fields
    const conf = result.rows[0];
    res.json({
      logs_pointeuse: conf.logs_pointeuse,
      logs_config: conf.logs_config,
      logs_connexion: conf.logs_connexion,
      logs_bracelets: conf.logs_bracelets,
      logs_arrestations: conf.logs_arrestations,
      logs_incidents: conf.logs_incidents,
      logs_convocations: conf.logs_convocations,
      logs_convocations_agent: conf.logs_convocations_agent,
      logs_documentation: conf.logs_documentation,
      logs_rapport_rookie: conf.logs_rapport_rookie,
      logs_sanctions: conf.logs_sanctions,
      logs_tickets: conf.logs_tickets,
      logs_calendrier: conf.logs_calendrier,
      logs_trello: conf.logs_trello
    });
  } catch (err) {
    console.error("Erreur get logs config:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// PUT log config
router.put("/api/logs-config", async (req, res) => {
  const {
    logs_pointeuse,
    logs_config,
    logs_connexion,
    logs_bracelets,
    logs_arrestations,
    logs_incidents,
    logs_convocations,
    logs_convocations_agent,
    logs_documentation,
    logs_rapport_rookie,
    logs_sanctions,
    logs_tickets,
    logs_calendrier,
    logs_trello
  } = req.body;

  try {
    const oldResult = await pool.query("SELECT * FROM configlspd LIMIT 1");
    const oldConfig = oldResult.rows[0];
    const result = await pool.query(
      `UPDATE configlspd SET 
        logs_pointeuse = ?,
        logs_config = ?,
        logs_connexion = ?,
        logs_bracelets = ?,
        logs_arrestations = ?,
        logs_incidents = ?,
        logs_convocations = ?,
        logs_convocations_agent = ?,
        logs_documentation = ?,
        logs_rapport_rookie = ?,
        logs_sanctions = ?,
        logs_tickets = ?,
        logs_calendrier = ?,
        logs_trello = ?
       WHERE id = 1`,
      [
        logs_pointeuse,
        logs_config,
        logs_connexion,
        logs_bracelets,
        logs_arrestations,
        logs_incidents,
        logs_convocations,
        logs_convocations_agent,
        logs_documentation,
        logs_rapport_rookie,
        logs_sanctions,
        logs_tickets,
        logs_calendrier,
        logs_trello
      ]
    );
    await loadConfig();
    const conf = getConfig();
    // Log modifications in logs_config
    if (conf.logs_config && req.user) {
      const bot = getBot();
      const logsChannel = await safeFetchChannel(bot, conf.logs_config);
      if (!logsChannel) {
        console.warn(`Salon logs_config introuvable (ID: ${conf.logs_config}), aucun log ne sera envoyé.`);
      }
      // For each field, log if changed
      const fields = [
        "logs_pointeuse", "logs_config", "logs_connexion", "logs_bracelets", "logs_arrestations", "logs_incidents", "logs_convocations", "logs_convocations_agent", "logs_documentation", "logs_rapport_rookie", "logs_sanctions", "logs_tickets", "logs_calendrier"
      ];
      for (const key of fields) {
        if (oldConfig[key] !== req.body[key] && logsChannel) {
          const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle(`Salon ${key} modifié`)
            .setDescription(`<@${req.user.id}> a modifié la configuration du salon ${key}`)
            .addFields({
              name: "ID's",
              value: `> <@${req.user.id}> (\`${req.user.id}\`)\n> Avant: ${oldConfig[key] ? `<#${oldConfig[key]}> (\`${oldConfig[key]}\`)` : "Non défini"}\n> Après: ${req.body[key] ? `<#${req.body[key]}> (\`${req.body[key]}\`)` : "Non défini"}`,
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
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erreur update logs config:", err);
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
  }
});

module.exports = router;
