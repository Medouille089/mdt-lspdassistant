require("dotenv").config();

// Helper: parse une liste d'IDs séparés par des virgules ("123,456,789") en tableau.
const parseIdList = (value) =>
  (value || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

module.exports = {
  // ----- OAuth2 / Bot Discord -----
  CLIENT_ID: process.env.CLIENT_ID,
  CLIENT_SECRET: process.env.CLIENT_SECRET,
  REDIRECT_URI: process.env.REDIRECT_URI,
  GUILD_ID: process.env.GUILD_ID,
  TOKEN: process.env.TOKEN,

  // ----- Webhooks -----
  WEBHOOK_BRACELET: process.env.WEBHOOK_BRACELET,
  DISCORD_WEBHOOK_LOGS: process.env.DISCORD_WEBHOOK_LOGS,

  // ----- Sessions / Base de données / Serveur -----
  SESSION_SECRET: process.env.SESSION_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: process.env.PORT,

  // ----- Rôles Discord (IDs) -----
  DOJ_ROLE_ID: process.env.DOJ_ROLE_ID,
  PRESENCE_ROLE_ID: process.env.PRESENCE_ROLE_ID,
  // Listes d'IDs séparées par des virgules pour la commande /setrookie
  SETROOKIE_AUTHORIZED_ROLES: parseIdList(process.env.SETROOKIE_AUTHORIZED_ROLES),
  SETROOKIE_ROLES_TO_ADD: parseIdList(process.env.SETROOKIE_ROLES_TO_ADD),
  SETROOKIE_ROLES_TO_REMOVE: parseIdList(process.env.SETROOKIE_ROLES_TO_REMOVE),

  // ----- Salons Discord (IDs) -----
  GITHUB_PUSH_CHANNEL_ID: process.env.GITHUB_PUSH_CHANNEL_ID,
  RECRUITMENT_CHANNEL_ID: process.env.RECRUITMENT_CHANNEL_ID,
  PRESENCE_CHANNEL_ID: process.env.PRESENCE_CHANNEL_ID,
  UPLOAD_GUILD_ID: process.env.UPLOAD_GUILD_ID,
  UPLOAD_CATEGORY_ID: process.env.UPLOAD_CATEGORY_ID,

  // ----- Divers -----
  RECRUITMENT_BANNER_URL: process.env.RECRUITMENT_BANNER_URL,
};
