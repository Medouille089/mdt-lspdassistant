const {
  Client,
  GatewayIntentBits,
  ActivityType,
  Collection,
  Events,
  REST,
  Routes,
} = require("discord.js");
const { loadConfig, setBot } = require("./config");
const db = require("./db");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const moment = require("moment-timezone");
require("dotenv").config();

const ficheDePresence = require("../discordUtils/ficheDePresence");
const handleTicket = require("../discordUtils/tickets");

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

bot.commands = new Collection();
const commandFiles = fs
  .readdirSync(path.join(__dirname, "../commands"))
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const moduleExports = require(path.join(__dirname, "../commands", file));

  if (moduleExports?.data && moduleExports?.execute) {
    bot.commands.set(moduleExports.data.name, moduleExports);
  } else {
    for (const key in moduleExports) {
      const cmd = moduleExports[key];
      if (cmd?.data && cmd?.execute) {
        bot.commands.set(cmd.data.name, cmd);
      }
    }
  }
}

async function registerCommands() {
  const all = bot.commands.map(c => c.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  // Liste des commandes qui doivent fonctionner en DM / global
  // Ajouter les commandes ici pour qu'elles soient publiées globalement (ex: 'rappel', 'clear')
  const globalNames = ['rappel', 'clear'];
  const globalCommands = all.filter(c => globalNames.includes(c.name));
  const guildCommands = all.filter(c => !globalNames.includes(c.name));

  const isLocal = (process.env.IS_LOCAL || '').toLowerCase() === 'true';

  try {
    
    // Toujours enregistrer les guild commands (MAJ instantanée)
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: guildCommands }
    );

    if (!isLocal) {
      // En prod seulement: publier les global (plus lentes à propager, pas de doublon car limitées)
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: globalCommands }
      );
    } else {
    }
  } catch (err) {
    console.error('❌ Erreur en enregistrant les commandes :', err);
  }
}

bot.on(Events.InteractionCreate, async (interaction) => {
  // Gestion des commandes
  const command = bot.commands.get(interaction.commandName);
  if (command) {
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content:
          "❌ Une erreur est survenue lors de l'exécution de la commande.",
        flags: 64,
      });
    }
    return; // on sort si c'était une commande
  }

  // Gestion bouton annulation rappel
  try {
    if (interaction.isButton() && interaction.customId.startsWith('reminder_cancel:')) {
      const idStr = interaction.customId.split(':')[1];
      const reminderId = parseInt(idStr, 10);
      if (isNaN(reminderId)) {
        return interaction.reply({ content: '❌ ID invalide.', flags: 64 });
      }

      // Vérifier existence et ownership
      const { rows } = await db.query('SELECT id, user_id FROM lspd_reminders WHERE id=$1', [reminderId]);
      if (!rows.length) {
        return interaction.reply({ content: '⚠️ Rappel déjà annulé ou inexistant.', flags: 64 });
      }
      if (rows[0].user_id !== interaction.user.id) {
        return interaction.reply({ content: '❌ Vous ne pouvez pas annuler ce rappel.', flags: 64 });
      }

      await db.query('DELETE FROM lspd_reminders WHERE id=$1', [reminderId]);

      // Désactiver le bouton sur le message original si possible
      try {
        const msg = interaction.message;
        const components = msg.components.map(row => {
          row.components.forEach(c => { if (c.data?.custom_id === interaction.customId || c.customId === interaction.customId) { c.setDisabled(true).setLabel('Rappel annulé'); } });
          return row;
        });
        await msg.edit({ components });
      } catch (_) { /* ignore */ }

      return interaction.reply({ content: '✅ Rappel annulé.', flags: 64 });
    }
  } catch (btnErr) {
    console.error('Erreur interaction bouton rappel:', btnErr);
    if (!interaction.replied) {
      try { await interaction.reply({ content: '❌ Erreur annulation.', flags: 64 }); } catch (_) {}
    }
  }

  // Gestion des tickets
  await handleTicket(interaction, bot);
});

