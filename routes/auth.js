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

// Authentification avec Discord
router.get("/login", passport.authenticate("discord"));

router.get('/callback',
  passport.authenticate('discord', { failureRedirect: '/connect.html' }),
  async (req, res) => {
    try {
      if (!req.user?.id) return res.status(403).send("Utilisateur non authentifié");

    const config = await getConfig();
    const { required_role_id, logs_connexion, commandstaff_id, supervisor_role_id, id_superadmin, doj_role_id } = config;

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

      // Vérifier si l'utilisateur est dans la table lspd_blacklist
      try {
        const pool = require('../config/db');
        const bl = await pool.query('SELECT discord_id FROM lspd_blacklist WHERE discord_id = $1', [req.user.id]);
        if (bl.rows.length) {
          // log to logs_connexion (if configured)
          if (logs_connexion) {
            try {
              const logsChannel = await bot.channels.fetch(logs_connexion).catch(() => null);
              if (logsChannel?.isTextBased()) {
                const { EmbedBuilder } = require('discord.js');
                // include role mention if set in config
                const roleId = config.blacklist_role_id ? String(config.blacklist_role_id).trim() : null;
                const desc = roleId
                  ? `${member.displayName || 'Utilisateur inconnu'} a tenté(e) de se connecter et est blacklisté (rôle <@&${roleId}>)`
                  : `${member.displayName || 'Utilisateur inconnu'} a tenté(e) de se connecter et est blacklisté`;

                const embed = new EmbedBuilder()
                  .setTitle('⚠️ Tentative de connexion - Blacklist')
                  .setColor(0xff0000)
                  .setDescription(desc)
                  .addFields({
                    name: "ID's",
                    value: `> <@${req.user.id}> (\`${req.user.id}\`)${roleId ? `\n> <@&${roleId}> (\`${roleId}\`)` : ''}`,
                    inline: false
                  })
                  .setFooter({ text: 'LSPD Assistant', iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 }) })
                  .setTimestamp();

                await logsChannel.send({ embeds: [embed] });
              }
            } catch (e) { console.error('Erreur envoi log blacklist (auth callback):', e); }
          }

          return res.redirect('/blacklisted.html');
        }
      } catch (e) {
        console.error('Erreur check blacklist DB (auth callback):', e);
      }

      // Super admin check
      const isSuperAdmin = id_superadmin ? roleIds.includes(id_superadmin.trim()) : false;

      // Vérifie si l’utilisateur a le rôle requis
      const hasRequiredRole = isSuperAdmin ? true : roleIds.includes(required_role_id);
      const action = hasRequiredRole || req.user.isDOJ
        ? "s'est connecté(e) avec succès via discord"
        : `a tenté(e) de se connecter sans le rôle <@&${required_role_id}> ou sans être <@&${doj_role_id}>`;

      // Variables de session
  req.user.roles = roleIds;
      req.user.isCommandStaff = commandstaff_id ? roleIds.includes(commandstaff_id.trim()) : false;
      req.user.isSupervisor = supervisor_role_id ? roleIds.includes(supervisor_role_id.trim()) : false;
      req.user.isSuperAdmin = isSuperAdmin;
      req.user.isDOJ = doj_role_id ? roleIds.includes(doj_role_id.trim()) : false;

      // Logs
      if (logs_connexion) {
        const logsChannel = await bot.channels.fetch(logs_connexion);
        if (logsChannel?.isTextBased()) {
          const isLocal = req.hostname === 'localhost' || req.ip === '127.0.0.1' || req.ip === '::1';
          const logTitle = isLocal
            ? '⚠️ Connexion discord - Machine locale'
            : '⚠️ Connexion discord';

          const embed = new EmbedBuilder()
            .setTitle(logTitle)
            .setColor(hasRequiredRole || req.user.isDOJ ? 0xFFFFFF : 0xff0000)
            .setDescription(`${member.displayName || 'Utilisateur inconnu'} ${action}`)
            .addFields({
              name: "ID's",
              value: `> <@${req.user.id}> (\`${req.user.id}\`)${isSuperAdmin ? `\n> <@&${id_superadmin}> (\`${id_superadmin}\`)` : ""}${req.user.isDOJ ? `\n> <@&${doj_role_id}> (\`${doj_role_id}\`)` : ""}`,
              inline: false
            })
            .setFooter({ text: 'LSPD Assistant', iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 }) })
            .setTimestamp();

          await logsChannel.send({ embeds: [embed] });
        }
      }

      // Bloque si l’utilisateur n’a le rôle blacklist (avant toute autre vérification)
      // (déjà géré plus haut) et s'il n’a pas le rôle requis et n’est pas super admin ou n'est pas DOJ
      if (!hasRequiredRole && !req.user.isDOJ) {
        return res.status(403).send(`
          <!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Accès refusé</title></head><body>
          <h1>⛔ Accès refusé auth.js</h1>
          <p>Désolé <strong>${req.user.username}</strong>, vous n’avez pas le rôle requis pour accéder à cette page.</p>
          <a href="/logout">Se déconnecter</a>
          </body></html>
        `);
      }

      // Vérifier si l'utilisateur a déjà un compte local
      const pool = require('../config/db');
      const accountCheck = await pool.query(
        'SELECT id FROM user_accounts WHERE discord_id = $1',
        [req.user.id]
      );

      // Si pas de compte local, rediriger vers la page d'inscription
      if (accountCheck.rows.length === 0) {
        return res.redirect('/register.html');
      }

      // Récupérer l'URL de redirection depuis la session
      let redirectTo = '/protected';
      if (req.session.returnTo) {
        redirectTo = req.session.returnTo;
        delete req.session.returnTo; // Nettoyer après utilisation
      }

      // Enregistrer la session pour ce discord id (permet d'invalider la session si blacklist)
      try {
        const sessionStore = require('../config/sessionStore');
        if (req.sessionID) sessionStore.registerSession(req.user.id, req.sessionID);
      } catch (e) { /* ignore */ }


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
  req.logout((err) => {
    if (err) {
      console.error("Erreur lors de la déconnexion:", err);
    }
    // Cleanup mapping for session
    try {
      const sessionStore = require('../config/sessionStore');
      if (req.sessionID) sessionStore.unregisterSession(req.sessionID);
    } catch (e) { /* ignore */ }

    req.session.destroy((err) => {
      if (err) {
        console.error("Erreur destruction session:", err);
      }
      res.redirect("/connect.html");
    });
  });
});

// Pages protégées Command Staff uniquement
const protectedPages = [
  'admin-salons.html',
  'admin-pointeuse.html',
  'menu-admin-salons.html',
  'admin-grades.html',
  'admin-presence.html',
  'admin-annonce.html',
  'admin-logs.html',
  'tickets.html'
];

// Pages protégées Command Staff + Supervisor
const protectedPagesSupervisor = [
  'sanctions.html',
  'admin-absences.html',
  'liste-sanctions.html',
  'menu-sanctions.html',
  'menu-superviseur.html',
  'convocation-agent.html',
  'menu-officier.html',
  'getOfficerSanction.html',
  'liste-convocations-agent.html',
  'liste-officiers.html',
  'menu-convocation-agent'
];

const blockedForRookies = [
  'rapport-rookie.html',
  'rapport-rookie'
];

const whiteListedPagesDOJ = [
  'dashboard.html',
  'viewIncident.html',
  'viewArrestation.html',
  'viewConvocation.html',
  'liste-incidents.html',
  'liste-arrestations.html',
  'liste-convocations.html'
];// Middleware commun (protège toutes les routes listées)
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
  res.sendFile(path.join(__dirname, '../LSPD', requestedPage));
});

// Handler pages Command Staff uniquement
router.get(protectedPages.map(page => `/${page}`), async (req, res) => {
  try {
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
      const requested = req.path.replace(/^\//, '');
      const fileName = requested.endsWith('.html') ? requested : `${requested}.html`;
      return res.sendFile(path.join(__dirname, `../LSPD/${fileName}`));
    }

    // Vérifie le rôle Command Staff
    if (!roleIds.includes(commandStaffRoleId)) {
      return res.redirect('/error.html');
    }

  const requested = req.path.replace(/^\//, '');
  const fileName = requested.endsWith('.html') ? requested : `${requested}.html`;
  res.sendFile(path.join(__dirname, `../LSPD/${fileName}`));
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
      const requested = req.path.replace(/^\//, '');
      const fileName = requested.endsWith('.html') ? requested : `${requested}.html`;
      return res.sendFile(path.join(__dirname, `../LSPD/${fileName}`));
    }

    // Vérifie Command Staff OU Supervisor
    if (!(roleIds.includes(commandStaffRoleId) || roleIds.includes(supervisorRoleId))) {
      return res.redirect('/error.html');
    }

    const requested = req.path.replace(/^\//, '');
    const fileName = requested.endsWith('.html') ? requested : `${requested}.html`;
    res.sendFile(path.join(__dirname, `../LSPD/${fileName}`));
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