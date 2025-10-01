const { EmbedBuilder } = require('discord.js');
const express = require("express");
const router = express.Router();
const passport = require("../config/passport");
const bot = require("../config/bot");
const { getConfig } = require("../config/config");
const { GUILD_ID } = require('../config/env');
const path = require("path");
const { checkAuth } = require("../config/middleware"); // ✅ ton middleware
const { checkAuthOrDOJ } = require("../config/middleware"); // ✅ nouveau middleware pour DOJ

// Initialiser le Map global s'il n'existe pas
if (!global.pendingRedirects) {
  global.pendingRedirects = new Map();
}

// Authentification avec Discord
router.get("/login", (req, res, next) => {
  const redirectId = req.query.redirect;
  console.log(`🔑 Route /login: redirectId = ${redirectId}`);

  // Passer l'ID directement via le paramètre state d'OAuth au lieu de la session
  if (redirectId) {
    console.log(`🔑 Passage redirectId via state OAuth: ${redirectId}`);
    // Modifier les options Passport pour inclure le state
    req.authInfo = { state: redirectId };
  }

  next();
}, (req, res, next) => {
  // Configurer dynamiquement les options Passport avec le state
  const options = {};
  if (req.authInfo?.state) {
    options.state = req.authInfo.state;
  }
  passport.authenticate("discord", options)(req, res, next);
});

router.get('/callback', (req, res, next) => {
  if (!req.query.code) return res.status(403).send('Accès interdit.');

  // Récupérer l'ID de redirection depuis le state OAuth
  const redirectId = req.query.state;
  if (redirectId) {
    console.log(`🔄 Récupération redirectId depuis state OAuth: ${redirectId}`);
    // Stocker temporairement pour utilisation après l'auth
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

      // Vérifie si l’utilisateur a le rôle requis
      const hasRequiredRole = isSuperAdmin ? true : roleIds.includes(required_role_id);
      const action = hasRequiredRole
        ? "s'est connecté(e) avec succès"
        : `a tenté(e) de se connecter sans le rôle <@&${required_role_id}>`;

      // Variables de session
      req.user.roles = roleIds;
      req.user.isCommandStaff = commandstaff_id ? roleIds.includes(commandstaff_id.trim()) : false;
      req.user.isSupervisor = supervisor_role_id ? roleIds.includes(supervisor_role_id.trim()) : false;
      req.user.isSuperAdmin = isSuperAdmin;
      req.user.isDOJ = doj_role_id ? roleIds.includes(doj_role_id.trim()) : false;

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
            .setColor(hasRequiredRole ? 0x0b1b5a : 0xdb4437)
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

      // Bloque si l’utilisateur n’a pas le rôle requis et n’est pas super admin ou n'est pas DOJ
      if (!hasRequiredRole && !req.user.isDOJ) {
        return res.status(403).send(`
          <!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Accès refusé</title></head><body>
          <h1>⛔ Accès refusé auth.js</h1>
          <p>Désolé <strong>${req.user.username}</strong>, vous n’avez pas le rôle requis pour accéder à cette page.</p>
          <a href="/logout">Se déconnecter</a>
          </body></html>
        `);
      }

      // Récupérer l'URL de redirection via l'ID stocké
      let redirectTo = '/protected';
      const redirectId = req._redirectId; // Utiliser l'ID depuis le callback, pas la session

      console.log(`🔍 Debug redirection:`);
      console.log(`  - redirectId from callback: ${redirectId}`);
      console.log(`  - global.pendingRedirects exists: ${!!global.pendingRedirects}`);
      console.log(`  - Map size: ${global.pendingRedirects ? global.pendingRedirects.size : 'N/A'}`);
      console.log(`  - Has redirectId key: ${global.pendingRedirects ? global.pendingRedirects.has(redirectId) : 'N/A'}`);

      if (redirectId && global.pendingRedirects && global.pendingRedirects.has(redirectId)) {
        redirectTo = global.pendingRedirects.get(redirectId);
        global.pendingRedirects.delete(redirectId); // Nettoyer après utilisation
        console.log(`🔄 Récupération URL via redirectId ${redirectId}: ${redirectTo}`);
      } else {
        console.log(`❌ Impossible de récupérer l'URL pour redirectId: ${redirectId}`);
      }

      console.log(`🔄 Redirection après auth: redirectTo=${redirectTo}`);

      return res.redirect(redirectTo);

    } catch (err) {
      console.error("Erreur lors de l'envoi du log de connexion :", err);
      // En cas d'erreur, rediriger aussi vers l'URL originale si elle existe
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

const whiteListedPagesDOJ = [
  'viewIncident.html',
  'viewArrestation.html',
  'viewConvocation.html',
  'getIncident.html',
  'getArrestation.html',
  'getConvocation.html'
];

// Middleware commun (protège toutes les routes listées)
router.use(
  ['/protected', ...protectedPages.map(page => `/${page}`), ...protectedPagesSupervisor.map(page => `/${page}`)],
  checkAuth
);

// Middleware spécial pour les pages accessibles au DOJ
router.use(
  whiteListedPagesDOJ.map(page => `/${page}`),
  checkAuthOrDOJ
);

// /protected
router.get('/protected', (req, res) => {
  res.sendFile(path.join(__dirname, '../LSPD/dashboard.html'));
});

// Handler pour les pages accessibles au DOJ
router.get(whiteListedPagesDOJ.map(page => `/${page}`), (req, res) => {
  const requestedPage = req.path.slice(1); // Enlever le '/' du début
  console.log(`📄 Page DOJ demandée: ${requestedPage} par ${req.user?.username} (Type: ${req.user?.userType})`);
  res.sendFile(path.join(__dirname, '../LSPD', requestedPage));
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

    // Super admin bypass
    if (id_superadmin && roleIds.includes(id_superadmin)) {
      return res.sendFile(path.join(__dirname, `../LSPD/${req.path.replace('/', '')}`));
    }

    // Vérifie le rôle Command Staff
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

    // Super admin bypass
    if (id_superadmin && roleIds.includes(id_superadmin)) {
      return res.sendFile(path.join(__dirname, `../LSPD/${req.path.replace('/', '')}`));
    }

    // Vérifie Command Staff OU Supervisor
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

    // Récupère rookie_role_id depuis la BDD
    const { rows } = await require('../config/db').query(`SELECT rookie_role_id FROM lspd_grades LIMIT 1`);
    if (rows.length) {
      const rookieRoleId = rows[0].rookie_role_id?.trim();

      // Si l'utilisateur est rookie → redirect vers error.html
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
