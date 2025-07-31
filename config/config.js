let currentConfig = null;
let bot = null;

const pool = require("./db");

async function loadConfig() {
  const configRes = await pool.query("SELECT * FROM configlspd LIMIT 1");
  const gradesRes = await pool.query("SELECT * FROM lspd_grades LIMIT 1");

  currentConfig = configRes.rows[0];

  // Ajoute les grades à la config en les classant dans l'ordre
  currentConfig.lspd_grades = Object.entries(gradesRes.rows[0]);
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