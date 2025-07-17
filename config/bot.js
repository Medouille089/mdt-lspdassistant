const { Client, GatewayIntentBits, ActivityType } = require("discord.js");
const { loadConfig, getConfig, setBot } = require("./config");

const bot = new Client({
  intents: [GatewayIntentBits.Guilds],
});

async function startBot() {
  await loadConfig(); 
  const config = getConfig(); 

  const TOKEN = process.env.TOKEN;
  await bot.login(TOKEN);

  bot.once("ready", () => {
    console.log(`🤖 Bot connecté en tant que ${bot.user.tag}`);
    bot.user.setPresence({
      activities: [{ name: "Assister le LSPD", type: ActivityType.Playing }],
      status: "online",
    });
  });

  setBot(bot);
}

startBot();

module.exports = bot;
