const express = require("express");
const router = express.Router();
const { checkAuth } = require("../config/middleware");
const bot = require("../config/bot");
const { GUILD_ID } = require("../config/env");
const { getConfig } = require("../config/config");
const pool = require('../config/db');

router.get('/api/user', checkAuth, async (req, res) => {
  const user = req.user;

  try {
    const conf = await getConfig();

    const guild = await bot.guilds.fetch(GUILD_ID);
    guild.members.cache.delete(user.id);
    const member = await guild.members.fetch(user.id);
    const roleIds = member.roles.cache.map(role => role.id);
    const guildRoles = await guild.roles.fetch();

    const supervisorRoleId = conf.supervisor_role_id?.trim();
    const commandStaffRoleId = conf.commandstaff_id?.trim();

    const isSupervisor = supervisorRoleId ? roleIds.includes(supervisorRoleId) : false;
    const isCommandStaff = commandStaffRoleId ? roleIds.includes(commandStaffRoleId) : false;

    // ✅ Récupération des grades depuis la base
    const { rows } = await pool.query('SELECT * FROM lspd_grades LIMIT 1');
    if (!rows.length) {
      return res.status(404).json({ error: 'Grades non trouvés.' });
    }

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
    ].filter(r => r[0]); // filtre les null

    // 🔎 Déterminer le grade
    let grade = "Agent";
    for (let i = gradeList.length - 1; i >= 0; i--) {
      const [roleId] = gradeList[i];
      if (roleIds.includes(roleId)) {
        const discordRole = guildRoles.get(roleId);
        if (discordRole) {
          grade = discordRole.name;
          break;
        }
      }
    }

    // 💾 Mettre à jour la présence
    await pool.query(`
      INSERT INTO lspd_live_users (user_id, display_name, last_seen)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET display_name = $2, last_seen = NOW()
    `, [user.id, member.displayName || user.username]);

    res.set('Cache-Control', 'no-store');

    // ✅ Réponse complète avec grade
    res.json({
      id: user.id,
      username: member.displayName || user.username,
      avatar: user.avatar,
      discriminator: user.discriminator,
      roles: roleIds,
      isSupervisor,
      isCommandStaff,
      grade
    });

  } catch (err) {
    console.error('Erreur fetch member:', err);
    res.status(500).json({ error: 'Impossible de récupérer le membre.' });
  }
});

module.exports = router;
