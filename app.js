const express = require("express");
const path = require("path");
const { createServer } = require("http");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("./config/passport");
const { SESSION_SECRET } = require("./config/env");
const { startOvertimeScheduler } = require("./utils/rappelPointeuse");
// ⚠️ IMPORTANT : on doit instancier le bot Discord pour que les rappels puissent s'envoyer
// (ce require lance startBot() dans config/bot.js)
const bot = require("./config/bot");

// Utilitaires et scripts internes
require("./utils/liveUsersCleaner");
require("./utils/cleanSanctions");

// Import du module Trello refactorisé
const { initTrello } = require("./LSPD/trello/config/trelloServer");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const port = process.env.PORT || 3001;

// 🧠 Middleware de session
app.use(
    session({
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false, // false pour HTTP en développement
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 // 24 heures
        }
    })
);

// Body parser
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// ⚠️ Route racine AVANT le auth guard
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "LSPD", "connect.html"));
});

// Auth guard
app.use((req, res, next) => {
    const publicPaths = [
        '/',
        '/login',
        '/callback',
        '/logout',
        '/bracelet',
        '/connect.html',
        '/trello',
        '/register.html',
        '/forgot-password.html',
        '/reset-password.html',
        '/register',
        '/login-local',
        '/forgot-password',
        '/reset-password',
        '/api/user/discord-info'
    ];

    // Autoriser uniquement les assets front (pas les .html)
    const isStaticAsset = req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg)$/i);
    if (isStaticAsset) return next();

    // Autoriser seulement les routes publiques
    if (publicPaths.includes(req.path)) return next();

    // Cas API interne
    if (req.headers['x-internal'] === 'true') return next();

    // Tout le reste → nécessite une connexion
    if (!req.isAuthenticated?.()) {
        // Stocker l'URL originale dans la session pour redirection après login
        req.session.returnTo = req.originalUrl;
        return res.redirect('/connect.html');
    }

    next();
});

// Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const braceletRoutes = require("./routes/bracelet");
const configRoutes = require("./config/setup");
const convocationRoute = require("./routes/convocation");
const agentsRoutes = require("./routes/agents");
const incidentsRoute = require("./routes/incidents");
const arrestationRoute = require("./routes/arrestation");
const delitsRoute = require("./routes/delits");
const dashboardRoute = require("./routes/dashboard");
const liveUsersRoute = require('./routes/liveUsers');
const pointeuse = require('./routes/pointeuse');
const setupPointeuse = require('./config/setupPointeuse');
const gradesRoute = require('./config/grades');
const absenceRoute = require("./routes/absence");
const sanctionsRoutes = require("./routes/sanctions");
const presenceIg = require("./routes/presenceig");
const ticketPanelRoutes = require('./routes/ticketPanel');
const adminOfficer = require('./routes/officers');
const rapportRookie = require('./routes/rapport-rookie');
const convocAgent = require('./routes/convocAgent');
const annonce = require('./routes/annonce');
const faq = require('./routes/faq');
const calendarRoutes = require('./routes/calendar');
const rookiePatrolsRoutes = require('./LSPD/trello/routes/rookiePatrols');
const discordUploader = require('./routes/discordUploader');
const setupLogsRoutes = require('./config/setupLogs');

app.use(configRoutes);
app.use(authRoutes);
app.use(userRoutes);
app.use(braceletRoutes);
app.use(arrestationRoute);
app.use(convocationRoute);
app.use(agentsRoutes);
app.use(incidentsRoute);
app.use(delitsRoute);
app.use(dashboardRoute);
app.use(liveUsersRoute);
app.use(pointeuse);
app.use(setupPointeuse);
app.use(gradesRoute);
app.use(absenceRoute);
app.use(sanctionsRoutes);
app.use('/api/presenceig', presenceIg);
app.use(ticketPanelRoutes);
app.use(adminOfficer);
app.use(rapportRookie);
app.use(convocAgent);
app.use(setupLogsRoutes);
app.use(annonce);
app.use(faq);
app.use(calendarRoutes);
app.use(rookiePatrolsRoutes);
app.use(rapportRookie);
// Route utilitaire pour uploader des images via le bot Discord
app.use(discordUploader);

// 🗂️ Frontend statique
app.use(express.static(path.join(__dirname, "LSPD")));

// La route "/" est définie AVANT le auth guard (ligne ~48)

async function startServer() {
    // Charger la configuration LSPD
    const { loadConfig } = require("./config/config");
    await loadConfig();

    // Initialiser la partie Trello (DB + Socket + routes)
    await initTrello(app, io);

    httpServer.listen(port, () => {
        console.clear();
        console.log(`🚀 Serveur LSPD démarré sur http://localhost:${port}/connect.html`);
    });
}

startServer();

// Lancer le scheduler de dépassement d'horaires uniquement quand le bot est prêt
// (sinon getBot() lèvera une erreur "Bot non initialisé")
if (bot && bot.once) {
    bot.once('ready', () => {
        startOvertimeScheduler();
    });
} else {
    console.warn('⚠️ Impossible d’attacher le scheduler (bot non disponible)');
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
                    console.warn('⚠️ pool.end déjà appelé, ignore.');
                } else {
                    console.error('Erreur fermeture pool:', e.message);
                }
            }
        }
        // Fermer le serveur HTTP si nécessaire
        if (httpServer && httpServer.close) {
            await new Promise(resolve => httpServer.close(resolve));
        }
    } finally {
        process.exit(0);
    }
}

['SIGINT', 'SIGTERM'].forEach(sig => {
    process.once(sig, () => gracefulShutdown(sig));
});

// En cas d'arrêt via Ctrl+C répété, forcer après délai
process.once('SIGINT', () => {
    if (!shuttingDown) return;
    setTimeout(() => { if (shuttingDown) { console.warn('Forçage arrêt.'); process.exit(1); } }, 5000);
});
