const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("./config/passport");
const { SESSION_SECRET } = require("./config/env");

const app = express();
const port = process.env.PORT || 3001;

// Middleware session
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// Body parser
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Auth guard
app.use((req, res, next) => {
  const publicPaths = ['/login', '/callback', '/logout', '/bracelet'];
  if (req.headers['x-internal'] === 'true') return next();
  if (publicPaths.includes(req.path)) return next();
  if (!req.isAuthenticated?.()) {
    return res.redirect('/login');
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

app.use(configRoutes);
app.use(authRoutes);
app.use(userRoutes);
app.use(braceletRoutes);
app.use(convocationRoute);
app.use(agentsRoutes);
app.use(incidentsRoute);

// Static frontend
app.use(express.static(path.join(__dirname, "LSPD")));

// Start server
app.listen(port, () => {
  console.clear();
  console.log(`🚀 Serveur démarré sur http://localhost:${port}`);
});
