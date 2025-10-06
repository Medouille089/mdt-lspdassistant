const express = require("express");
const router = express.Router();
const { checkAuth, checkAuthOrDOJ } = require("../config/middleware");
const bot = require("../config/bot");
const { GUILD_ID } = require("../config/env");
const { getConfig } = require("../config/config");
const pool = require('../config/db');

router.get('/api/user', checkAuthOrDOJ, async (req, res) => {
  const user = req.user;

  try {
    const conf = await getConfig();
    const SUPER_ADMIN_ROLE = conf.id_superadmin ? String(conf.id_superadmin).trim() : null;

    const guild = await bot.guilds.fetch(GUILD_ID);
    guild.members.cache.delete(user.id);
    const member = await guild.members.fetch(user.id);
    const roleIds = member.roles.cache.map(role => role.id);

    const isSuperAdmin = SUPER_ADMIN_ROLE ? roleIds.includes(SUPER_ADMIN_ROLE) : false;

    // Si super-admin, on bypass et ne l’enregistre pas dans la BDD
    if (isSuperAdmin) {
      return res.json({
        id: user.id,
        username: member.displayName || user.username,
        avatar: user.avatar,
        discriminator: user.discriminator,
        roles: roleIds,
        isSupervisor: true,
        isCommandStaff: true,
        isSuperAdmin: true,
        grade: "Administrateur"
      });
    }

    // Vérifier si l'utilisateur est DOJ
    const isDOJ = req.user.isDOJ || false;
    if (isDOJ) {
      return res.json({
        id: user.id,
        username: member.displayName || user.username,
        avatar: user.avatar,
        discriminator: user.discriminator,
        roles: roleIds,
        isSupervisor: false,
        isCommandStaff: false,
        isSuperAdmin: false,
        isDOJ: true,
        grade: "DOJ"
      });
    }

    // Récupération des grades depuis la BDD
    const { rows } = await pool.query('SELECT * FROM lspd_grades LIMIT 1');
    const row = rows[0];
    const gradeList = [
      [row.rookie_role_id],
      [row.officier_1_role_id],
      [row.officier_2_role_id],
      [row.officier_3_role_id],
      [row.slo_role_id],
      [row.sergent_1_role_id],
      [row.sergent_2_role_id],
      [row.sergent_chef_role_id],
      [row.lieutenant_role_id],
      [row.lieutenant_chef_role_id],
      [row.capitaine_role_id],
      [row.commandant_role_id],
      [row.chief_role_id]
    ].filter(r => r[0]);

    let grade = "Agent";
    for (let i = gradeList.length - 1; i >= 0; i--) {
      const [roleId] = gradeList[i];
      if (roleIds.includes(roleId)) {
        const discordRole = guild.roles.cache.get(roleId);
        if (discordRole) {
          grade = discordRole.name;
          break;
        }
      }
    }

    // 💾 Insère uniquement si pas super-admin
    await pool.query(`
      INSERT INTO lspd_live_users (user_id, display_name, last_seen)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET display_name = $2, last_seen = NOW()
    `, [user.id, member.displayName || user.username]);

    res.set('Cache-Control', 'no-store');
    res.json({
      id: user.id,
      username: member.displayName || user.username,
      avatar: user.avatar,
      discriminator: user.discriminator,
      roles: roleIds,
      isSupervisor: user.isSupervisor,
      isCommandStaff: user.isCommandStaff,
      isSuperAdmin: user.isSuperAdmin,
      isDOJ: false,
      grade
    });

  } catch (err) {
    console.error('Erreur fetch member:', err);
    res.status(500).json({ error: 'Impossible de récupérer le membre.' });
  }
});

module.exports = router;
