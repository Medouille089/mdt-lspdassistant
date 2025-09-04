const {
  Client,
  GatewayIntentBits,
  ActivityType,
  Collection,
  Events,
  REST,
  Routes,
} = require("discord.js");
const { loadConfig, getConfig, setBot } = require("./config");
const db = require("./db");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const moment = require("moment-timezone");
require("dotenv").config();





const ficheDePresence = require("../discordUtils/ficheDePresence");

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

bot.commands = new Collection();
const commandFiles = fs
  .readdirSync(path.join(__dirname, "../commands"))
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(__dirname, "../commands", file));
  bot.commands.set(command.data.name, command);
}

async function registerCommands() {
  const commands = bot.commands.map((cmd) => cmd.data.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {
    console.log("📤 Enregistrement des commandes slash...");

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log("✅ Commandes enregistrées avec succès !");
  } catch (err) {
    console.error("❌ Erreur en enregistrant les commandes :", err);
  }
}

bot.on(Events.InteractionCreate, async (interaction) => {
  console.log("test")
  //if (!interaction.isChatInputCommand()) return;
  console.log("test2")
  const command = bot.commands.get(interaction.commandName);
  if (!command) return;
  console.log("test3")
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: "❌ Une erreur est survenue lors de l'exécution de la commande.",
      flags: 64,
    });
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
    ];
  } catch (err) {
    console.error("Erreur lors de la récupération des stats :", err);
    return [{ name: "Assister le LSPD", type: ActivityType.Playing }];
  }
}

async function startBot() {
  await loadConfig();

  await bot.login(process.env.TOKEN);

  bot.once("ready", async () => {
    console.log(`🤖 Bot connecté en tant que ${bot.user.tag}`);

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

    // Tâche cron qui tourne chaque minute, envoie la fiche principale et rappel si l'heure correspond
    cron.schedule("* * * * *", async () => {
      try {
        const res = await db.query(
          "SELECT fiche_de_presence_hour, fiche_de_presence_rappel FROM configlspd LIMIT 1"
        );
        if (!res.rows.length) return;

        const { fiche_de_presence_hour, fiche_de_presence_rappel } = res.rows[0];

        if (fiche_de_presence_hour && /^\d{2}:\d{2}$/.test(fiche_de_presence_hour)) {
          const nowParis = moment().tz("Europe/Paris").format("HH:mm");
          if (nowParis === fiche_de_presence_hour) {
            console.log("📌 Envoi de la fiche de présence principale à", fiche_de_presence_hour);
            await ficheDePresence.sendFicheDePresence(bot, false);
          }
        }

        if (fiche_de_presence_rappel && /^\d{2}:\d{2}$/.test(fiche_de_presence_rappel)) {
          const nowParis = moment().tz("Europe/Paris").format("HH:mm");
          if (nowParis === fiche_de_presence_rappel) {
            console.log("📌 Envoi du rappel de la fiche de présence à", fiche_de_presence_rappel);
            await ficheDePresence.sendFicheDePresence(bot, true);
          }
        }
      } catch (e) {
        console.error("Erreur dans la tâche cron fiche de présence :", e);
      }
    });
    const purgeOldPresence = async () => {
      await db.query("DELETE FROM lspd_presenceig WHERE timestamp < NOW() - INTERVAL '14 days'");
      console.log("Anciennes présences supprimées !");
    };
    cron.schedule('0 3 * * *', purgeOldPresence);

  });

  setBot(bot);
}

startBot();

module.exports = bot;
