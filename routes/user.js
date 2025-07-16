const express = require("express");
const router = express.Router();
const { checkAuth } = require("../config/middleware");
const bot = require("../config/bot");
const { GUILD_ID } = require("../config/env");
const { getConfig } = require("../config/config");
const path = require("path");

router.get('/api/user', checkAuth, async (req, res) => {
  const user = req.user;

  try {
    const conf = await getConfig();

    const guild = await bot.guilds.fetch(GUILD_ID);
    guild.members.cache.delete(user.id); 
    const member = await guild.members.fetch(user.id);
    const roleIds = member.roles.cache.map(role => role.id);

    const supervisorRoleId = conf.supervisor_role_id?.trim();
    const commandStaffRoleId = conf.commandstaff_id?.trim();

    const isSupervisor = supervisorRoleId ? roleIds.includes(supervisorRoleId) : false;
    const isCommandStaff = commandStaffRoleId ? roleIds.includes(commandStaffRoleId) : false;

    res.set('Cache-Control', 'no-store');

    res.json({
      id: user.id,
      username: member.displayName || user.username,
      avatar: user.avatar,
      discriminator: user.discriminator,
      roles: roleIds,
      isSupervisor,
      isCommandStaff
    });

  } catch (err) {
    console.error('Erreur fetch member:', err);
    res.status(500).json({ error: 'Impossible de récupérer le membre.' });
  }
});



module.exports = router;
