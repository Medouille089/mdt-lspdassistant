const { EmbedBuilder } = require('discord.js');
const express = require("express");
const router = express.Router();
const passport = require("../config/passport");
const bot = require("../config/bot");
const { getConfig } = require("../config/config");
const { GUILD_ID } = require('../config/env');
const path = require("path");
const { checkAuth } = require("../config/middleware");

// Initialiser le Map global s'il n'existe pas
if (!global.pendingRedirects) {
  global.pendingRedirects = new Map();
}

// Authentification avec Discord
router.get("/login", (req, res, next) => {
  const redirectId = req.query.redirect;
  console.log(`🔑 Route /login: redirectId = ${redirectId}`);

  if (redirectId) {
    console.log(`🔑 Passage redirectId via state OAuth: ${redirectId}`);
    req.authInfo = { state: redirectId };
  }

  next();
}, (req, res, next) => {
  const options = {};
  if (req.authInfo?.state) {
    options.state = req.authInfo.state;
  }
  passport.authenticate("discord", options)(req, res, next);
});

router.get('/callback', (req, res, next) => {
  if (!req.query.code) return res.status(403).send('Accès interdit.');

  const redirectId = req.query.state;
  if (redirectId) {
    console.log(`🔄 Récupération redirectId depuis state OAuth: ${redirectId}`);
    req._redirectId = redirectId;
  }

  next();
}, passport.authenticate('discord', { failureRedirect: '/' }),
  async (req, res) => {
    try {
      if (!req.user?.id) return res.status(403).send("Utilisateur non authentifié");

      const config = await getConfig();
      const { required_role_id, logs_channel, commandstaff_id, supervisor_role_id, id_superadmin, doj_role_id } = config;

      const guild = await bot.guilds.fetch(GUILD_ID);
      guild.members.cache.delete(req.user.id);

      let member;
      try {
        member = await guild.members.fetch(req.user.id);
      } catch (err) {
        console.error("Impossible de fetch le membre :", err);
        return res.status(404).send("Membre introuvable sur le serveur");
      }

      const roleIds = member.roles.cache.map(r => r.id);

      // Super admin check
      const isSuperAdmin = id_superadmin ? roleIds.includes(id_superadmin.trim()) : false;
      const hasRequiredRole = required_role_id ? roleIds.includes(required_role_id.trim()) : false;
      const hasDojRole = doj_role_id ? roleIds.includes(doj_role_id.trim()) : false;

      let action;

      if (hasRequiredRole) {
        action = "s'est connecté(e) avec succès";
      } else if (hasDojRole) {
        action = `s'est connecté(e) avec le rôle DOJ <@&${doj_role_id}>`;
      } else {
        action = `a tenté(e) de se connecter sans le rôle <@&${required_role_id}>`;
      }

      // Variables de session
      req.user.roles = roleIds;
      req.user.isCommandStaff = commandstaff_id ? roleIds.includes(commandstaff_id.trim()) : false;
      req.user.isSupervisor = supervisor_role_id ? roleIds.includes(supervisor_role_id.trim()) : false;
      req.user.isDoj = hasDojRole;
      req.user.isSuperAdmin = isSuperAdmin;

      // Logs
      if (logs_channel) {
        const logsChannel = await bot.channels.fetch(logs_channel);
        if (logsChannel?.isTextBased()) {
          const isLocal = req.hostname === 'localhost' || req.ip === '127.0.0.1' || req.ip === '::1';
          const logTitle = isLocal
            ? '⚠️ Connexion utilisateur - Machine locale'
            : '⚠️ Connexion utilisateur';

          const embed = new EmbedBuilder()
            .setTitle(logTitle)
            .setColor(hasRequiredRole || hasDojRole ? 0x0b1b5a : 0xdb4437)
            .setDescription(`${member.displayName || 'Utilisateur inconnu'} ${action}`)
            .addFields({
              name: "ID's",
              value: `> <@${req.user.id}> (\`${req.user.id}\`)${isSuperAdmin ? `\n> <@&${id_superadmin}> (\`${id_superadmin}\`)` : ""}`,
              inline: false
            })
            .setFooter({ text: 'LSPD Assistant', iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 }) })
            .setTimestamp();

          await logsChannel.send({ embeds: [embed] });
        }
      }

      // Bloque si l’utilisateur n’a pas le rôle requis, DOJ ou super admin
      if (!hasRequiredRole && !hasDojRole && !isSuperAdmin) {
        return res.status(403).send(`
          <!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Accès refusé</title></head><body>
          <h1>⛔ Accès refusé</h1>
          <p>Désolé <strong>${req.user.username}</strong>, vous n’avez pas le rôle requis pour accéder à cette page.</p>
          <a href="/logout">Se déconnecter</a>
          </body></html>
        `);
      }

      let redirectTo = '/protected';
      const redirectId = req._redirectId; 

      if (redirectId && global.pendingRedirects && global.pendingRedirects.has(redirectId)) {
        redirectTo = global.pendingRedirects.get(redirectId);
        global.pendingRedirects.delete(redirectId);
        console.log(`🔄 Récupération URL via redirectId ${redirectId}: ${redirectTo}`);
      } else {
        console.log(`❌ Impossible de récupérer l'URL pour redirectId: ${redirectId}`);
      }

      console.log(`🔄 Redirection après auth: redirectTo=${redirectTo}`);

      return res.redirect(redirectTo);

    } catch (err) {
      console.error("Erreur lors de l'envoi du log de connexion :", err);
      const redirectTo = req.session.returnTo || '/protected';
      delete req.session.returnTo;
      res.redirect(redirectTo);
    }
  }
);

// Déconnexion
router.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/login");
  });
});

