let currentConfig = null;
let bot = null; 

const pool = require("./db");

async function loadConfig() {
  const res = await pool.query("SELECT * FROM configlspd LIMIT 1");
  currentConfig = res.rows[0];
}

function getConfig() {
  if (!currentConfig) {
    throw new Error("Configuration non chargée");
  }
  return currentConfig;
}

function setBot(discordClient) {
  bot = discordClient;
}

function getBot() {
  if (!bot) {
    throw new Error("Bot non initialisé");
  }
  return bot;
}

module.exports = {
  loadConfig,
  getConfig,
  setBot,
  getBot,
};
