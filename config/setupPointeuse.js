const express = require("express");
const router = express.Router();
const pool = require("./db");
const { DateTime } = require("luxon");
const { EmbedBuilder } = require("discord.js");
const conf = require("./config");
const { getBot } = require("./config");

// ✅ GET - Récupère l'heure de fin de pointage
router.get("/config/pointeuse/heure", async (req, res) => {
  try {
    const result = await pool.query(`SELECT heure_pointeuse_alerte FROM configlspd LIMIT 1`);
    if (result.rows.length === 0) return res.status(404).json({ error: "Pas de config trouvée" });
    res.json({ heure_pointeuse_alerte: result.rows[0].heure_pointeuse_alerte });
  } catch (err) {
    console.error("Erreur GET /config/pointeuse/heure:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✅ POST - Met à jour l'heure de fin de pointage et log si elle change
router.post("/config/pointeuse/heure", async (req, res) => {
  try {
    const { heure } = req.body; // format attendu "HH:mm"
    if (!heure || !/^\d{2}:\d{2}$/.test(heure)) {
      return res.status(400).json({ error: "Heure invalide, format attendu HH:mm" });
    }

    // Récupère l'ancienne heure
    const oldRes = await pool.query(`SELECT heure_pointeuse_alerte FROM configlspd WHERE id = 1`);
    const oldHeure = oldRes.rows.length ? oldRes.rows[0].heure_pointeuse_alerte : null;

    // Met à jour la nouvelle heure
    await pool.query(`
      UPDATE configlspd SET heure_pointeuse_alerte = $1 WHERE id = 1
    `, [heure]);

    // Log seulement si elle a changé
    if (oldHeure !== heure && oldHeure !== null) {
      await logHeurePointeuseChange(oldHeure, heure, req.user?.id || "Inconnu");
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Erreur POST /config/pointeuse/heure:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✅ GET - Liste tous les rôles config LSPD
router.get("/config/pointeuse", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM lspd_config_pointage ORDER BY rank ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur GET /config/pointeuse:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✅ DELETE - Supprime un rôle
router.delete("/config/pointeuse/:role_id", async (req, res) => {
  try {
    const { role_id } = req.params;
    await pool.query(`
      DELETE FROM lspd_config_pointage WHERE discord_role_id = $1
    `, [role_id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Erreur DELETE /config/pointeuse:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✅ GET - Liste des utilisateurs avec leurs salaires hebdo
router.get("/admin/pointeuse/users", async (req, res) => {
  try {
    const nowParis = DateTime.now().setZone("Europe/Paris");
    const startOfWeek = nowParis.startOf("week").startOf("day").toISO();
    const endOfWeek = nowParis.endOf("week").endOf("day").toISO();
    const startOfLastWeek = nowParis.minus({ weeks: 1 }).startOf("week").startOf("day").toISO();
    const endOfLastWeek = nowParis.minus({ weeks: 1 }).endOf("week").endOf("day").toISO();

    const result = await pool.query(`
      SELECT
        id_discord,
        SUM(CASE WHEN start_time >= $1 AND start_time <= $2 THEN salary_earned ELSE 0 END) AS total_current_week,
        SUM(CASE WHEN start_time >= $3 AND start_time <= $4 THEN salary_earned ELSE 0 END) AS total_last_week
      FROM lspd_pointage
      GROUP BY id_discord
      ORDER BY total_current_week DESC
    `, [startOfWeek, endOfWeek, startOfLastWeek, endOfLastWeek]);

    const guild = getBot().guilds.cache.first();

    const usersWithNames = await Promise.all(
      result.rows.map(async row => {
        try {
          const member = await guild.members.fetch(row.id_discord);
          return {
            id_discord: row.id_discord,
            display_name: member.displayName,
            total_current_week: +parseFloat(row.total_current_week).toFixed(2),
            total_last_week: +parseFloat(row.total_last_week).toFixed(2),
          };
        } catch {
          return {
            id_discord: row.id_discord,
            display_name: "Utilisateur inconnu ou non présent",
            total_current_week: +parseFloat(row.total_current_week).toFixed(2),
            total_last_week: +parseFloat(row.total_last_week).toFixed(2),
          };
        }
      })
    );

    res.json(usersWithNames);
  } catch (err) {
    console.error("Erreur GET /admin/pointeuse/users:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✅ DELETE - Supprime tous les pointages d’un utilisateur
router.delete("/admin/pointeuse/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM lspd_pointage WHERE id_discord = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Erreur DELETE /admin/pointeuse/users/:id:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✅ LOG - Changement d'heure de fin de pointage
async function logHeurePointeuseChange(oldHeure, newHeure, userId) {
  const bot = getBot();

  // 🔄 Récupération du salon log depuis la BDD
  const res = await pool.query(`
    SELECT logs_channel FROM configlspd WHERE id = 1
  `);
  if (!res.rows.length || !res.rows[0].logs_channel) return;

  const logChannelId = res.rows[0].logs_channel;
  const logsChannel = await bot.channels.fetch(logChannelId);
  if (!logsChannel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle("Heure fin pointage modifiée")
    .setDescription(`<@${userId}> a modifié l'heure de la fin de pointage.`)
    .addFields({
      name: "ID's",
      value: `> <@${userId}> (\`${userId}\`)\n> Avant : \`${oldHeure}\`\n> Après : \`${newHeure}\``,
      inline: false,
    })
    .setFooter({
      text: "LSPD Assistant",
      iconURL: bot.user.displayAvatarURL({ extension: "png", size: 256 }),
    })
    .setTimestamp();

  await logsChannel.send({ embeds: [embed] });
}

module.exports = router;
