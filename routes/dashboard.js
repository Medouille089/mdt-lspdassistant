const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const moment = require('moment-timezone');
const { cache, CACHE_DURATIONS } = require('../config/cache');

router.get('/api/dashboard', async (req, res) => {
  try {
    const cacheKey = 'dashboard:stats';
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const parisNow = moment().tz('Europe/Paris');
    const todayStart = parisNow.clone().startOf('day').format('YYYY-MM-DD');
    const todayEnd = parisNow.clone().endOf('day').format('YYYY-MM-DD');

    const braceletsRes = await pool.query('SELECT COUNT(*) FROM bracelets');
    const braceletCount = parseInt(braceletsRes.rows[0].count, 10);

    // --- Rapports aujourd’hui ---
    const incidentsTodayRes = await pool.query(`
      SELECT COUNT(*) AS count FROM incidents
      WHERE DATE(date_incident) BETWEEN ? AND ?
    `, [todayStart, todayEnd]);

    const arrestationsTodayRes = await pool.query(`
      SELECT COUNT(*) AS count FROM lspd_arrestations
      WHERE DATE(date_arrestation) BETWEEN ? AND ?
    `, [todayStart, todayEnd]);

    const interventionsToday =
      parseInt(incidentsTodayRes.rows[0].count, 10) +
      parseInt(arrestationsTodayRes.rows[0].count, 10);

    // --- Rapports totaux ---
    const incidentsTotalRes = await pool.query(`SELECT COUNT(*) AS count FROM incidents`);
    const arrestationsTotalRes = await pool.query(`SELECT COUNT(*) AS count FROM lspd_arrestations`);

    const totalReports =
      parseInt(incidentsTotalRes.rows[0].count, 10) +
      parseInt(arrestationsTotalRes.rows[0].count, 10);

    // --- Derniers rapports ---
    const lastReportsRes = await pool.query(`
      SELECT incident_id AS id, date_incident AS date, heure_incident AS heure, officier_redacteur AS officier_name, 'Incident' AS type
      FROM incidents
      UNION ALL
      SELECT arrestation_id AS id, date_arrestation AS date, NULL AS heure, officer AS officier_name, 'Arrestation' AS type
      FROM lspd_arrestations
      ORDER BY date DESC, CASE WHEN heure IS NULL THEN 1 ELSE 0 END, heure DESC
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

    const dashboardData = {
      totalReports,
      interventionsToday,
      braceletCount,
      latestReports
    };

    cache.set(cacheKey, dashboardData, 120); // 120 secondes

    res.json(dashboardData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur chargement dashboard' });
  }
});


router.get('/api/connected-agents', async (req, res) => {
  try {
    const query = `
      SELECT l.user_id, l.display_name, l.last_seen, p.photo_url
      FROM lspd_live_users l
      LEFT JOIN lspd_agent_profiles p ON l.user_id = p.discord_id
      WHERE l.last_seen > NOW() - INTERVAL 10 MINUTE
      ORDER BY l.display_name ASC
    `;

    const { rows } = await pool.query(query);

    // Ajoute avatar Discord par défaut si photo_url manquante
    const agents = rows.map(agent => {
      let avatar = agent.photo_url;
      if (!avatar && agent.user_id) {
        avatar = `https://cdn.discordapp.com/embed/avatars/${parseInt(agent.user_id.slice(-3), 10) % 5}.png`;
      }
      return { ...agent, avatar };
    });

    res.json({ agents });
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
        SELECT DATE(date_incident) AS date, COUNT(*) AS count
        FROM incidents
        WHERE DATE(date_incident) BETWEEN ? AND ?
        GROUP BY date
        ORDER BY date
      `, [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]),

      pool.query(`
        SELECT DATE(date_arrestation) AS date, COUNT(*) AS count
        FROM lspd_arrestations
        WHERE DATE(date_arrestation) BETWEEN ? AND ?
        GROUP BY date
        ORDER BY date
      `, [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]),

      pool.query(`
        SELECT DATE(date_debut) AS date, COUNT(*) AS count
        FROM bracelets
        WHERE DATE(date_debut) BETWEEN ? AND ?
        GROUP BY date
        ORDER BY date
      `, [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]),

      pool.query(`
        SELECT DATE(date) AS date, COUNT(*) AS count
        FROM lspd_convocations
        WHERE DATE(date) BETWEEN ? AND ?
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
      if (mapByDate[date]) mapByDate[date].incidents = parseInt(r.count, 10);
    });

    arrestationsRes.rows.forEach(r => {
      const date = moment(r.date).format('YYYY-MM-DD');
      if (mapByDate[date]) mapByDate[date].arrestations = parseInt(r.count, 10);
    });

    braceletsRes.rows.forEach(r => {
      const date = moment(r.date).format('YYYY-MM-DD');
      if (mapByDate[date]) mapByDate[date].bracelets = parseInt(r.count, 10);
    });

    convocationsRes.rows.forEach(r => {
      const date = moment(r.date).format('YYYY-MM-DD');
      if (mapByDate[date]) mapByDate[date].convocations = parseInt(r.count, 10);
    });

    res.json(Object.values(mapByDate));
  } catch (err) {
    console.error("Erreur chargement activité :", err);
    res.status(500).json({ error: "Erreur chargement activité" });
  }
});

module.exports = router;
