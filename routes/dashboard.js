const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const moment = require('moment-timezone');

router.get('/api/dashboard', async (req, res) => {
  try {
    const parisNow = moment().tz('Europe/Paris');
    const todayStart = parisNow.clone().startOf('day').format('YYYY-MM-DD');
    const todayEnd = parisNow.clone().endOf('day').format('YYYY-MM-DD');

    const braceletsRes = await pool.query('SELECT COUNT(*) FROM bracelets');
    const braceletCount = parseInt(braceletsRes.rows[0].count, 10);

    const incidentsRes = await pool.query(`
      SELECT COUNT(*) FROM incidents
      WHERE date_incident BETWEEN $1 AND $2
    `, [todayStart, todayEnd]);

    const arrestationsRes = await pool.query(`
      SELECT COUNT(*) FROM lspd_arrestations
      WHERE date_arrestation BETWEEN $1 AND $2
    `, [todayStart, todayEnd]);

    const interventionsToday =
      parseInt(incidentsRes.rows[0].count, 10) +
      parseInt(arrestationsRes.rows[0].count, 10);

    const lastReportsRes = await pool.query(`
      SELECT
        incident_id as id,
        date_incident AS date,
        heure_incident AS heure,
        officier_redacteur AS officier_name,
        'Incident' AS type
      FROM incidents

      UNION ALL

      SELECT
        arrestation_id as id,
        date_arrestation AS date,
        NULL AS heure,
        officer AS officier_name,
        'Arrestation' AS type
      FROM lspd_arrestations

      ORDER BY date DESC, heure DESC NULLS LAST
      LIMIT 5
    `);

    const latestReports = lastReportsRes.rows.map(row => {
      let datetime;
      if (row.heure) {
        console.log("Row date:", row.date, "Row heure:", row.heure);
        row.date = moment(row.date).format('YYYY-MM-DD');
        datetime = moment.tz(`${row.date}T${row.heure}`, 'YYYY-MM-DDTHH:mm', 'Europe/Paris');
        console.log("Parsed datetime:", datetime);
      } else {
        console.log("Row date only:", row.date);
        row.date = moment(row.date).format('YYYY-MM-DDTHH:mm');
        datetime = moment.tz(row.date, 'YYYY-MM-DDTHH:mm', 'Europe/Paris');
      }

      return {
        id: row.id,
        date: datetime.format('DD/MM HH:mm'),
        agent: row.officier_name,
        type: row.type
      };
    });

    res.json({
      braceletCount,
      interventionsToday,
      latestReports
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur chargement dashboard' });
  }
});

router.get('/api/connected-agents', async (req, res) => {
  try {
    const query = `
      SELECT user_id, display_name, last_seen
      FROM lspd_live_users
      WHERE last_seen > NOW() - INTERVAL '10 minutes'
      ORDER BY last_seen DESC
    `;

    const { rows } = await pool.query(query);

    res.json({ agents: rows });
  } catch (err) {
    console.error("Erreur récupération agents connectés :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