// Pages protégées Command Staff uniquement
const protectedPages = [
  'admin.html',
  'adminPointeuse.html',
  'adminMenu.html',
  'adminGrades.html',
  'admin-absences.html',
  'admin-presence.html',
  'officers.html',
  'officerMenu.html',
  'getOfficerSanction.html',
  'tickets.html'
];

// Pages protégées Command Staff + Supervisor
const protectedPagesSupervisor = [
  'sanctions.html',
  'getSanctions.html'
];

const blockedForRookies = [
  'rapport-rookie.html'
];

// Middleware commun (protège toutes les routes listées)
router.use(
  ['/protected', ...protectedPages.map(page => `/${page}`), ...protectedPagesSupervisor.map(page => `/${page}`)],
  checkAuth
);

// /protected
router.get('/protected', (req, res) => {
  res.sendFile(path.join(__dirname, '../LSPD/dashboard.html'));
});

// Handler pages Command Staff uniquement
router.get(protectedPages.map(page => `/${page}`), async (req, res) => {
  try {
    console.log(`📄 Accès à ${req.path}, isAuthenticated: ${req.isAuthenticated()}, user: ${req.user?.username || 'aucun'}`);
    if (!req.user?.id) return res.status(403).send("Utilisateur non authentifié");

    const config = await getConfig();
    const commandStaffRoleId = config.commandstaff_id?.trim();
    const id_superadmin = config.id_superadmin?.trim();

    const guild = await bot.guilds.fetch(GUILD_ID);
    guild.members.cache.delete(req.user.id);

    let member;
    try {
      member = await guild.members.fetch(req.user.id);
    } catch (err) {
      console.error("Impossible de fetch le membre :", err);
      return res.status(404).send("Membre introuvable sur le serveur");
    }

    const roleIds = member.roles.cache.map(role => role.id);

    if (id_superadmin && roleIds.includes(id_superadmin)) {
      return res.sendFile(path.join(__dirname, `../LSPD/${req.path.replace('/', '')}`));
    }

    if (!roleIds.includes(commandStaffRoleId)) {
      return res.redirect('/error.html');
    }

    res.sendFile(path.join(__dirname, `../LSPD/${req.path.replace('/', '')}`));
  } catch (err) {
    console.error(`Erreur ${req.path}:`, err);
    res.status(500).send('Erreur serveur');
  }
});

// Handler pages Command Staff + Supervisor
router.get(protectedPagesSupervisor.map(page => `/${page}`), async (req, res) => {
  try {
    if (!req.user?.id) return res.status(403).send("Utilisateur non authentifié");

    const config = await getConfig();
    const commandStaffRoleId = config.commandstaff_id?.trim();
    const supervisorRoleId = config.supervisor_role_id?.trim();
    const id_superadmin = config.id_superadmin?.trim();

    const guild = await bot.guilds.fetch(GUILD_ID);
    guild.members.cache.delete(req.user.id);

    let member;
    try {
      member = await guild.members.fetch(req.user.id);
    } catch (err) {
      console.error("Impossible de fetch le membre :", err);
      return res.status(404).send("Membre introuvable sur le serveur");
    }

    const roleIds = member.roles.cache.map(role => role.id);

    if (id_superadmin && roleIds.includes(id_superadmin)) {
      return res.sendFile(path.join(__dirname, `../LSPD/${req.path.replace('/', '')}`));
    }

    if (!(roleIds.includes(commandStaffRoleId) || roleIds.includes(supervisorRoleId))) {
      return res.redirect('/error.html');
    }

    res.sendFile(path.join(__dirname, `../LSPD/${req.path.replace('/', '')}`));
  } catch (err) {
    console.error(`Erreur ${req.path}:`, err);
    res.status(500).send('Erreur serveur');
  }
});

// Middleware blocage rookies
router.use(blockedForRookies.map(page => `/${page}`), async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(403).send("Utilisateur non authentifié");

    const config = await getConfig();
    const guild = await bot.guilds.fetch(GUILD_ID);
    guild.members.cache.delete(req.user.id);

    let member;
    try {
      member = await guild.members.fetch(req.user.id);
    } catch (err) {
      console.error("Impossible de fetch le membre :", err);
      return res.status(404).send("Membre introuvable sur le serveur");
    }

    const roleIds = member.roles.cache.map(role => role.id);

    const { rows } = await require('../config/db').query(`SELECT rookie_role_id FROM lspd_grades LIMIT 1`);
    if (rows.length) {
      const rookieRoleId = rows[0].rookie_role_id?.trim();

      if (rookieRoleId && roleIds.includes(rookieRoleId)) {
        return res.redirect('/error.html');
      }
    }

    next();
  } catch (err) {
    console.error("Erreur blocage rookies :", err);
    res.status(500).send('Erreur serveur');
  }
});

module.exports = router;
