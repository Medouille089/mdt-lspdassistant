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

      const REQUIRED_ROLE_ID = config.required_role_id;
      const LOGS_CHANNEL = config.logs_channel;

      const hasRole = req.user.guild_member?.roles.includes(REQUIRED_ROLE_ID);
      const action = hasRole
        ? "s'est connecté(e) avec succès"
        : `a tenté(e) de se connecter sans le rôle <@&${REQUIRED_ROLE_ID}>`;

      if (LOGS_CHANNEL) {
        const logsChannel = await bot.channels.fetch(LOGS_CHANNEL);
        if (logsChannel && logsChannel.isTextBased()) {
          const embed = new EmbedBuilder()
            .setTitle('⚠️Connexion utilisateur')
            .setColor(hasRole ? 0x0b1b5a : 0x0b1b5a)
            .setDescription(`<@${req.user.id}> ${action}`)
            .addFields({
              name: "ID's",
              value: `> <@${req.user.id}> (\`${req.user.id}\`)`,
              inline: false
            })
            .setFooter({ text: 'LSPD Assistant', iconURL: 'https://i.ibb.co/DDQWSHmZ/assistant.png' })
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
    res.redirect("/login");
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

router.get('/admin.html', async (req, res) => {
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

    res.sendFile(path.join(__dirname, '../LSPD/admin.html'));
  } catch (err) {
    console.error("Erreur admin.html:", err);
    res.status(500).send('Erreur serveur');
  }
});

module.exports = router;
