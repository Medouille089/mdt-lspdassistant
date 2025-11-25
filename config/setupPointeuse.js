const express = require("express");
const router = express.Router();
const pool = require("./db");
const { DateTime } = require("luxon");
const { EmbedBuilder } = require("discord.js");
const { getBot } = require("./config");

// Fonction générique pour logger un changement de config de rôle / salaire / grade
async function logConfigPointageChange(oldData, newData, userId, displayName) {
  const bot = getBot();
  const res = await pool.query(`SELECT logs_config FROM configlspd WHERE id = 1`);
  if (!res.rows.length || !res.rows[0].logs_config) return;

  const logsChannel = await bot.channels.fetch(res.rows[0].logs_config);
  if (!logsChannel?.isTextBased()) return;

  const fields = Object.keys(newData).map(key => ({
    name: key,
    value: `> Avant: \`${oldData[key] ?? "N/A"}\`\n> Après: \`${newData[key] ?? "N/A"}\``,
    inline: false
  }));

  // Ajout du field pour l'utilisateur avec ping
  fields.push({
    name: "ID's",
    value: `> <@${userId}> (\`${userId}\`)`,
    inline: false
  });

  const timestampParis = DateTime.now().setZone("Europe/Paris").toISO();

  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle("Configuration Pointeuse modifiée")
    .setDescription(`${displayName} a modifié une configuration de rôle`)
    .addFields(fields)
    .setFooter({
      text: "LSPD Assistant",
      iconURL: bot.user.displayAvatarURL({ extension: "png", size: 256 }),
    })
    .setTimestamp(DateTime.fromISO(timestampParis).toJSDate());

  await logsChannel.send({ embeds: [embed] });
}

