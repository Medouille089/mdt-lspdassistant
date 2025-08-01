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

    // Rapports aujourd’hui
    const incidentsTodayRes = await pool.query(`
      SELECT COUNT(*) FROM incidents
      WHERE date_incident BETWEEN $1 AND $2
    `, [todayStart, todayEnd]);

    const arrestationsTodayRes = await pool.query(`
      SELECT COUNT(*) FROM lspd_arrestations
      WHERE date_arrestation BETWEEN $1 AND $2
    `, [todayStart, todayEnd]);

    const interventionsToday =
      parseInt(incidentsTodayRes.rows[0].count, 10) +
      parseInt(arrestationsTodayRes.rows[0].count, 10);

    // Rapports totaux
    const incidentsTotalRes = await pool.query(`SELECT COUNT(*) FROM incidents`);
    const arrestationsTotalRes = await pool.query(`SELECT COUNT(*) FROM lspd_arrestations`);

    const totalReports =
      parseInt(incidentsTotalRes.rows[0].count, 10) +
      parseInt(arrestationsTotalRes.rows[0].count, 10);

    // Derniers rapports
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
        row.date = moment(row.date).format('YYYY-MM-DD');
        datetime = moment.tz(`${row.date}T${row.heure}`, 'YYYY-MM-DDTHH:mm', 'Europe/Paris');
      } else {
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
      totalReports,
      interventionsToday,
      braceletCount,
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

router.get('/api/activity', async (req, res) => {
  try {
    const startDate = moment().tz('Europe/Paris').subtract(29, 'days').startOf('day');
    const endDate = moment().tz('Europe/Paris').endOf('day');

    const [incidentsRes, arrestationsRes, braceletsRes, convocationsRes] = await Promise.all([
      pool.query(`
        SELECT date_incident::date AS date, COUNT(*) 
        FROM incidents 
        WHERE date_incident BETWEEN $1 AND $2 
        GROUP BY date 
        ORDER BY date
      `, [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]),

      pool.query(`
        SELECT date_arrestation::date AS date, COUNT(*) 
        FROM lspd_arrestations 
        WHERE date_arrestation BETWEEN $1 AND $2 
        GROUP BY date 
        ORDER BY date
      `, [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]),

      pool.query(`
        SELECT date_debut::date AS date, COUNT(*) 
        FROM bracelets 
        WHERE date_debut BETWEEN $1 AND $2 
        GROUP BY date 
        ORDER BY date
      `, [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]),

      pool.query(`
        SELECT date::date AS date, COUNT(*) 
        FROM lspd_convocations 
        WHERE date BETWEEN $1 AND $2 
        GROUP BY date 
        ORDER BY date
      `, [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')])
    ]);

    const mapByDate = {};

    for (let i = 0; i < 30; i++) {
      const d = startDate.clone().add(i, 'days').format('YYYY-MM-DD');
      mapByDate[d] = { date: d, incidents: 0, arrestations: 0, bracelets: 0, convocations: 0 };
    }

    incidentsRes.rows.forEach(r => {
      const date = moment(r.date).format('YYYY-MM-DD');
      if (mapByDate[date]) mapByDate[date].incidents = parseInt(r.count);
    });

    arrestationsRes.rows.forEach(r => {
      const date = moment(r.date).format('YYYY-MM-DD');
      if (mapByDate[date]) mapByDate[date].arrestations = parseInt(r.count);
    });

    braceletsRes.rows.forEach(r => {
      const date = moment(r.date).format('YYYY-MM-DD');
      if (mapByDate[date]) mapByDate[date].bracelets = parseInt(r.count);
    });

    convocationsRes.rows.forEach(r => {
      const date = moment(r.date).format('YYYY-MM-DD');
      if (mapByDate[date]) mapByDate[date].convocations = parseInt(r.count);
    });

    const result = Object.values(mapByDate);
    res.json(result);
  } catch (err) {
    console.error("Erreur chargement activité :", err);
    res.status(500).json({ error: "Erreur chargement activité" });
  }
});

module.exports = router;