// Commande préfixe !bonjour
bot.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return; // uniquement en serveur (ajuster si besoin DM)
    // Skip en local si demandé
    if (process.env.IS_LOCAL && process.env.IS_LOCAL.toLowerCase() === 'true') return;

    const content = message.content.trim().toLowerCase();
    if (content === '!bonjour') {
      // Supprime le message d'origine si possible
      if (message.deletable) {
        message.delete().catch(() => {});
      }

      const avatar = bot.user.displayAvatarURL({ extension: 'png', size: 256 });
      const embed = {
        title: '🌟 Mémo politesse 🌟',
        description: '# Un ticket, une politesse !\nUn petit `BONJOUR` / `BONSOIR` / `COUCOU` / `SALUT` ne mange pas de pain. C\'est toujours bien plus agréable pour nous.\n\nMerci d\'égayer nos journées !',
        color: 0x0b1b5a,
        thumbnail: { url: avatar },
        footer: { text: 'LSPD Assistant', icon_url: avatar },
        timestamp: new Date().toISOString(),
      };
      await message.channel.send({ embeds: [embed] });
      return;
    }

    // Simple ping -> pong
    if (content === '!ping') {
      // Réponse rapide (pas d'embed nécessaire). On peut ajouter le temps de latence si voulu plus tard.
      return message.reply('pong');
    }
  } catch (e) {
    console.error('Erreur commande !bonjour:', e.message);
  }
});

function pluralize(count, zeroIsPlural = false) {
  if (count === 1) return "";
  if (count === 0 && zeroIsPlural) return "s";
  if (count > 1) return "s";
  return "";
}

