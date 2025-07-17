const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("./config/passport");
const { SESSION_SECRET } = require("./config/env");

const app = express();
const port = process.env.PORT || 3001;

// Middlewares de session et parser
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(bodyParser.json());
app.use(passport.initialize());
app.use(passport.session());

// Middleware global pour autoriser les requêtes publiques/internes
app.use((req, res, next) => {
  const publicPaths = ['/login', '/callback', '/logout', '/bracelet'];
  if (req.headers['x-internal'] === 'true') return next();
  if (publicPaths.includes(req.path)) return next();
  if (!req.isAuthenticated?.()) {
    return res.redirect('/login');
  }
  next();
});

// Déclaration des routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const braceletRoutes = require("./routes/bracelet");
const configRoutes = require("./config/setup");
const convocationRoute = require("./routes/convocation");
const agentsRoutes = require("./routes/agents");

app.use(configRoutes);
app.use(authRoutes);
app.use(userRoutes);
app.use(braceletRoutes);
app.use(convocationRoute);
app.use(agentsRoutes);

// Serveur de fichiers statiques
app.use(express.static(path.join(__dirname, "LSPD")));

// Démarrage du serveur
app.listen(port, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${port}`);
});
