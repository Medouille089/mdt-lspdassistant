const express = require("express");
const path = require("path");
const { createServer } = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const session = require("express-session");
const sessionStoreHelper = require("./config/sessionStore");
const passport = require("./config/passport");
const { GUILD_ID } = require("./config/env");
const { SESSION_SECRET } = require("./config/env");
const { startOvertimeScheduler } = require("./utils/rappelPointeuse");
const bot = require("./config/bot");

// Gestionnaires d'erreurs globaux pour éviter les crashs
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled promise rejection:', reason);
  // Ne pas crasher l'application, juste logger
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  // Pour les exceptions non gérées, on pourrait vouloir redémarrer
  // mais pour l'instant on log seulement
});

// Utilitaires et scripts internes
require("./utils/liveUsersCleaner");
require("./utils/cleanSanctions");

// Import du module Trello refactorisé
const { initTrello } = require("./LSPD/trello/config/trelloServer");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const port = process.env.PORT || 3001;

// Trust proxy headers (important si derrière nginx/Caddy/Apache en HTTPS)
app.set('trust proxy', 1);

// 🧠 Middleware de session
// Détection auto HTTPS : si IS_LOCAL=true, forcer dev (HTTP), sinon prod (HTTPS)
const IS_LOCAL = process.env.IS_LOCAL === 'true';
const isProduction = !IS_LOCAL && (process.env.NODE_ENV === 'production' || process.env.HTTPS === 'true');

console.log(`[Session] Mode: ${isProduction ? 'PRODUCTION (HTTPS)' : 'DEVELOPMENT (HTTP)'}`);
console.log(`[Session] Cookie secure: ${isProduction}, sameSite: ${isProduction ? 'none' : 'lax'}`);

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction, // true en prod HTTPS (requis pour SameSite=None)
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 24 heures
      sameSite: isProduction ? 'none' : 'lax', // none en prod (iframe), lax en dev
    },
  })
);

// Expose the session store to the helper so other modules can destroy sessions
try {
  const store = app.get("trust proxy") ? null : undefined; // placeholder
  // The express-session store instance is available as the return value of session() middleware only
  // We can access it via the middleware's default MemoryStore by retrieving the session middleware
  // from the stack. This is fragile but works for MemoryStore. Safer alternative: explicitly create store and pass it.
  const sessMiddleware =
    app._router &&
    app._router.stack &&
    app._router.stack.find((m) => m.name === "session");
  if (sessMiddleware && sessMiddleware.handle && sessMiddleware.handle.store) {
    sessionStoreHelper.setStore(sessMiddleware.handle.store);
  }
} catch (e) {
  console.warn(
    "Impossible de récupérer le store de sessions automatiquement:",
    e && e.message ? e.message : e
  );
}

// Body parser
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// CSP pour autoriser l'affichage en iframe (NUI FiveM / tablettes)
// Note: FiveM NUI utilise le schéma nui:// qui n'est pas un "network scheme" standard
// On doit donc autoriser toutes les origines avec * (wildcard)
app.use((req, res, next) => {
  // Supprimer toute CSP existante qui pourrait bloquer
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Frame-Options');
  
  // Autoriser l'affichage en iframe depuis n'importe quelle origine
  res.setHeader('Content-Security-Policy', "frame-ancestors * 'self' https: http: data: nui:");
  next();
});

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Middleware global: si utilisateur authentifié ET possède le rôle blacklist -> rediriger systématiquement
app.use(async (req, res, next) => {
  try {
    if (!req.isAuthenticated || !req.isAuthenticated()) return next();

    // Eviter de boucler sur la page blacklisted ou sur les assets publics
    const skipPaths = ["/", "/connect.html", "/blacklisted.html", "/login", "/logout", "/callback"];
    const isStaticAsset = req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico)$/i);
    if (isStaticAsset) return next();

    // Normaliser la comparaison pour accepter /page et /page.html
    const normalize = (p) => (p || "").replace(/\/$/, "").replace(/\.html$/, "");
    const requestNormalized = normalize(req.path);
    const skipNormalized = skipPaths.map(normalize);
    if (skipNormalized.includes(requestNormalized)) return next();

    // First: check DB table lspd_blacklist so users are blocked even if they don't have the role
    try {
      const pool = require("./config/db");
      const { rows } = await pool.query(
        "SELECT discord_id FROM lspd_blacklist WHERE discord_id = $1",
        [req.user.id]
      );
      if (rows && rows.length) {
        if (
          (req.originalUrl && req.originalUrl.startsWith("/api/")) ||
          req.xhr ||
          (req.get &&
            req.get("accept") &&
            req.get("accept").includes("application/json"))
        ) {
          return res.status(403).json({ error: "blacklisted" });
        }
        if (req.path !== "/blacklisted.html")
          return res.redirect("/blacklisted.html");
      }
    } catch (e) {
      console.error(
        "Erreur vérif blacklist DB (global middleware):",
        e && e.message ? e.message : e
      );
      // don't block on DB errors: continue to role-based check
    }

    const config = require("./config/config").getConfig();
    const blacklistRoleId =
      config && config.blacklist_role_id
        ? String(config.blacklist_role_id).trim()
        : null;
    if (!blacklistRoleId) return next();

    // Récupérer le membre actuel
    const botInstance = require("./config/bot");
    const guild = await botInstance.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(req.user.id).catch(() => null);
    if (!member) return next();

    const roleIds = member.roles.cache.map((r) => r.id);
    if (roleIds.includes(blacklistRoleId)) {
      // Si appel API, renvoyer JSON
      if (
        (req.originalUrl && req.originalUrl.startsWith("/api/")) ||
        req.xhr ||
        (req.get &&
          req.get("accept") &&
          req.get("accept").includes("application/json"))
      ) {
        return res.status(403).json({ error: "blacklisted" });
      }
      // Sinon rediriger vers la page explicative
      if (req.path !== "/blacklisted.html")
        return res.redirect("/blacklisted.html");
    }

    return next();
  } catch (err) {
    console.error("Erreur middleware blacklist global:", err);
    return next();
  }
});

