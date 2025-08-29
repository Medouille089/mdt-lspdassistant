const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { checkAuth } = require('../config/middleware');
const bot = require('../config/bot');
const { GUILD_ID } = require('../config/env');
const { getConfig } = require('../config/config');

router.get('/api/connected-agents', checkAuth, async (req, res) => {
  try {
    const config = await getConfig();
    const SUPER_ADMIN_ROLE = config.id_superadmin ? String(config.id_superadmin).trim() : null;

    const result = await pool.query(`
      SELECT user_id, display_name FROM lspd_live_users
      ORDER BY display_name ASC
    `);

    const guild = await bot.guilds.fetch(GUILD_ID);
    const filteredAgents = [];

    for (const agent of result.rows) {
      try {
        const member = await guild.members.fetch({ user: agent.user_id, force: true });

        // filtrer les super-admins si définis
        const isSuperAdmin = SUPER_ADMIN_ROLE ? member.roles.cache.has(SUPER_ADMIN_ROLE) : false;

        if (!isSuperAdmin) {
          filteredAgents.push(agent);
        }
      } catch {
        // si l'utilisateur n'est plus dans le guild, on l'ignore
      }
    }

    res.json({ agents: filteredAgents });
  } catch (err) {
    console.error('Erreur récupération agents connectés:', err);
    res.status(500).json({ error: 'Erreur récupération agents connectés' });
  }
});

module.exports = router;
