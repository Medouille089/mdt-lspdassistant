const { EmbedBuilder } = require('discord.js'); // N'oublie pas d'importer EmbedBuilder
const express = require("express");
const router = express.Router();
const passport = require("../config/passport");
const bot = require("../config/bot");
const { getConfig } = require("../config/config");
const { GUILD_ID } = require('../config/env');
const path = require("path");

router.get("/login", passport.authenticate("discord"));

router.get('/callback', (req, res, next) => {
  if (!req.query.code) {
    return res.status(403).send('Accès interdit.');
  }
  next();
}, passport.authenticate('discord', { failureRedirect: '/' }),
  async (req, res) => {
    try {
      const config = await getConfig();
      const { required_role_id, logs_channel, commandstaff_id, supervisor_role_id } = config;

      const guild = await bot.guilds.fetch(GUILD_ID);
      guild.members.cache.delete(req.user.id);
      const member = await guild.members.fetch(req.user.id);

      const roleIds = member.roles.cache.map(r => r.id);

      // ➕ Récupérer les noms de rôles pour le grade
      const guildRoles = await guild.roles.fetch();

      const HIGH_GRADE_ROLE_ID = "1393306975722410135";
      const LOW_GRADE_ROLE_ID = "1392518028847222896";

      let grade = "Agent";

      if (roleIds.includes(HIGH_GRADE_ROLE_ID)) {
        const highRole = guildRoles.get(HIGH_GRADE_ROLE_ID);
        grade = highRole?.name || "Grade Supérieur";
      } else if (roleIds.includes(LOW_GRADE_ROLE_ID)) {
        const lowRole = guildRoles.get(LOW_GRADE_ROLE_ID);
        grade = lowRole?.name || "Grade Moyen";
      }

      // ➕ Ajout du grade et rôles enrichis dans req.user
      req.user.grade = grade;
      req.user.roles = roleIds;
      req.user.isCommandStaff = commandstaff_id ? roleIds.includes(commandstaff_id.trim()) : false;
      req.user.isSupervisor = supervisor_role_id ? roleIds.includes(supervisor_role_id.trim()) : false;

      const hasRequiredRole = roleIds.includes(required_role_id);

      const action = hasRequiredRole
        ? "s'est connecté(e) avec succès"
        : `a tenté(e) de se connecter sans le rôle <@&${required_role_id}>`;

      if (logs_channel) {
        const logsChannel = await bot.channels.fetch(logs_channel);
        if (logsChannel?.isTextBased()) {
          const embed = new EmbedBuilder()
            .setTitle('⚠️ Connexion utilisateur')
            .setColor(hasRequiredRole ? 0x0b1b5a : 0xdb4437)
            .setDescription(`<@${req.user.id}> ${action}`)
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

router.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/connect.html");
  });
});

async function checkCommandStaffRole(req, res, next) {
  try {
    const config = await getConfig();
    const commandStaffRoleId = config.commandstaff_id?.trim();

    const user = req.user;
    if (!user) {
      return res.status(401).send("Non authentifié");
    }

    const guild = await bot.guilds.fetch(GUILD_ID);
    guild.members.cache.delete(user.id); // forcer refresh
    const member = await guild.members.fetch(user.id);
    const roleIds = member.roles.cache.map(role => role.id);

    const isCommandStaff = commandStaffRoleId ? roleIds.includes(commandStaffRoleId) : false;

    if (!isCommandStaff) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8" />
          <title>Accès refusé</title>
          <style>
            body { font-family: Arial, sans-serif; background: #f8d7da; color: #721c24; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .container { background: white; padding: 2rem; border: 2px solid #f5c6cb; border-radius: 10px; text-align: center; }
            button { margin-top: 1.5rem; padding: 0.5rem 1rem; font-size: 1rem; border: none; background: #007bff; color: white; border-radius: 5px; cursor: pointer; }
            button:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Tient tient tient</h1>
            <p>Tu n'as rien à faire ici</p>
            <button onclick="window.location.href='/dashboard.html'">Revenir en lieu sûr</button>
          </div>
        </body>
        </html>
      `);
    }

    next();

  } catch (err) {
    console.error("Erreur checkCommandStaffRole:", err);
    res.status(500).send("Erreur serveur");
  }
}

const protectedPages = ['admin.html', 'adminPointeuse.html', 'adminMenu.html'];

router.get(protectedPages.map(page => `/${page}`), async (req, res, next) => {
  try {
    const config = await getConfig();
    const commandStaffRoleId = config.commandstaff_id?.trim();

    if (!req.user) {
      return res.status(403).send('Accès refusé - Non authentifié');
    }

    const guild = await bot.guilds.fetch(GUILD_ID);
    guild.members.cache.delete(req.user.id); // refresh
    const member = await guild.members.fetch(req.user.id);
    const roleIds = member.roles.cache.map(role => role.id);

    if (!roleIds.includes(commandStaffRoleId)) {
      return res.redirect('/error.html');
    }

    // Renvoie le fichier demandé dynamiquement
    const requestedPage = req.path.replace('/', '');
    if (!protectedPages.includes(requestedPage)) {
      return res.status(404).send('Page non trouvée');
    }

    res.sendFile(path.join(__dirname, `../LSPD/${requestedPage}`));
  } catch (err) {
    console.error(`Erreur ${req.path}:`, err);
    res.status(500).send('Erreur serveur');
  }
});


module.exports = router;
