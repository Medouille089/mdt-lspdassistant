const { EmbedBuilder } = require('discord.js');
const express = require("express");
const router = express.Router();
const passport = require("../config/passport");
const bot = require("../config/bot");
const { getConfig } = require("../config/config");
const { GUILD_ID } = require('../config/env');
const path = require("path");

// Middleware de vérification de session
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// Authentification avec Discord
router.get("/login", passport.authenticate("discord"));

router.get('/callback', (req, res, next) => {
  if (!req.query.code) return res.status(403).send('Accès interdit.');
  next();
}, passport.authenticate('discord', { failureRedirect: '/' }),
  async (req, res) => {
    try {
      const config = await getConfig();
      const { required_role_id, logs_channel, commandstaff_id, supervisor_role_id, id_superadmin } = config;

      const guild = await bot.guilds.fetch(GUILD_ID);
      guild.members.cache.delete(req.user.id);
      const member = await guild.members.fetch(req.user.id);
      const roleIds = member.roles.cache.map(r => r.id);

      // Super admin check depuis la config
      const isSuperAdmin = id_superadmin ? roleIds.includes(id_superadmin.trim()) : false;

      // Définir variables pour le log
      const hasRequiredRole = isSuperAdmin ? true : roleIds.includes(required_role_id);
      const action = hasRequiredRole
        ? "s'est connecté(e) avec succès"
        : `a tenté(e) de se connecter sans le rôle <@&${required_role_id}>`;

      // Si super admin -> bypass total
      if (isSuperAdmin) {
        req.user.roles = roleIds;
        req.user.isCommandStaff = true;
        req.user.isSupervisor = true;
        req.user.isSuperAdmin = true;

        if (logs_channel) {
          const logsChannel = await bot.channels.fetch(logs_channel);
          if (logsChannel?.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle('⚠️ Connexion utilisateur')
              .setColor(0x0b1b5a)
              .setDescription(`${req.user?.guild_member?.nick || 'Utilisateur inconnu'} ${action}`)
              .addFields({
                name: "ID's",
                value: `> <@${req.user.id}> (\`${req.user.id}\`) \n> <@&${id_superadmin}> (\`${id_superadmin}\`)`,
                inline: false
              })
              .setFooter({ text: 'LSPD Assistant', iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 }) })
              .setTimestamp();

            await logsChannel.send({ embeds: [embed] });
          }
        }

        return res.redirect('/protected');
      }

      // Logique normale
      const isCommandStaff = commandstaff_id ? roleIds.includes(commandstaff_id.trim()) : false;
      const isSupervisor = supervisor_role_id ? roleIds.includes(supervisor_role_id.trim()) : false;

      req.user.roles = roleIds;
      req.user.isCommandStaff = isCommandStaff;
      req.user.isSupervisor = isSupervisor;
      req.user.isSuperAdmin = isSuperAdmin;

      if (logs_channel) {
        const logsChannel = await bot.channels.fetch(logs_channel);
        if (logsChannel?.isTextBased()) {
          const embed = new EmbedBuilder()
            .setTitle('⚠️ Connexion utilisateur')
            .setColor(hasRequiredRole ? 0x0b1b5a : 0xdb4437)
            .setDescription(`${req.user?.guild_member?.nick || 'Utilisateur inconnu'} ${action}`)
            .addFields({
              name: "ID's",
              value: `> <@${req.user.id}> (\`${req.user.id}\`)`,
              inline: false
            })
            .setFooter({ text: 'LSPD Assistant', iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 }) })
            .setTimestamp();

          await logsChannel.send({ embeds: [embed] });
        }
      }

      res.redirect('/protected');
    } catch (err) {
      console.error("Erreur lors de l'envoi du log de connexion :", err);
      res.redirect('/protected');
    }
  }
);

// Déconnexion
router.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/login");
  });
});

// Pages protégées
const protectedPages = ['admin.html', 'adminPointeuse.html'];
router.use(['/protected', ...protectedPages.map(page => `/${page}`)], isAuthenticated);

// /protected
router.get('/protected', (req, res) => {
  res.sendFile(path.join(__dirname, '../LSPD/dashboard.html'));
});

// Pages admin protégées
router.get(protectedPages.map(page => `/${page}`), async (req, res) => {
  try {
    const config = await getConfig();
    const commandStaffRoleId = config.commandstaff_id?.trim();
    const id_superadmin = config.id_superadmin?.trim();

    const guild = await bot.guilds.fetch(GUILD_ID);
    guild.members.cache.delete(req.user.id);
    const member = await guild.members.fetch(req.user.id);
    const roleIds = member.roles.cache.map(role => role.id);

    // Super admin -> bypass
    if (id_superadmin && roleIds.includes(id_superadmin)) {
      const requestedPage = req.path.replace('/', '');
      return res.sendFile(path.join(__dirname, `../LSPD/${requestedPage}`));
    }

    if (!roleIds.includes(commandStaffRoleId)) {
      return res.redirect('/error.html');
    }

    const requestedPage = req.path.replace('/', '');
    if (!protectedPages.includes(requestedPage)) return res.status(404).send('Page non trouvée');

    res.sendFile(path.join(__dirname, `../LSPD/${requestedPage}`));
  } catch (err) {
    console.error(`Erreur ${req.path}:`, err);
    res.status(500).send('Erreur serveur');
  }
});

module.exports = router;
