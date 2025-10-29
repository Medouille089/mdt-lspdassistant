require("dotenv").config();

module.exports = {
  CLIENT_ID: process.env.CLIENT_ID,
  CLIENT_SECRET: process.env.CLIENT_SECRET,
  REDIRECT_URI: process.env.REDIRECT_URI,
  GUILD_ID: process.env.GUILD_ID,
  TOKEN: process.env.TOKEN,
  WEBHOOK_BRACELET: process.env.WEBHOOK_BRACELET,
  SESSION_SECRET: process.env.SESSION_SECRET,
  DISCORD_WEBHOOK_LOGS: process.env.DISCORD_WEBHOOK_LOGS,
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: process.env.PORT,
  DOJ_ROLE_ID: process.env.DOJ_ROLE_ID,
};
