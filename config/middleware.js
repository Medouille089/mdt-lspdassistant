const { getConfig } = require("./config");
const bot = require("./bot");
const GUILD_ID = process.env.GUILD_ID;

async function checkAuth(req, res, next) {
  if (!req.isAuthenticated()) {
    req.session.returnTo = req.originalUrl;
    console.log(`🔒 Non authentifié, stockage returnTo: ${req.originalUrl}`);
    return res.redirect("/login");
  }

  try {
    const config = await getConfig();
    const REQUIRED_ROLE_ID = config.required_role_id?.trim();
    const SUPER_ADMIN_ROLE = config.id_superadmin?.trim();
    const DOJ_ROLE_ID = config.doj_role_id?.trim();

    const guild = await bot.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(req.user.id);
    const roleIds = member.roles.cache.map(role => role.id.trim());

    console.log("📌 Roles utilisateur :", roleIds);

    // Super admin bypass
    if (SUPER_ADMIN_ROLE && roleIds.includes(SUPER_ADMIN_ROLE)) return next();

    const hasRequiredRole = REQUIRED_ROLE_ID && roleIds.includes(REQUIRED_ROLE_ID);
    const hasDojRole = DOJ_ROLE_ID && roleIds.includes(DOJ_ROLE_ID);

    console.log(`✅ hasRequiredRole=${hasRequiredRole}, hasDojRole=${hasDojRole}`);

    if (!hasRequiredRole && !hasDojRole) {
      return res.status(403).send(`
        <!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Accès refusé</title></head><body>
        <h1>⛔ Accès refusé</h1>
        <p>Désolé <strong>${req.user.username}</strong>, vous n’avez pas le rôle requis pour accéder à cette page.</p>
        <a href="/logout">Se déconnecter</a>
        </body></html>
      `);
    }

    // Stocker les infos dans req.user pour réutiliser dans auth.js
    req.user.isSuperAdmin = SUPER_ADMIN_ROLE && roleIds.includes(SUPER_ADMIN_ROLE);
    req.user.isDoj = hasDojRole;
    req.user.hasRequiredRole = hasRequiredRole;

    next();
  } catch (err) {
    console.error("Erreur dans checkAuth :", err);
    res.status(500).send("Erreur interne.");
  }
}

module.exports = { checkAuth };