// POST - Ajout / Modification
router.post('/config/pointeuse', async (req, res) => {
  const { id, discord_role_id, role_name, salary_rate, rank } = req.body;
  try {
    const bot = getBot();
    const guild = bot.guilds.cache.first();
    let displayName = "Utilisateur inconnu";
    if (req.user?.id && guild) {
      const member = await guild.members.fetch(req.user.id).catch(() => null);
      if (member) displayName = member.displayName;
    }

    if (id) {
      // Récupère l'ancienne config pour logger
      const oldRes = await pool.query(`SELECT * FROM lspd_config_pointage WHERE id=?`, [id]);
      const oldData = oldRes.rows[0];

      // Update
      await pool.query(`
        UPDATE lspd_config_pointage 
        SET discord_role_id=?, role_name=?, salary_rate=?, rank=? 
        WHERE id=?
      `, [discord_role_id, role_name, salary_rate, rank, id]);

      // Log les changements
      await logConfigPointageChange(oldData, { discord_role_id, role_name, salary_rate, rank }, req.user?.id || "Inconnu", displayName);
    } else {
      // Insert
      await pool.query(`
        INSERT INTO lspd_config_pointage (discord_role_id, role_name, salary_rate, rank)
        VALUES (?, ?, ?, ?)
      `, [discord_role_id, role_name, salary_rate, rank]);

      // Log l'ajout
      await logConfigPointageChange({}, { discord_role_id, role_name, salary_rate, rank }, req.user?.id || "Inconnu", displayName);
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Erreur POST /config/pointeuse:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// DELETE - Supprime un rôle
router.delete("/config/pointeuse/:role_id", async (req, res) => {
  try {
    const { role_id } = req.params;
    const bot = getBot();
    const guild = bot.guilds.cache.first();
    let displayName = "Utilisateur inconnu";
    if (req.user?.id && guild) {
      const member = await guild.members.fetch(req.user.id).catch(() => null);
      if (member) displayName = member.displayName;
    }

    // Récupère le rôle avant suppression pour logger
    const oldRes = await pool.query(`SELECT * FROM lspd_config_pointage WHERE id=?`, [role_id]);
    const oldData = oldRes.rows[0];

    await pool.query(`DELETE FROM lspd_config_pointage WHERE id = ?`, [role_id]);

    // Log suppression
    await logConfigPointageChange(oldData, {}, req.user?.id || "Inconnu", displayName);

    res.json({ success: true });
  } catch (err) {
    console.error("Erreur DELETE /config/pointeuse/:role_id:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// DELETE - Supprime tous les pointages d’un utilisateur
router.delete("/admin/pointeuse/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const bot = getBot();
    const guild = bot.guilds.cache.first();
    let displayName = "Utilisateur inconnu";
    if (req.user?.id && guild) {
      const member = await guild.members.fetch(req.user.id).catch(() => null);
      if (member) displayName = member.displayName;
    }

    // Récupère le total avant suppression pour logger
    const oldRes = await pool.query(`SELECT * FROM lspd_pointage WHERE id_discord=?`, [id]);
    const oldData = oldRes.rows;

    await pool.query(`DELETE FROM lspd_pointage WHERE id_discord = ?`, [id]);

    if (oldData.length) {
      const resChannel = await pool.query(`SELECT logs_config FROM configlspd WHERE id = 1`);
      if (resChannel.rows.length && resChannel.rows[0].logs_config) {
        const logsChannel = await bot.channels.fetch(resChannel.rows[0].logs_config);
        if (logsChannel?.isTextBased()) {
          const timestampParis = DateTime.now().setZone("Europe/Paris").toISO();

          // Récupération du displayName de la cible si possible
          let targetDisplayName = id;
          try {
            const memberTarget = await logsChannel.guild.members.fetch(id).catch(() => null);
            if (memberTarget) targetDisplayName = memberTarget.displayName;
          } catch { }

          const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle(`Suppression des pointages`)
            .setDescription(`${displayName} a supprimé tous les pointages de ${targetDisplayName}`)
            .addFields({
              name: "ID's",
              value: `> <@${req.user?.id || "Inconnu"}> (\`${req.user?.id || "Inconnu"}\`)\n> <@${id}> (\`${id}\`)`,
              inline: false,
            })
            .setFooter({
              text: "LSPD Assistant",
              iconURL: bot.user.displayAvatarURL({ extension: "png", size: 256 }),
            })
            .setTimestamp(DateTime.fromISO(timestampParis).toJSDate());

          await logsChannel.send({ embeds: [embed] });
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Erreur DELETE /admin/pointeuse/users/:id:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET - Liste tous les rôles config LSPD
router.get("/config/pointeuse", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM lspd_config_pointage ORDER BY rank ASC`);
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur GET /config/pointeuse:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET - Liste des utilisateurs avec leurs salaires hebdo
router.get("/admin/pointeuse/users", async (req, res) => {
  try {
    const nowParis = DateTime.now().setZone("Europe/Paris");
    const startOfWeek = nowParis.startOf("week").startOf("day").toISO();
    const endOfWeek = nowParis.endOf("week").endOf("day").toISO();
    const startOfLastWeek = nowParis.minus({ weeks: 1 }).startOf("week").startOf("day").toISO();
    const endOfLastWeek = nowParis.minus({ weeks: 1 }).endOf("week").endOf("day").toISO();

    const result = await pool.query(`
      WITH current_week AS (
        SELECT id_discord, SUM(salary_earned) AS total_current_week
        FROM lspd_pointage
        WHERE start_time >= ? AND start_time <= ?
        GROUP BY id_discord
      ),
      last_week AS (
        SELECT id_discord, SUM(salary_earned) AS total_last_week
        FROM lspd_pointage
        WHERE start_time >= ? AND start_time <= ?
        GROUP BY id_discord
      )
      SELECT
        COALESCE(cw.id_discord, lw.id_discord) AS id_discord,
        COALESCE(cw.total_current_week, 0) AS total_current_week,
        COALESCE(lw.total_last_week, 0) AS total_last_week
      FROM current_week cw
      FULL OUTER JOIN last_week lw
      ON cw.id_discord = lw.id_discord
      ORDER BY total_current_week DESC
    `, [startOfWeek, endOfWeek, startOfLastWeek, endOfLastWeek]);

    const guild = getBot().guilds.cache.first();
    const allMembers = await guild.members.fetch();

    const usersWithNames = result.rows.map(row => {
      const member = allMembers.get(row.id_discord);
      return {
        id_discord: row.id_discord,
        display_name: member ? member.displayName : "Utilisateur inconnu ou non présent",
        total_current_week: +parseFloat(row.total_current_week).toFixed(2),
        total_last_week: +parseFloat(row.total_last_week).toFixed(2),
      };
    });

    res.json(usersWithNames);

  } catch (err) {
    console.error("Erreur GET /admin/pointeuse/users:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET - Récupérer l'heure d'alerte pointeuse
router.get("/config/pointeuse/heure", async (req, res) => {
  try {
    const result = await pool.query(`SELECT heure_pointeuse_alerte FROM configlspd WHERE id = 1`);
    const heure = result.rows[0]?.heure_pointeuse_alerte || null;
    res.json({ heure_pointeuse_alerte: heure });
  } catch (err) {
    console.error("Erreur GET /config/pointeuse/heure:", err);
    res.status(500).json({ error: "Erreur chargement heure" });
  }
});

// POST - Modifier l'heure d'alerte pointeuse
router.post("/config/pointeuse/heure", async (req, res) => {
  try {
    const { heure } = req.body;
    if (!heure) return res.status(400).json({ error: "Heure invalide" });

    // Récupère l'ancienne heure pour le log
    const oldRes = await pool.query(`SELECT heure_pointeuse_alerte FROM configlspd WHERE id = 1`);
    const oldHeure = oldRes.rows[0]?.heure_pointeuse_alerte || null;

    // Met à jour dans la base
    await pool.query(`UPDATE configlspd SET heure_pointeuse_alerte = ? WHERE id = 1`, [heure]);

    // Log de la modification
    if (req.user?.id) {
      await logHeurePointeuseChange(oldHeure, heure, req.user.id);
    }

    res.json({ success: true, heure_pointeuse_alerte: heure });
  } catch (err) {
    console.error("Erreur POST /config/pointeuse/heure:", err);
    res.status(500).json({ error: "Erreur sauvegarde heure" });
  }
});

// LOG - Changement d'heure de fin de pointage
async function logHeurePointeuseChange(oldHeure, newHeure, userId) {
  const bot = getBot();
  const res = await pool.query(`SELECT logs_pointeuse FROM configlspd WHERE id = 1`);
  if (!res.rows.length || !res.rows[0].logs_pointeuse) return;

  const logsChannel = await bot.channels.fetch(res.rows[0].logs_pointeuse);
  if (!logsChannel?.isTextBased()) return;

  const member = await logsChannel.guild.members.fetch(userId).catch(() => null);
  const displayName = member ? member.displayName : "Utilisateur inconnu";

  const timestampParis = DateTime.now().setZone("Europe/Paris").toISO();

  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle("Heure fin pointage modifiée")
    .setDescription(`${displayName} a modifié l'heure de la fin de pointage.`)
    .addFields({
      name: "ID's",
      value: `> <@${userId}> (\`${userId}\`)\n> Avant : \`${oldHeure}\`\n> Après : \`${newHeure}\``,
      inline: false,
    })
    .setFooter({
      text: "LSPD Assistant",
      iconURL: bot.user.displayAvatarURL({ extension: "png", size: 256 }),
    })
    .setTimestamp(DateTime.fromISO(timestampParis).toJSDate());

  await logsChannel.send({ embeds: [embed] });
}

module.exports = router;
