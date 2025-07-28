const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { getBot } = require("../config/config")
const { DateTime } = require("luxon");

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

// ✅ POST - Ajoute ou met à jour un rôle
router.post("/config/pointeuse", async (req, res) => {
  try {
    const { role_id, role_name, salary_rate, rank } = req.body;

    if (!role_id || !role_name || !salary_rate || rank === undefined) {
      return res.status(400).json({ error: "Champs manquants" });
    }

    await pool.query(`
      INSERT INTO lspd_config_pointage (discord_role_id, role_name, salary_rate, rank)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (discord_role_id)
      DO UPDATE SET role_name = $2, salary_rate = $3, rank = $4
    `, [role_id, role_name, salary_rate, rank]);

    res.json({ success: true });
  } catch (err) {
    console.error("Erreur POST /config/pointeuse:", err);
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

// ✅ GET - Liste des utilisateurs avec leur total de salaire
router.get("/admin/pointeuse/users", async (req, res) => {
  try {
    // Dates limites semaine courante
    const nowParis = DateTime.now().setZone("Europe/Paris");
    const startOfWeek = nowParis.startOf("week").startOf("day").toISO();
    const endOfWeek = nowParis.endOf("week").endOf("day").toISO();

    // Dates limites semaine précédente
    const startOfLastWeek = nowParis.minus({ weeks: 1 }).startOf("week").startOf("day").toISO();
    const endOfLastWeek = nowParis.minus({ weeks: 1 }).endOf("week").endOf("day").toISO();

    // On récupère pour chaque utilisateur le salaire gagné cette semaine et la semaine dernière
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

    // Ajout display_name en récupérant les membres Discord
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

// ✅ DELETE - Supprime toutes les lignes d’un utilisateur
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

module.exports = router;
