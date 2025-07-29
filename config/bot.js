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
require("dotenv").config();

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
  if (!interaction.isChatInputCommand()) return;

  const command = bot.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: "❌ Une erreur est survenue lors de l'exécution de la commande.",
      ephemeral: true,
    });
  }
});

// 🔁 Fonction pour obtenir les données dynamiques
async function getPresenceMessages() {
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
        name: `${nb_brac} bracelets actif${nb_brac > 1 ? "s" : ""}`,
        type: ActivityType.Watching,
      },
      {
        name: `${rapports} rapports`,
        type: ActivityType.Watching,
      },
      {
        name: `${lspdUsers} personne${lspdUsers > 1 ? "s" : ""} connecté${lspdUsers > 1 ? "s" : ""}`,
        type: ActivityType.Watching,
      }
    ];
  } catch (err) {
    console.error("Erreur lors de la récupération des stats :", err);
    return [
      { name: "Assister le LSPD", type: ActivityType.Playing },
    ]; // Fallback
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

    await cyclePresence(); // Première mise à jour immédiate
    setInterval(cyclePresence, 5000); // Puis toutes les 5 secondes

    await registerCommands();
  });

  setBot(bot);
}

startBot();

module.exports = bot;
