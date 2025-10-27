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

// Enregistre ou met à jour la présence de l'utilisateur (heartbeat)
router.post('/api/live-user-heartbeat', checkAuth, async (req, res) => {
  try {
    // Si login local, req.user.id = discord_id (lié), sinon c'est l'id Discord direct
    const userId = req.user.id;
    let displayName = req.user.username || '';

    // Récupère le rôle superadmin depuis la config
    const config = await getConfig();
    const SUPER_ADMIN_ROLE = config.id_superadmin ? String(config.id_superadmin).trim() : null;

    // Si le compte est lié à Discord, on récupère toujours le displayName Discord et on check le rôle
    let isSuperAdmin = false;
    try {
      const guild = await bot.guilds.fetch(GUILD_ID);
      const member = await guild.members.fetch(userId);
      if (member && member.displayName) {
        displayName = member.displayName;
      }
      if (SUPER_ADMIN_ROLE && member.roles.cache.has(SUPER_ADMIN_ROLE)) {
        isSuperAdmin = true;
      }
    } catch (e) {
      // ignore si erreur Discord
    }

    // Ne pas enregistrer les superadmins
    if (isSuperAdmin) {
      return res.json({ ok: true, skipped: 'superadmin' });
    }

    // Upsert dans la table lspd_live_users
    await pool.query(`
      INSERT INTO lspd_live_users (user_id, display_name, last_seen)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id) DO UPDATE SET last_seen = NOW(), display_name = EXCLUDED.display_name
    `, [userId, displayName]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[LiveUserHeartbeat] Erreur:', err);
    res.status(500).json({ error: 'Erreur heartbeat live user' });
  }
});
