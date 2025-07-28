const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { checkAuth } = require('../config/middleware');

router.get('/api/connected-agents', checkAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT user_id, display_name FROM lspd_live_users
      ORDER BY display_name ASC
    `);

    res.json({ agents: result.rows });
  } catch (err) {
    console.error('Erreur récupération agents connectés:', err);
    res.status(500).json({ error: 'Erreur récupération agents connectés' });
  }
});

module.exports = router;
