const { getConfig } = require("./config");
const bot = require("./bot");
const GUILD_ID = process.env.GUILD_ID;

async function checkAuth(req, res, next) {
  if (!req.isAuthenticated()) return res.redirect("/login");

  try {
    const config = await getConfig();
    const REQUIRED_ROLE_ID = String(config.required_role_id); 
    const SUPER_ADMIN_ROLE = config.id_superadmin ? String(config.id_superadmin).trim() : null;

    const guild = await bot.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(req.user.id);
    const roleIds = member.roles.cache.map(role => role.id);

    // Super admin bypass
    if (SUPER_ADMIN_ROLE && roleIds.includes(SUPER_ADMIN_ROLE)) {
      return next();
    }

    const hasRole = roleIds.includes(REQUIRED_ROLE_ID);
    if (!hasRole) {
      return res.status(403).send(`
        <!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Accès refusé</title></head><body>
        <h1>⛔ Accès refusé</h1>
        <p>Désolé <strong>${req.user.username}</strong>, vous n’avez pas le rôle requis pour accéder à cette page.</p>
        <a href="/logout">Se déconnecter</a>
        </body></html>
      `);
    }

    next();
  } catch (err) {
    console.error("Erreur dans checkAuth :", err);
    res.status(500).send("Erreur interne.");
  }
}

module.exports = { checkAuth };
