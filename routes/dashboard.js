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

    // --- Rapports aujourd'hui ---
    const incidentsTodayRes = await pool.query(`
      SELECT COUNT(*) AS count FROM incidents
      WHERE date_incident::date BETWEEN $1::date AND $2::date
    `, [todayStart, todayEnd]);

    const arrestationsTodayRes = await pool.query(`
      SELECT COUNT(*) AS count FROM lspd_arrestations
      WHERE date_arrestation::date BETWEEN $1::date AND $2::date
    `, [todayStart, todayEnd]);

    const avisRechercheTodayRes = await pool.query(`
      SELECT COUNT(*) AS count FROM lspd_avis_recherche
      WHERE created_at::date BETWEEN $1::date AND $2::date
    `, [todayStart, todayEnd]);

    const rapportsArrestationTodayRes = await pool.query(`
      SELECT COUNT(*) AS count FROM lspd_rapports_arrestation
      WHERE created_at::date BETWEEN $1::date AND $2::date
    `, [todayStart, todayEnd]);

    const interventionsToday =
      parseInt(incidentsTodayRes.rows[0].count, 10) +
      parseInt(arrestationsTodayRes.rows[0].count, 10) +
      parseInt(avisRechercheTodayRes.rows[0].count, 10) +
      parseInt(rapportsArrestationTodayRes.rows[0].count, 10);

    // --- Rapports totaux ---
    const incidentsTotalRes = await pool.query(`SELECT COUNT(*) AS count FROM incidents`);
    const arrestationsTotalRes = await pool.query(`SELECT COUNT(*) AS count FROM lspd_arrestations`);
    const avisRechercheTotalRes = await pool.query(`SELECT COUNT(*) AS count FROM lspd_avis_recherche`);
    const rapportsArrestationTotalRes = await pool.query(`SELECT COUNT(*) AS count FROM lspd_rapports_arrestation`);

    const totalReports =
      parseInt(incidentsTotalRes.rows[0].count, 10) +
      parseInt(arrestationsTotalRes.rows[0].count, 10) +
      parseInt(avisRechercheTotalRes.rows[0].count, 10) +
      parseInt(rapportsArrestationTotalRes.rows[0].count, 10);

    // --- Derniers rapports ---
    const lastReportsRes = await pool.query(`
      SELECT incident_id AS id, date_incident AS date, heure_incident AS heure, officier_redacteur AS officier_name, 'Incident' AS type
      FROM incidents
      UNION ALL
      SELECT arrestation_id AS id, date_arrestation AS date, NULL AS heure, officer AS officier_name, 'Arrestation' AS type
      FROM lspd_arrestations
      UNION ALL
      SELECT id::TEXT AS id, created_at AS date, NULL AS heure, officier AS officier_name,
             CASE
               WHEN type_avis = 'disparu' THEN 'Avis de recherche (Disparu)'
               WHEN type_avis = 'most_wanted' THEN 'Avis de recherche (Most Wanted)'
               ELSE 'Avis de recherche'
             END AS type
      FROM lspd_avis_recherche
      UNION ALL
      SELECT id::TEXT AS id, date_arrestation AS date, NULL AS heure, officier_redacteur AS officier_name, 'Rapport d''arrestation' AS type
      FROM lspd_rapports_arrestation
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
      WHERE l.last_seen > NOW() - INTERVAL '10 minutes'
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

    const [incidentsRes, arrestationsRes, braceletsRes, convocationsRes, avisRechercheRes, rapportsArrestationRes] = await Promise.all([
      pool.query(`
        SELECT date_incident::date AS date, COUNT(*) AS count
        FROM incidents
        WHERE date_incident::date BETWEEN $1::date AND $2::date
        GROUP BY date
        ORDER BY date
      `, [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]),

      pool.query(`
        SELECT date_arrestation::date AS date, COUNT(*) AS count
        FROM lspd_arrestations
        WHERE date_arrestation::date BETWEEN $1::date AND $2::date
        GROUP BY date
        ORDER BY date
      `, [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]),

      pool.query(`
        SELECT date_debut::date AS date, COUNT(*) AS count
        FROM bracelets
        WHERE date_debut::date BETWEEN $1::date AND $2::date
        GROUP BY date
        ORDER BY date
      `, [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]),

      pool.query(`
        SELECT date::date AS date, COUNT(*) AS count
        FROM lspd_convocations
        WHERE date::date BETWEEN $1::date AND $2::date
        GROUP BY date
        ORDER BY date
      `, [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]),

      pool.query(`
        SELECT created_at::date AS date, COUNT(*) AS count
        FROM lspd_avis_recherche
        WHERE created_at::date BETWEEN $1::date AND $2::date
        GROUP BY date
        ORDER BY date
      `, [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]),

      pool.query(`
        SELECT date_arrestation::date AS date, COUNT(*) AS count
        FROM lspd_rapports_arrestation
        WHERE date_arrestation::date BETWEEN $1::date AND $2::date
        GROUP BY date
        ORDER BY date
      `, [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')])
    ]);

    const mapByDate = {};

    for (let i = 0; i < 30; i++) {
      const d = startDate.clone().add(i, 'days').format('YYYY-MM-DD');
      mapByDate[d] = { date: d, incidents: 0, arrestations: 0, bracelets: 0, convocations: 0, avisRecherche: 0, rapportsArrestation: 0 };
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

    avisRechercheRes.rows.forEach(r => {
      const date = moment(r.date).format('YYYY-MM-DD');
      if (mapByDate[date]) mapByDate[date].avisRecherche = parseInt(r.count, 10);
    });

    rapportsArrestationRes.rows.forEach(r => {
      const date = moment(r.date).format('YYYY-MM-DD');
      if (mapByDate[date]) mapByDate[date].rapportsArrestation = parseInt(r.count, 10);
    });

    res.json(Object.values(mapByDate));
  } catch (err) {
    console.error("Erreur chargement activité :", err);
    res.status(500).json({ error: "Erreur chargement activité" });
  }
});

module.exports = router;