// ⚠️ Route racine AVANT le auth guard
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "LSPD", "connect.html"));
});

// Auth guard
app.use((req, res, next) => {
  const publicPaths = [
    "/",
    "/login",
    "/callback",
    "/logout",
    "/bracelet",
    "/connect.html",
    "/trello",
    "/register.html",
    "/forgot-password.html",
    "/reset-password.html",
    "/register",
    "/login-local",
    "/forgot-password",
    "/reset-password",
     "/recrutement",
      "/forms/recruitment",
     "/api/user/discord-info",
  ];

  // Autoriser uniquement les assets front (pas les .html)
  const isStaticAsset = req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg)$/i);
  if (isStaticAsset) return next();

  // Normaliser la comparaison pour accepter /page et /page.html
  const normalize = (p) => (p || "").replace(/\/$/, "").replace(/\.html$/, "");
  const requestNormalized = normalize(req.path);
  const publicNormalized = publicPaths.map(normalize);
  // Autoriser seulement les routes publiques
  if (publicNormalized.includes(requestNormalized)) return next();

  // Cas API interne
  if (req.headers["x-internal"] === "true") return next();

  // Tout le reste → nécessite une connexion
  if (!req.isAuthenticated?.()) {
    // Stocker l'URL originale dans la session pour redirection après login
    req.session.returnTo = req.originalUrl;
    return res.redirect("/connect.html");
  }

  next();
});

// Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const braceletRoutes = require("./routes/bracelet");
const configRoutes = require("./config/setup");
const convocationRoute = require("./routes/convocation");
const convocationsRoute = require("./routes/convocations");
const agentsRoutes = require("./routes/agents");
const incidentsRoute = require("./routes/incidents");
const arrestationRoute = require("./routes/arrestation");
const delitsRoute = require("./routes/delits");
const dashboardRoute = require("./routes/dashboard");
const liveUsersRoute = require("./routes/liveUsers");
const pointeuse = require("./routes/pointeuse");
const setupPointeuse = require("./config/setupPointeuse");
const comptabiliteRoute = require("./routes/comptabilite");
const gradesRoute = require("./config/grades");
const absenceRoute = require("./routes/absence");
const sanctionsRoutes = require("./routes/sanctions");
const presenceIg = require("./routes/presenceig");
const ticketPanelRoutes = require("./routes/ticketPanel");
const adminOfficer = require("./routes/officers");
const rapportRookie = require("./routes/rapport-rookie");
const convocAgent = require("./routes/convocAgent");
const annonce = require("./routes/annonce");
const recruitmentRoute = require("./routes/recruitment");
const faq = require("./routes/faq");
const calendarRoutes = require("./routes/calendar");
const calculPeinesRoutes = require("./routes/calculPeines");
const rookiePatrolsRoutes = require("./LSPD/trello/routes/rookiePatrols");
const discordUploader = require("./routes/discordUploader");
const setupLogsRoutes = require("./config/setupLogs");
const officerConvocations = require('./routes/officerConvocations');
const accountsRoutes = require('./routes/accounts');
const trelloLogs = require('./routes/trelloLogs');
const citoyensRoutes = require('./routes/citoyens');
const weaponsRoutes = require('./routes/weapons');

