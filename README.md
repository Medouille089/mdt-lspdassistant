# 🚓 LSPD Assistant

All-in-one platform (web app + Discord bot + real-time board) for the operational and administrative management of a roleplay police department (LSPD).

It centralizes agent profiles, reports, summons, sanctions, attendance, absences, equipment cards, and a Trello-style collaborative board updated in real time.

---

## ✨ Features

| Area | Highlights |
|------|-----------|
| Authentication | Discord OAuth2 login + secure sessions (Passport + express-session) |
| Agent profiles | Auto-creation, photo, badge number, weapons, vehicles, dynamic grade from Discord roles |
| Grades & training | Dynamic mapping from DB (`lspd_grades`, `lspd_formations`) to Discord roles |
| Summons / tickets | Create, archive, browse |
| Sanctions | Disciplinary records with automatic expiry cleanup (`cleanSanctions`) |
| Attendance / time clock | Check-in/out tracking and scheduled reminders (`rappelPointeuse`) |
| Absences | Declaration and administration |
| Wanted notices | Wanted / missing persons with version history |
| Rookie patrol | Patrol follow-up with version history |
| Trello board | Real-time via Socket.IO, persisted in PostgreSQL, in-memory fallback |
| Recruitment | Public multi-step application form posted to Discord via the bot |
| PDF export | Generation via `pdfkit` / `puppeteer` |
| Discord integration | Roles, avatars, webhooks, logs, dynamic member lookup |

## 🧱 Tech stack

- **Runtime:** Node.js 18+ (CommonJS)
- **Server:** Express 5
- **Auth:** Passport + passport-discord (OAuth2)
- **Real-time:** Socket.IO
- **Database:** PostgreSQL (`pg` pool)
- **Scheduling:** node-cron
- **Discord bot:** discord.js v14
- **PDF / rendering:** pdfkit, puppeteer
- **Dates:** luxon, moment-timezone
- **Uploads:** multer (in-memory)
- **Frontend:** vanilla HTML/CSS/JS + ES modules for the Trello board

## 🗂️ Project structure

```
app.js                 # Server bootstrap: Express, Socket.IO, Trello, routes, bot
config/                # env, db pool, passport, bot, dynamic config, middleware
routes/                # REST API (agents, arrestation, sanctions, recruitment, ...)
commands/              # Discord slash commands
discordUtils/          # Discord helpers (embeds, webhooks, presence sheets)
utils/                 # Scheduled tasks & helpers (cleanSanctions, rappelPointeuse, ...)
migrations/            # One-off SQL/JS migration scripts
LSPD/                  # Frontend
  ├── *.html           # Pages (connect, dashboard, infos-agent, admin*, ...)
  ├── scripts/         # Page scripts (vanilla JS)
  ├── styles/          # Stylesheets
  └── trello/          # Real-time board (ES modules + Socket.IO server)
```

## 🔐 Authentication & roles

1. Discord OAuth2 via Passport → an Express session is created.
2. A global middleware in `app.js` blocks everything except the login page and static assets.
3. `checkAuth` (and the DOJ variant) enforces the required role (from the `configlspd` table) or super-admin bypass.
4. An agent's grade is computed dynamically by scanning their Discord roles (`GET /api/agent-grade/:userId`).

Most role/channel configuration lives in the **`configlspd`** database table and is managed from the admin UI, so permissions can change without touching the code.

## 🔄 Real-time Trello board

1. The client loads `/trello/` (ES modules).
2. Socket.IO connects → the server sends `boardSync` (full board state).
3. Each operation (add card, tag, move, ...) is applied as a diff via `OperationsManager` and persisted to PostgreSQL (with retry).
4. If `DATABASE_URL` is missing, the board runs in **in-memory mode** (not persisted); the mode is logged at startup.

## ⚙️ Installation & setup

### Prerequisites

- Node.js 18+
- PostgreSQL (optional for a quick local test without Trello persistence)
- A Discord application + bot with the appropriate gateway intents

### Install

```bash
git clone https://github.com/Medouille089/mdt-lspdassistant.git
cd mdt-lspdassistant
npm install
cp .env.example .env   # then fill in your own values
```

### Configuration

All secrets and Discord IDs are loaded from environment variables — **nothing is hardcoded** in the source. Copy `.env.example` to `.env` and fill it in.

Core variables:

| Name | Description |
|------|-------------|
| `CLIENT_ID` / `CLIENT_SECRET` | Discord OAuth2 application credentials |
| `REDIRECT_URI` | OAuth2 callback URL |
| `TOKEN` | Discord bot token |
| `GUILD_ID` | Main Discord server ID |
| `DATABASE_URL` | PostgreSQL connection string (SSL enabled) |
| `SESSION_SECRET` | Express session secret |
| `DISCORD_WEBHOOK_LOGS` | System logs webhook |
| `WEBHOOK_BRACELET` | Bracelet / tracking webhook |
| `PORT` | HTTP port (default `3001`) |
| `NODE_ENV` / `IS_LOCAL` / `HTTPS` | Runtime flags |

Discord IDs (channels, roles, categories) used by specific features:

| Name | Used by |
|------|---------|
| `DOJ_ROLE_ID` | DOJ access checks |
| `PRESENCE_ROLE_ID` / `PRESENCE_CHANNEL_ID` | In-game presence board (`routes/presenceig.js`) |
| `SETROOKIE_AUTHORIZED_ROLES` / `SETROOKIE_ROLES_TO_ADD` / `SETROOKIE_ROLES_TO_REMOVE` | `/setrookie` command (comma-separated ID lists) |
| `GITHUB_PUSH_CHANNEL_ID` | GitHub push notifications (`routes/githubPush.js`) |
| `RECRUITMENT_CHANNEL_ID` / `RECRUITMENT_BANNER_URL` | Recruitment applications (`routes/recruitment.js`) |
| `UPLOAD_GUILD_ID` / `UPLOAD_CATEGORY_ID` | Discord uploader (`routes/discordUploader.js`) |
| `DISCORD_LOG_CHANNEL_ID` | Investigation logs (`routes/enquete.js`) |
| `TRELLO_EFFECTIF_LIST_NAME` | Trello reset scheduler |

> See `.env.example` for the complete, commented list. Optional fallbacks
> (`REQUIRED_ROLE_ID`, `LOGS_CHANNEL`, ...) are only used when the `configlspd`
> table cannot be loaded.

### Run

```bash
npm run dev    # development (nodemon)
npm start      # production
```

- Main entry: `http://localhost:3001/connect.html`
- Trello board: `http://localhost:3001/trello/`

For production, set `DATABASE_URL` for persistence and run behind an HTTPS reverse proxy (with `HTTPS=true`). A process manager such as PM2 is recommended.

## 📡 API overview (non-exhaustive)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/user` | Session user info (id, roles, grade) |
| GET | `/api/agent-profile/:userId` | Get or create an agent profile |
| PUT | `/api/agent-profile/:userId` | Update a profile (weapons, vehicles, ...) |
| POST | `/api/agent-profile/:id/edit-mode` | Acquire the edit lock |
| DELETE | `/api/agent-profile/:id/edit-mode` | Release the edit lock |
| GET | `/api/agent-formations/:userId` | Training derived from roles |
| GET | `/api/agent-grade/:userId` | Highest grade |
| POST | `/forms/recruitment` | Public recruitment submission |

> Browse the `routes/` folder for the full map.

## 🖥️ Main frontend pages

| File | Purpose |
|------|---------|
| `connect.html` | Login / OAuth2 entry |
| `dashboard.html` | Main dashboard (stats, navigation) |
| `infos-agent.html` | Agent profile (inline equipment editing) |
| `admin*.html` | Administration interfaces (grades, time clock, sanctions, ...) |
| `trello/index.html` | Real-time collaborative board |

## 🛡️ Security notes

- Auth is enforced on nearly every route (global middleware + `checkAuth`).
- The required role is configurable from the DB, avoiding hardcoded permissions.
- JSON fields (weapons / vehicles) are always parsed with `try/catch`.
- Secrets live only in `.env` (git-ignored) — never commit them.
- In production, enable `secure` + `sameSite: 'none'` cookies behind HTTPS.

## 🤝 Contributing

1. Fork and create a feature branch.
2. Follow the existing style (CommonJS, 2-space indent).
3. Test manually before committing.
4. Open a descriptive PR (add screenshots for UI changes).

## 📄 License

MIT — see [LICENSE.md](LICENSE.md).

## 👥 Authors

**Medouille** (`medouille_`) · **Porka** (`porka.`)

For support, reach out to the authors on Discord.