async function getPresenceMessages(zeroPlural = false) {
  try {
    const res1 = await db.query("SELECT COUNT(*) FROM bracelets");
    const nb_brac = parseInt(res1.rows[0].count);

    const res2 = await db.query("SELECT COUNT(*) FROM incidents");
    const incidents = parseInt(res2.rows[0].count);

    const res3 = await db.query("SELECT COUNT(*) FROM lspd_arrestations");
    const arrestations = parseInt(res3.rows[0].count);

    const rapports = incidents + arrestations;

    const res4 = await db.query("SELECT COUNT(*) FROM lspd_live_users");
    const lspdUsers = parseInt(res4.rows[0].count);

    // Récupération du count total
    const res5 = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM lspd_tickets) + 
        (SELECT COUNT(*) FROM lspd_count_tickets) AS total_tickets
    `);
    const totalTickets = parseInt(res5.rows[0].total_tickets);


    return [
      { name: "Assister le LSPD", type: ActivityType.Playing },
      {
        name: `${nb_brac} bracelet${pluralize(nb_brac, zeroPlural)} actif${pluralize(nb_brac, zeroPlural)}`,
        type: ActivityType.Watching,
      },
      {
        name: `${rapports} rapport${pluralize(rapports, zeroPlural)}`,
        type: ActivityType.Watching,
      },
      {
        name: `${lspdUsers} personne${pluralize(lspdUsers, zeroPlural)} connecté${pluralize(lspdUsers, zeroPlural)}`,
        type: ActivityType.Watching,
      },
      {
        name: `${totalTickets} ticket${pluralize(totalTickets, zeroPlural)}`,
        type: ActivityType.Watching,
      }
    ];
  } catch (err) {
    console.error("Erreur lors de la récupération des stats :", err);
    return [{ name: "Assister le LSPD", type: ActivityType.Playing }];
  }
}


async function startBot() {
  await loadConfig();
  await bot.login(process.env.TOKEN);

  bot.once("clientReady", async () => {

    let index = 0;
    async function cyclePresence() {
      const activities = await getPresenceMessages();
      bot.user.setPresence({
        activities: [activities[index]],
        status: "online",
      });
      index = (index + 1) % activities.length;
    }

    await cyclePresence();
    setInterval(cyclePresence, 5000);
    await registerCommands();

    cron.schedule("* * * * *", async () => {
      try {
        const res = await db.query(
          "SELECT fiche_de_presence_hour, fiche_de_presence_rappel FROM configlspd LIMIT 1"
        );
        if (!res.rows.length) return;

        const { fiche_de_presence_hour, fiche_de_presence_rappel } = res.rows[0];
        const nowParis = moment().tz("Europe/Paris").format("HH:mm");

        if (fiche_de_presence_hour && nowParis === fiche_de_presence_hour) {
          await ficheDePresence.sendFicheDePresence(bot, false);
        }

        if (fiche_de_presence_rappel && nowParis === fiche_de_presence_rappel) {
          await ficheDePresence.sendFicheDePresence(bot, true);
        }
      } catch (e) {
        console.error("Erreur dans la tâche cron fiche de présence :", e);
      }
    });

    const purgeOldPresence = async () => {
      await db.query(
        "DELETE FROM lspd_presenceig WHERE timestamp < NOW() - INTERVAL '14 days'"
      );
    };
    cron.schedule("0 3 * * *", purgeOldPresence);

    // --- Scheduler des rappels (/rappel) ---
    const processReminders = async () => {
      try {
        // On récupère les rappels échus (remind_at <= now) limit pour éviter flood
        const due = await db.query(
          `SELECT id, user_id, channel_id, remind_at, reason, dm_only
           FROM lspd_reminders
           WHERE remind_at <= NOW()
           ORDER BY remind_at ASC
           LIMIT 20`);
        if (!due.rows.length) return; // rien à faire

        for (const r of due.rows) {
          try {
            let channel = null;
            if (!r.dm_only) {
              channel = await bot.channels.fetch(r.channel_id).catch(() => null);
              if (!channel || !channel.isTextBased()) {
                // Salon disparu -> suppression silencieuse
                await db.query('DELETE FROM lspd_reminders WHERE id=$1', [r.id]);
                continue;
              }
            }

            const parisTime = moment.utc(r.remind_at).tz('Europe/Paris');
            const botAvatar = bot.user.displayAvatarURL({ extension: 'png', size: 256 });
            const publicFields = [
              { name: 'Date', value: parisTime.format('DD/MM/YYYY'), inline: true },
              { name: 'Heure', value: parisTime.format('HH:mm'), inline: true }
            ];
            if (r.reason && r.reason.trim().length) {
              publicFields.push({ name: 'Raison', value: r.reason, inline: false });
            }
            let publicEmbed = null;
            if (!r.dm_only) {
              publicEmbed = {
                title: 'Rappel',
                color: 0x0b1b5a,
                fields: publicFields,
                footer: { text: 'LSPD Assistant', icon_url: botAvatar },
                timestamp: new Date().toISOString()
              };
              await channel.send({ content: `<@${r.user_id}>`, embeds: [publicEmbed] });
            }

            // DM user avec rappel + salon (en bas)
            try {
              const user = await bot.users.fetch(r.user_id).catch(() => null);
              if (user) {
                const dmFields = [...publicFields];
                if (!r.dm_only) {
                  dmFields.push({ name: 'Salon', value: `<#${r.channel_id}>`, inline: false });
                }
                const dmEmbed = {
                  title: 'Rappel',
                  color: 0x0b1b5a,
                  fields: dmFields,
                  footer: { text: 'LSPD Assistant', icon_url: botAvatar },
                  timestamp: new Date().toISOString()
                };
                await user.send({ embeds: [dmEmbed] });
              }
            } catch (dmErr) {
              // silent
            }
            await db.query('DELETE FROM lspd_reminders WHERE id=$1', [r.id]);
          } catch (sendErr) {
            console.error('Erreur envoi rappel:', sendErr.message);
            // On laisse l'entrée pour réessayer plus tard (empêche perte si bug momentané)
          }
        }
      } catch (e) {
        console.error('Erreur processReminders:', e.message);
      }
    };

    // Toutes les minutes
    cron.schedule('* * * * *', processReminders);

    // Note: role-based blacklist watcher removed — blacklist is now DB-driven via slash commands
  });

  setBot(bot);
}

startBot();
module.exports = bot;
