let currentConfig = null;
let bot = null;

const pool = require("./db");

async function loadConfig() {
  try {
    const configRes = await pool.query("SELECT * FROM configlspd LIMIT 1");
    const gradesRes = await pool.query("SELECT * FROM lspd_grades LIMIT 1");
    const formationsRes = await pool.query("SELECT * FROM lspd_formations LIMIT 1");

  currentConfig = configRes.rows[0];
  // Ajout DOJ
  currentConfig.id_doj = process.env.DOJ_ROLE_ID || null;
  currentConfig.lspd_grades = Object.entries(gradesRes.rows[0]);
  currentConfig.lspd_formations = Object.entries(formationsRes.rows[0]);

  } catch (error) {
    console.error("❌ Erreur lors du chargement de la configuration:", error.message);
    // Configuration par défaut en cas d'erreur
    currentConfig = {
      required_role_id: process.env.REQUIRED_ROLE_ID || "default_role",
      logs_channel: process.env.LOGS_CHANNEL || null,
      commandstaff_id: process.env.COMMANDSTAFF_ID || null,
      supervisor_role_id: process.env.SUPERVISOR_ROLE_ID || null,
      id_superadmin: process.env.SUPERADMIN_ROLE_ID || null,
      id_doj: process.env.DOJ_ROLE_ID || null,
      lspd_grades: [],
      lspd_formations: []
    };
  }
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