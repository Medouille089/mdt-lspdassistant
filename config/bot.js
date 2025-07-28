const { Client, GatewayIntentBits, ActivityType, Collection, Events, REST, Routes } = require("discord.js");
const { loadConfig, getConfig, setBot } = require("./config");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ]
});

bot.commands = new Collection();
const commandFiles = fs.readdirSync(path.join(__dirname, "../commands")).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(__dirname, "../commands", file));
  bot.commands.set(command.data.name, command);
}

async function registerCommands() {
  const commands = bot.commands.map(cmd => cmd.data.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {
    console.log("📤 Enregistrement des commandes slash...");

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), 
      { body: commands }
    );

    console.log("✅ Commandes enregistrées avec succès !");
  } catch (err) {
    console.error("❌ Erreur en enregistrant les commandes :", err);
  }
}

bot.on(Events.InteractionCreate, async interaction => {
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

async function startBot() {
  await loadConfig();
  const config = getConfig();

  await bot.login(process.env.TOKEN);

  bot.once("ready", async () => {
    console.log(`🤖 Bot connecté en tant que ${bot.user.tag}`);

    bot.user.setPresence({
      activities: [{ name: "Assister le LSPD", type: ActivityType.Playing }],
      status: "online",
    });

    await registerCommands(); // Enregistrement automatique ici
  });

  setBot(bot);
}

startBot();

module.exports = bot;
