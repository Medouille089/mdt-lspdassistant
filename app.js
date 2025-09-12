const express = require("express");
const path = require("path");
require('./utils/liveUsersCleaner');
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("./config/passport");
const { SESSION_SECRET } = require("./config/env");
const { startOvertimeScheduler } = require("./utils/rappelPointeuse");


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
  const publicPaths = ['/login', '/callback', '/logout', '/bracelet', '/connect.html'];

  const isStatic = req.path.match(/\.(html|css|js|png|jpg|jpeg|gif|svg)$/);
  if (isStatic) return next();

  if (publicPaths.includes(req.path)) return next();

  if (req.headers['x-internal'] === 'true') return next();

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

// Static frontend
app.use(express.static(path.join(__dirname, "LSPD")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "LSPD", "connect.html"));
});

// Start server
app.listen(port, () => {
  console.clear();
  console.log(`🚀 Serveur démarré sur http://localhost:${port}/connect.html`);
});

startOvertimeScheduler();
