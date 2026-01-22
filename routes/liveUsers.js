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
    const DOJ_ROLE = config.id_doj ? String(config.id_doj).trim() : null;
    const REQUIRED_ROLE = config.required_role_id ? String(config.required_role_id).trim() : null;

    const TEST_MODE = true;

    // DEBUG LOGS
    console.log('[DEBUG] TEST_MODE:', TEST_MODE);
    console.log('[DEBUG] REQUIRED_ROLE:', REQUIRED_ROLE);
    console.log('[DEBUG] GUILD_ID:', GUILD_ID);

    let agentsToProcess = [];

    if (TEST_MODE && REQUIRED_ROLE) {
      const guild = await bot.guilds.fetch(GUILD_ID);
      console.log('[DEBUG] Guild fetched:', guild.name);
      await guild.members.fetch();
      console.log('[DEBUG] Total members in cache:', guild.members.cache.size);
      const membersWithRole = guild.members.cache.filter(m => m.roles.cache.has(REQUIRED_ROLE));
      console.log('[DEBUG] Members with required role:', membersWithRole.size);
      agentsToProcess = membersWithRole.map(m => ({
        user_id: m.user.id,
        display_name: m.displayName,
        _member: m
      }));
      console.log('[DEBUG] agentsToProcess:', agentsToProcess.length);
    } else {
      const result = await pool.query(`
        SELECT user_id, display_name FROM lspd_live_users
        ORDER BY display_name ASC
      `);
      agentsToProcess = result.rows;
    }

    const gradesConfig = await pool.query('SELECT * FROM lspd_grades LIMIT 1');
    const gradeConfig = gradesConfig.rows[0] || {};

    const gradeHierarchy = [
      { nom: 'Chief', role_id: gradeConfig.chief_role_id, ordre: 13 },
      { nom: 'Commandant', role_id: gradeConfig.commandant_role_id, ordre: 12 },
      { nom: 'Capitaine', role_id: gradeConfig.capitaine_role_id, ordre: 11 },
      { nom: 'Lieutenant Chef', role_id: gradeConfig.lieutenant_chef_role_id, ordre: 10 },
      { nom: 'Lieutenant', role_id: gradeConfig.lieutenant_role_id, ordre: 9 },
      { nom: 'Sergent Chef', role_id: gradeConfig.sergent_chef_role_id, ordre: 8 },
      { nom: 'Sergent II', role_id: gradeConfig.sergent_2_role_id, ordre: 7 },
      { nom: 'Sergent I', role_id: gradeConfig.sergent_1_role_id, ordre: 6 },
      { nom: 'SLO', role_id: gradeConfig.slo_role_id, ordre: 5 },
      { nom: 'Officier III', role_id: gradeConfig.officier_3_role_id, ordre: 4 },
      { nom: 'Officier II', role_id: gradeConfig.officier_2_role_id, ordre: 3 },
      { nom: 'Officier I', role_id: gradeConfig.officier_1_role_id, ordre: 2 },
      { nom: 'Rookie', role_id: gradeConfig.rookie_role_id, ordre: 1 }
    ].filter(g => g.role_id && g.role_id.trim() !== '');

    const guild = await bot.guilds.fetch(GUILD_ID);
    const filteredAgents = [];

    for (const agent of agentsToProcess) {
      try {
        const member = agent._member || await guild.members.fetch({ user: agent.user_id, force: true });

        const isSuperAdmin = SUPER_ADMIN_ROLE ? member.roles.cache.has(SUPER_ADMIN_ROLE) : false;
        const isDOJ = DOJ_ROLE ? member.roles.cache.has(DOJ_ROLE) : false;

        if (!isSuperAdmin && !isDOJ) {
          let avatar = null;
          if (member.user.avatar) {
            avatar = `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png?size=128`;
          } else {
            const hashIdx = member.user.discriminator && member.user.discriminator !== '0'
              ? parseInt(member.user.discriminator) % 5
              : (parseInt(member.user.id.slice(-3), 10) % 5);
            avatar = `https://cdn.discordapp.com/embed/avatars/${hashIdx}.png`;
          }

          const userRoles = member.roles.cache.map(r => r.id);
          let gradeNom = 'Agent';
          let gradeOrdre = 0;
          let gradeColor = '#5865F2'; 

          for (const grade of gradeHierarchy) {
            if (userRoles.includes(grade.role_id)) {
              gradeNom = grade.nom;
              gradeOrdre = grade.ordre;
              const role = member.roles.cache.get(grade.role_id);
              if (role) {
                // hexColor retourne "#000000" si pas de couleur, sinon la vraie couleur
                gradeColor = role.hexColor !== '#000000' ? role.hexColor : '#5865F2';
                console.log(`[DEBUG] ${agent.display_name}: grade=${gradeNom}, role.hexColor=${role.hexColor}, final=${gradeColor}`);
              }
              break;
            }
          }

          filteredAgents.push({
            user_id: agent.user_id,
            display_name: agent.display_name,
            avatar,
            grade: gradeNom,
            grade_ordre: gradeOrdre,
            grade_color: gradeColor
          });
        }
      } catch {
      }
    }

    filteredAgents.sort((a, b) => {
      if (b.grade_ordre !== a.grade_ordre) {
        return b.grade_ordre - a.grade_ordre;
      }
      return a.display_name.localeCompare(b.display_name, 'fr');
    });

    console.log('[DEBUG] Final filteredAgents count:', filteredAgents.length);
    res.json({ agents: filteredAgents });
  } catch (err) {
    console.error('Erreur récupération agents connectés:', err);
    res.status(500).json({ error: 'Erreur récupération agents connectés' });
  }
});

module.exports = router;

router.post('/api/live-user-heartbeat', checkAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    let displayName = req.user.username || '';

    const config = await getConfig();
  const SUPER_ADMIN_ROLE = config.id_superadmin ? String(config.id_superadmin).trim() : null;
  const DOJ_ROLE = config.id_doj ? String(config.id_doj).trim() : null;

  let isSuperAdmin = false;
  let isDOJ = false;
    try {
      const guild = await bot.guilds.fetch(GUILD_ID);
      const member = await guild.members.fetch(userId);
      if (member && member.displayName) {
        displayName = member.displayName;
      }
      if (SUPER_ADMIN_ROLE && member.roles.cache.has(SUPER_ADMIN_ROLE)) {
        isSuperAdmin = true;
      }
      if (DOJ_ROLE && member.roles.cache.has(DOJ_ROLE)) {
        isDOJ = true;
      }
    } catch (e) {
    }

    if (isSuperAdmin) {
      return res.json({ ok: true, skipped: 'superadmin' });
    }
    if (isDOJ) {
      return res.json({ ok: true, skipped: 'doj' });
    }

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
