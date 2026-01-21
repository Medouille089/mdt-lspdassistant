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
    const period = req.query.period || 'month'; // day, week, month

    if (period === 'day') {
      // Aujourd'hui, groupé par heure
      const todayStart = moment().tz('Europe/Paris').startOf('day');
      const todayEnd = moment().tz('Europe/Paris').endOf('day');

      const buildHourQuery = (field, table, timeField = null) => {
        const hourExpr = timeField
          ? `EXTRACT(HOUR FROM ${timeField}::time)::int`
          : `EXTRACT(HOUR FROM ${field}::timestamp)::int`;
        return `
          SELECT ${hourExpr} AS hour, COUNT(*) AS count
          FROM ${table}
          WHERE ${field}::date = $1::date
          GROUP BY ${hourExpr}
          ORDER BY hour
        `;
      };

      const [incidentsRes, arrestationsRes, braceletsRes, convocationsRes, avisRechercheRes, rapportsArrestationRes] = await Promise.all([
        pool.query(`
          SELECT EXTRACT(HOUR FROM heure_incident::time)::int AS hour, COUNT(*) AS count
          FROM incidents
          WHERE date_incident::date = $1::date
          GROUP BY hour
          ORDER BY hour
        `, [todayStart.format('YYYY-MM-DD')]),
        pool.query(buildHourQuery('date_arrestation', 'lspd_arrestations'), [todayStart.format('YYYY-MM-DD')]),
        pool.query(buildHourQuery('date_debut', 'bracelets'), [todayStart.format('YYYY-MM-DD')]),
        pool.query(buildHourQuery('date', 'lspd_convocations'), [todayStart.format('YYYY-MM-DD')]),
        pool.query(buildHourQuery('created_at', 'lspd_avis_recherche'), [todayStart.format('YYYY-MM-DD')]),
        pool.query(buildHourQuery('created_at', 'lspd_rapports_arrestation'), [todayStart.format('YYYY-MM-DD')])
      ]);

      const mapByHour = {};
      for (let h = 0; h < 24; h++) {
        mapByHour[h] = { hour: h, incidents: 0, arrestations: 0, bracelets: 0, convocations: 0, avisRecherche: 0, rapportsArrestation: 0 };
      }

      incidentsRes.rows.forEach(r => {
        if (mapByHour[r.hour]) mapByHour[r.hour].incidents = parseInt(r.count, 10);
      });
      arrestationsRes.rows.forEach(r => {
        if (mapByHour[r.hour]) mapByHour[r.hour].arrestations = parseInt(r.count, 10);
      });
      braceletsRes.rows.forEach(r => {
        if (mapByHour[r.hour]) mapByHour[r.hour].bracelets = parseInt(r.count, 10);
      });
      convocationsRes.rows.forEach(r => {
        if (mapByHour[r.hour]) mapByHour[r.hour].convocations = parseInt(r.count, 10);
      });
      avisRechercheRes.rows.forEach(r => {
        if (mapByHour[r.hour]) mapByHour[r.hour].avisRecherche = parseInt(r.count, 10);
      });
      rapportsArrestationRes.rows.forEach(r => {
        if (mapByHour[r.hour]) mapByHour[r.hour].rapportsArrestation = parseInt(r.count, 10);
      });

      return res.json({ period: 'day', data: Object.values(mapByHour) });
    }

    // Semaine (7 jours) ou Mois (30 jours)
    const daysToFetch = period === 'week' ? 7 : 30;
    const startDate = moment().tz('Europe/Paris').subtract(daysToFetch - 1, 'days').startOf('day');
    const endDate = moment().tz('Europe/Paris').endOf('day');

    const buildQuery = (field, table) => `
      SELECT ${field}::date AS date, COUNT(*) AS count
      FROM ${table}
      WHERE ${field}::date BETWEEN $1::date AND $2::date
      GROUP BY ${field}::date
      ORDER BY date
    `;

    const [incidentsRes, arrestationsRes, braceletsRes, convocationsRes, avisRechercheRes, rapportsArrestationRes] = await Promise.all([
      pool.query(buildQuery('date_incident', 'incidents'), [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]),
      pool.query(buildQuery('date_arrestation', 'lspd_arrestations'), [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]),
      pool.query(buildQuery('date_debut', 'bracelets'), [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]),
      pool.query(buildQuery('date', 'lspd_convocations'), [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]),
      pool.query(buildQuery('created_at', 'lspd_avis_recherche'), [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]),
      pool.query(buildQuery('date_arrestation', 'lspd_rapports_arrestation'), [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')])
    ]);

    const mapByDate = {};
    for (let i = 0; i < daysToFetch; i++) {
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

    res.json({ period, data: Object.values(mapByDate) });
  } catch (err) {
    console.error("Erreur chargement activité :", err);
    res.status(500).json({ error: "Erreur chargement activité" });
  }
});

module.exports = router;