const githubPushRoute = require('./routes/githubPush');

app.use(configRoutes);
app.use(authRoutes);
app.use(userRoutes);
app.use(braceletRoutes);
app.use(citoyensRoutes);
app.use(weaponsRoutes);
app.use(arrestationRoute);
app.use(convocationRoute);
app.use(convocationsRoute);
app.use(agentsRoutes);
app.use(incidentsRoute);
app.use(delitsRoute);
app.use(dashboardRoute);
app.use(liveUsersRoute);
app.use(pointeuse);
app.use(setupPointeuse);
app.use(comptabiliteRoute);
app.use(gradesRoute);
app.use(absenceRoute);
app.use(sanctionsRoutes);
app.use("/api/presenceig", presenceIg);
app.use(ticketPanelRoutes);
app.use(adminOfficer);
app.use(rapportRookie);
app.use(convocAgent);
app.use(setupLogsRoutes);
app.use(annonce);
app.use(recruitmentRoute);
app.use(faq);
app.use(calendarRoutes);
app.use("/api", calculPeinesRoutes);
app.use(rookiePatrolsRoutes);
app.use(rapportRookie);
// Route utilitaire pour uploader des images via le bot Discord
app.use(discordUploader);
app.use(officerConvocations);
app.use(accountsRoutes);
app.use(trelloLogs);

// Route pour recevoir les pushs GitHub
app.use(githubPushRoute);

// Middleware: canonicalize .html URLs -> redirect to extensionless, and
// serve *.html when users request /page (without extension).
app.use(async (req, res, next) => {
  try {
    // Ignore assets (css/js/images/etc.) and API routes
    if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico)$/i)) return next();
    if (req.path.startsWith("/api/")) return next();

    // If URL ends with .html, redirect to extensionless canonical URL
    if (req.path.endsWith(".html")) {
      const canonical = req.path.replace(/\.html$/, "");
      // preserve querystring
      const qs = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
      return res.redirect(301, canonical + qs);
    }

    // Try to serve a corresponding .html file for extensionless path
    // e.g. /dashboard -> LSPD/dashboard.html
    const candidate = path.join(__dirname, "LSPD", req.path === "/" ? "index.html" : `${req.path.replace(/^\//, "")}.html`);
    const fs = require("fs");
    if (fs.existsSync(candidate)) {
      return res.sendFile(candidate);
    }

    return next();
  } catch (e) {
    return next();
  }
});

// 🗂️ Frontend statique
app.use(express.static(path.join(__dirname, "LSPD")));

// La route "/" est définie AVANT le auth guard (ligne ~48)

async function startServer() {
  // Charger la configuration LSPD
  const { loadConfig } = require("./config/config");
  await loadConfig();

  // Initialiser la partie Trello (DB + Socket + routes)
  try {
    await initTrello(app, io);
    console.log("✅ Trello initialisé");
  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation de Trello:", error.message);
    console.warn("⚠️  Le serveur continue sans Trello");
  }

  httpServer.listen(port, () => {
    console.log(
      `🚀 Serveur LSPD démarré sur http://localhost:${port}/connect.html`
    );
  });
}

startServer();

// Lancer le scheduler de dépassement d'horaires uniquement quand le bot est prêt
// (sinon getBot() lèvera une erreur "Bot non initialisé")
if (bot && bot.once) {
  bot.once("ready", () => {
    startOvertimeScheduler();
  });
} else {
  console.warn("⚠️ Impossible d’attacher le scheduler (bot non disponible)");
}

// ================== Gestion gracieuse de l'arrêt ==================
let shuttingDown = false;
async function gracefulShutdown(signal) {
  if (shuttingDown) {
    return; // Empêche double exécution
  }
  shuttingDown = true;
  try {
    if (useDatabase && pool) {
      try {
        await pool.end();
      } catch (e) {
        if (e && /end on pool more than once/i.test(e.message)) {
          console.warn("⚠️ pool.end déjà appelé, ignore.");
        } else {
          console.error("Erreur fermeture pool:", e.message);
        }
      }
    }
    // Fermer le serveur HTTP si nécessaire
    if (httpServer && httpServer.close) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
  } finally {
    process.exit(0);
  }
}

["SIGINT", "SIGTERM"].forEach((sig) => {
  process.once(sig, () => gracefulShutdown(sig));
});

// En cas d'arrêt via Ctrl+C répété, forcer après délai
process.once("SIGINT", () => {
  if (!shuttingDown) return;
  setTimeout(() => {
    if (shuttingDown) {
      console.warn("Forçage arrêt.");
      process.exit(1);
    }
  }, 5000);
});
