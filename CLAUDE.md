# CLAUDE.md - Guide Technique LSPD Assistant

Ce document fournit une vue d'ensemble complète du projet LSPD Assistant pour faciliter la compréhension et le développement par Claude Code.

## Vue d'ensemble du projet

**LSPD Assistant** est une plateforme tout-en-un pour la gestion opérationnelle et administrative d'un service de police roleplay (LSPD). Le projet combine :
- Un site web avec authentification Discord OAuth2
- Un bot Discord (discord.js v14)
- Un board collaboratif temps réel (type Trello) avec Socket.IO
- Une base de données PostgreSQL pour la persistance

**Domaine métier** : Gestion de profils agents, rapports, convocations, sanctions, présences, absences, équipements, et suivi opérationnel en temps réel.

## Architecture Technique

### Stack

- **Runtime** : Node.js (CommonJS, pas d'ES modules sauf frontend Trello)
- **Serveur** : Express 5
- **Authentification** : Passport + passport-discord (OAuth2)
- **Sessions** : express-session (MemoryStore ou pg-simple en option)
- **Base de données** : PostgreSQL (`pg` pool)
- **Temps réel** : Socket.IO pour le board Trello
- **Bot Discord** : discord.js v14
- **Planification** : node-cron (rappels, nettoyage auto)
- **Génération PDF** : pdfkit + puppeteer
- **Dates** : luxon + moment-timezone
- **Upload fichiers** : multer

### Point d'entrée

`app.js` est le point d'entrée principal qui :
1. Configure Express + Socket.IO
2. Charge les middlewares (sessions, body-parser, auth)
3. Configure les headers pour iframe (FiveM NUI)
4. Monte les routes depuis `/routes`
5. Initialise le bot Discord (`config/bot.js`)
6. Lance les scripts utilitaires (cleanSanctions, rappelPointeuse)
7. Initialise le module Trello temps réel
8. Démarre le serveur HTTP sur le port 3001 (par défaut)

### Gestion des erreurs globales

Des handlers `process.on('unhandledRejection')` et `process.on('uncaughtException')` sont en place pour éviter les crashs silencieux. Les erreurs sont loggées mais l'app continue.

## Structure des dossiers

```
lspdassistant/
├── app.js                  # Point d'entrée, configuration serveur
├── package.json            # Dépendances npm
├── .env                    # Variables d'environnement (NON commité)
├── README.md              # Documentation utilisateur
├── CHANGELOG.md           # Historique des versions
├── LICENSE.md             # Licence MIT
│
├── config/                # Configuration centrale
│   ├── env.js            # Chargement variables d'environnement
│   ├── db.js             # Pool PostgreSQL
│   ├── bot.js            # Initialisation bot Discord
│   ├── passport.js       # Stratégies OAuth2 Discord
│   ├── grades.js         # Mapping rôles Discord → grades
│   ├── middleware.js     # Middleware checkAuth, checkRole, etc.
│   ├── cache.js          # Système de cache en mémoire
│   ├── cacheMiddleware.js # Middleware de cache HTTP
│   ├── sessionStore.js   # Helper pour gérer les sessions
│   └── setup*.js         # Scripts de configuration initiale
│
├── routes/               # Routes Express (API REST)
│   ├── auth.js          # OAuth2 callback + logout
│   ├── agents.js        # Profils agents
│   ├── arrestation.js   # Système d'arrestations
│   ├── sanctions.js     # Gestion sanctions
│   ├── absence.js       # Déclaration d'absences
│   ├── convocation.js   # Convocations / tickets
│   ├── avisRecherche.js # Avis de recherche (wanted/missing)
│   ├── pointeuse.js     # Système de pointeuse
│   ├── bracelet.js      # Suivi rookie patrol (patrouilles rookies)
│   ├── calendar.js      # Calendrier événements
│   └── ... (15+ fichiers de routes métier)
│
├── middleware/           # Middlewares custom supplémentaires
│   └── (middlewares spécifiques si besoin)
│
├── utils/                # Utilitaires et scripts périodiques
│   ├── cleanSanctions.js      # Nettoyage auto sanctions expirées
│   ├── rappelPointeuse.js     # Rappels pointeuse (cron)
│   ├── liveUsersCleaner.js    # Nettoyage utilisateurs en ligne
│   └── ... (autres helpers)
│
├── LSPD/                 # Frontend (HTML/CSS/JS vanilla)
│   ├── connect.html      # Page de connexion
│   ├── dashboard.html    # Tableau de bord principal
│   ├── infos-agent.html  # Profil agent
│   ├── admin*.html       # Pages d'administration
│   ├── trello/           # Board collaboratif temps réel
│   │   ├── index.html    # UI du board
│   │   ├── config/       # Config backend Trello (trelloServer.js)
│   │   ├── managers/     # Gestion logique métier (OperationsManager, etc.)
│   │   ├── scripts/      # Scripts frontend modulaires (ES modules)
│   │   └── styles/       # CSS du board
│   ├── scripts/          # Scripts frontend (infosagent.js, dashboard.js...)
│   ├── styles/           # CSS globaux
│   └── data/images/      # Assets images (badges, logos...)
│
├── migrations/           # Scripts de migration DB (schéma, données)
│   └── ... (fichiers SQL ou JS de migration)
│
├── commands/             # Commandes Discord du bot
│   └── ... (fichiers de commandes slash)
│
├── discordUtils/         # Utilitaires Discord (webhooks, embeds...)
│   └── ... (helpers Discord)
│
├── scripts/              # Scripts CLI ou maintenance
│   └── ... (scripts utilitaires)
│
└── docs/                 # Documentation supplémentaire
    └── ... (guides, specs...)
```

## Système d'authentification et d'autorisation

### Flux d'authentification

1. **Login** : L'utilisateur clique sur "Se connecter avec Discord" (`/connect.html`)
2. **OAuth2** : Redirection vers Discord → callback `/auth/discord/callback` (route dans `routes/auth.js`)
3. **Passport** : Passport vérifie le code OAuth2, récupère le profil Discord
4. **Session** : Une session Express est créée, contenant `req.user` (id, username, discriminator, avatar, guilds)
5. **Profil agent** : Lors du premier accès, un profil agent est créé automatiquement dans la table `lspd_agent_profiles`

### Middleware d'authentification

Défini dans `config/middleware.js` :

- **`checkAuth`** : Vérifie que l'utilisateur est authentifié et possède le rôle requis (depuis table `configlspd.role_requis`)
- **`checkAuthDOJ`** : Vérifie l'accès pour les fonctionnalités DOJ (Department of Justice)
- **`isSuperAdmin`** : Vérifie si l'utilisateur a le rôle SuperAdmin (bypass toutes les restrictions)

**Protection globale** : Dans `app.js`, un middleware bloque tous les endpoints sauf `/auth/*`, `/connect.html`, et les assets statiques si l'utilisateur n'est pas authentifié.

### Système de rôles

Les rôles Discord sont mappés vers :
- **Grades** : Table `lspd_grades` (ordre hiérarchique, icône, couleur)
- **Formations** : Table `lspd_formations` (unités spécialisées comme SWAT, K9, Traffic, etc.)

Le grade d'un agent est calculé dynamiquement en récupérant tous ses rôles Discord et en sélectionnant celui avec l'ordre le plus élevé.

Endpoint : `GET /api/agent-grade/:userId` (dans `routes/agents.js`)

### Configuration dynamique

Table `configlspd` :
- `role_requis` : ID du rôle Discord minimum requis pour accéder à l'app
- `super_admin_role_id` : ID du rôle SuperAdmin
- Autres configs (webhooks, logs, IDs spéciaux...)

Cela permet de modifier les permissions sans toucher au code.

## Base de données PostgreSQL

### Configuration

- **Pool** : Défini dans `config/db.js`
- **Connection string** : `DATABASE_URL` (env var)
- **SSL** : Activé par défaut (`rejectUnauthorized: false` pour compatibilité)

### Tables principales

#### Configuration
- `configlspd` : Config globale (rôles, webhooks, IDs)

#### Agents
- `lspd_agent_profiles` : Profils agents (photo_url, armes[], vehicules[], matricule, nom, prenom, is_editing, edited_by, edited_at)
- `lspd_grades` : Mapping rôles → grades
- `lspd_formations` : Mapping rôles → formations

#### Gestion opérationnelle
- `convocations` : Convocations / tickets
- `sanctions` : Sanctions disciplinaires (avec expiration auto)
- `absences` : Déclarations d'absence
- `presences` : Logs de présence (pointeuse)
- `overtimes` : Heures supplémentaires
- `accounts` : Comptes utilisateurs (authentification)

#### Système Trello
- `trello_boards` : Boards Trello
- `trello_lists` : Listes (colonnes)
- `trello_cards` : Cartes (tâches)
- `trello_tags` : Tags disponibles
- `trello_card_tags` : Association cartes ↔ tags

#### Avis de recherche
- `avis_recherche` : Avis de recherche (wanted / missing persons)
- `avis_recherche_versions` : Historique des versions

#### Rookie patrol
- `rookie_patrol` : Suivi des patrouilles des rookies
- `rookie_patrol_versions` : Historique des versions

### Champs JSON

Certains champs sont stockés en JSON string (parsés côté API) :
- `armes` (array d'objets : `{nom, numero_serie}`)
- `vehicules` (array d'objets : `{modele, plaque}`)

**Important** : Toujours utiliser `JSON.parse()` avec try/catch pour éviter les crashs sur données corrompues.

## Routes principales (API REST)

Toutes les routes sont dans `/routes` et montées dans `app.js`.

### Routes d'authentification (`routes/auth.js`)

- `GET /auth/discord` : Initie le flow OAuth2
- `GET /auth/discord/callback` : Callback OAuth2, crée la session
- `GET /logout` : Détruit la session

### Routes agents (`routes/agents.js`)

- `GET /api/user` : Infos utilisateur session (id, roles, grade)
- `GET /api/agent-profile/:userId` : Récupère ou crée profil agent
- `PUT /api/agent-profile/:userId` : Met à jour profil (armes, véhicules, etc.)
- `POST /api/agent-profile/:id/edit-mode` : Verrouillage édition (évite conflits)
- `DELETE /api/agent-profile/:id/edit-mode` : Libère le verrou
- `GET /api/agent-formations/:userId` : Formations déduites des rôles
- `GET /api/agent-grade/:userId` : Grade le plus haut

### Routes métier (exemples)

- **Arrestations** (`routes/arrestation.js`) : CRUD arrestations
- **Sanctions** (`routes/sanctions.js`) : CRUD sanctions disciplinaires
- **Absences** (`routes/absence.js`) : Déclaration et gestion absences
- **Convocations** (`routes/convocation.js`) : Tickets / convocations
- **Avis de recherche** (`routes/avisRecherche.js`) : Wanted / missing persons avec versioning
- **Bracelet** (`routes/bracelet.js`) : Suivi rookie patrol avec versioning
- **Pointeuse** (`routes/pointeuse.js`) : Check-in/out, logs de présence
- **Calendrier** (`routes/calendar.js`) : Événements planifiés

Chaque route utilise `checkAuth` ou `checkAuthDOJ` pour sécuriser l'accès.

## Frontend (LSPD/)

Le frontend est principalement en **HTML/CSS/JS vanilla**, avec quelques modules ES pour le board Trello.

### Pages principales

| Fichier | Description |
|---------|-------------|
| `connect.html` | Page de connexion (OAuth2) |
| `dashboard.html` | Tableau de bord principal (stats, navigation) |
| `infos-agent.html` | Profil agent (édition équipements inline) |
| `admin*.html` | Interfaces d'administration (grades, pointeuse, sanctions...) |
| `trello/index.html` | Board collaboratif temps réel |

### Scripts frontend

- **Modulaires** : Dans `LSPD/scripts/`, chaque page a son script (ex : `infosagent.js`, `dashboard.js`)
- **Fetch API** : Communication avec le backend via `fetch()`
- **Gestion d'état** : En mémoire locale (variables JS), pas de framework frontend

### Styling

CSS dans `LSPD/styles/` :
- Styles globaux + spécifiques par page
- Thème bleu police (couleurs primaires LSPD)
- Design responsive (mobile-friendly pour certaines pages)

## Système Trello temps réel

Le board collaboratif est une feature complexe avec architecture dédiée.

### Architecture

```
LSPD/trello/
├── index.html               # UI du board
├── config/
│   └── trelloServer.js      # Backend Socket.IO + persistance DB
├── managers/
│   ├── OperationsManager.js # Gestion des opérations (diff/patch)
│   ├── BoardManager.js      # Logique métier board
│   └── ...
├── scripts/                 # Frontend ES modules
│   ├── board.js             # Logique UI board
│   ├── socket.js            # Connexion Socket.IO
│   └── ...
└── styles/
    └── board.css            # Styles du board
```

### Flux temps réel

1. **Client** charge `/trello/index.html` → modules ES
2. **Connexion Socket.IO** → serveur envoie `boardSync` (état complet du board)
3. **Opérations** : Ajout carte, déplacement, tags, etc. → émises via socket
4. **OperationsManager** : Applique les diffs (opérations) à l'état en mémoire
5. **Persistance PostgreSQL** : Chaque opération est sauvegardée en DB (avec retry)
6. **Broadcast** : Changements diffusés à tous les clients connectés

### Fallback mémoire

Si `DATABASE_URL` est absent, le board fonctionne en mode **mémoire pure** (non persistant). Les données sont perdues au redémarrage.

Logs au démarrage indiquent le mode (DB ou mémoire).

### Gestion des conflits

Le système utilise des **verrous d'édition** (`is_editing`, `edited_by`, `edited_at`) pour éviter les éditions concurrentes. Si deux utilisateurs tentent d'éditer la même carte, le dernier est bloqué.

## Scripts utilitaires (utils/)

### cleanSanctions.js

**Rôle** : Nettoie automatiquement les sanctions expirées.

**Cron** : Tous les jours à minuit (configurable via `node-cron`).

**Logique** :
1. Récupère toutes les sanctions avec `date_fin < NOW()`
2. Les supprime de la table `sanctions`
3. Log les suppressions

### rappelPointeuse.js

**Rôle** : Envoie des rappels Discord pour inciter les agents à pointer.

**Cron** : Configurable (ex : tous les jours à 8h et 20h).

**Logique** :
1. Identifie les agents qui n'ont pas pointé depuis X heures
2. Envoie un message privé Discord ou un webhook
3. Log les rappels envoyés

### liveUsersCleaner.js

**Rôle** : Nettoie les utilisateurs marqués "en ligne" mais déconnectés (timeout).

**Cron** : Toutes les 5 minutes.

**Logique** :
1. Récupère les utilisateurs avec `last_activity < NOW() - 15 minutes`
2. Les marque comme "hors ligne"

## Bot Discord (config/bot.js + commands/)

### Initialisation

Le bot est initialisé dans `config/bot.js` :
- Charge le token depuis `.env` (`TOKEN`)
- Configure les intents nécessaires (GUILDS, GUILD_MEMBERS, GUILD_PRESENCES...)
- Enregistre les commandes slash depuis `/commands`
- Gère les événements (ready, interactionCreate, guildMemberUpdate...)

### Intégration avec l'app

Le bot partage le même runtime que le serveur Express. Il peut :
- Accéder à la DB (pool PostgreSQL)
- Envoyer des webhooks (logs, notifications)
- Récupérer dynamiquement les rôles/avatars des membres
- Synchroniser les grades en temps réel

### Commandes slash (examples)

- `/profil` : Affiche le profil d'un agent
- `/sanction` : Ajoute une sanction
- `/convocation` : Crée une convocation
- ...

Les commandes sont dans `/commands` (un fichier par commande).

## Configuration (.env)

Variables d'environnement critiques :

```env
# OAuth2 Discord
CLIENT_ID=<id_application_discord>
CLIENT_SECRET=<secret_oauth2>
REDIRECT_URI=http://localhost:3001/auth/discord/callback

# Bot Discord
TOKEN=<token_bot_discord>
GUILD_ID=<id_serveur_discord>

# Base de données
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require

# Sessions
SESSION_SECRET=<secret_aleatoire_long>

# Webhooks
DISCORD_WEBHOOK_LOGS=<url_webhook_logs>
WEBHOOK_BRACELET=<url_webhook_bracelet>

# Environnement
PORT=3001
NODE_ENV=production  # ou development
IS_LOCAL=false       # true pour forcer HTTP (dev local)
HTTPS=true           # true pour forcer cookies secure
```

**Important** : Ne JAMAIS commiter `.env`. Utiliser `.env.example` comme template.

## Conventions de code

### Style

- **CommonJS** : `require()` / `module.exports` (pas d'ESM sauf frontend Trello)
- **Indentation** : 2 espaces
- **Quotes** : Double quotes `"` pour les strings
- **Semicolons** : Obligatoires
- **Naming** :
  - Variables/fonctions : `camelCase`
  - Constantes : `SCREAMING_SNAKE_CASE`
  - Fichiers : `kebab-case.js`

### Patterns communs

#### 1. Récupération dynamique des rôles Discord

```javascript
const guild = await bot.guilds.fetch(GUILD_ID);
const member = await guild.members.fetch(userId);
const roles = member.roles.cache.map(r => r.id);
```

#### 2. Calcul du grade

```javascript
const { rows } = await pool.query(
  'SELECT * FROM lspd_grades WHERE role_id = ANY($1) ORDER BY ordre DESC LIMIT 1',
  [roles]
);
const grade = rows[0] || { nom: 'Agent', ordre: 0 };
```

#### 3. Parsing JSON sécurisé

```javascript
let armes = [];
try {
  armes = JSON.parse(profile.armes || '[]');
} catch (e) {
  console.error('Erreur parsing armes:', e);
  armes = [];
}
```

#### 4. Middleware checkAuth

```javascript
const { checkAuth } = require('../config/middleware');

router.get('/api/protected', checkAuth, async (req, res) => {
  // req.user est disponible ici
  res.json({ userId: req.user.id });
});
```

#### 5. Logs avec webhooks Discord

```javascript
const { logToDiscord } = require('../discordUtils/webhooks');

await logToDiscord({
  title: 'Action effectuée',
  description: `L'agent ${agentName} a effectué X`,
  color: 0x00ff00,
  author: req.user.username
});
```

## Debugging et développement

### Lancer en dev

```bash
npm run dev  # nodemon app.js
```

Nodemon redémarre automatiquement le serveur à chaque changement.

### Logs

Les logs sont affichés dans la console :
- `[Session]` : Logs de sessions
- `[Trello]` : Logs du board temps réel
- `[DB]` : Logs de DB (connexion, erreurs)
- `[Bot]` : Logs du bot Discord
- `[Auth]` : Logs d'authentification

Les erreurs critiques sont envoyées au webhook Discord (`DISCORD_WEBHOOK_LOGS`).

### Debugger Node.js

```bash
node --inspect app.js
```

Puis connecter Chrome DevTools (`chrome://inspect`).

### Tester les routes

Utiliser **Postman** ou **curl** :

```bash
# Récupérer le profil d'un agent
curl -X GET http://localhost:3001/api/agent-profile/123456789 \
  -H "Cookie: connect.sid=<session_cookie>"
```

**Note** : Le cookie de session est requis pour les routes protégées.

## Points d'attention importants

### 1. Sécurité

- **Toujours utiliser `checkAuth`** sur les routes sensibles
- **Valider les inputs** (éviter SQL injection, XSS)
- **Parser JSON avec try/catch** pour éviter les crashs
- **Ne pas exposer les secrets** dans le code (utiliser `.env`)
- **Cookies secure** : Activer `secure: true` et `sameSite: 'none'` en production HTTPS

### 2. Performance

- **Cache** : Utiliser `config/cache.js` pour les données fréquemment consultées (rôles, grades)
- **Pools DB** : Ne jamais créer de nouvelles connexions à la volée, utiliser le pool global
- **Indexes DB** : Vérifier que les colonnes fréquemment requêtées ont des indexes

### 3. Gestion des erreurs

- **Toujours wrapper les queries DB** dans un try/catch
- **Logger les erreurs** avec `console.error()` ET webhook Discord si critique
- **Retourner des erreurs claires** au client (ex : `{ error: 'Message clair' }`)

### 4. Migrations DB

Les migrations sont dans `/migrations`. Pour appliquer une migration :

```bash
node migrations/001-add-column-xxx.js
```

**Convention** : Nommer les migrations avec un préfixe numérique (`001-`, `002-`, etc.) pour l'ordre d'exécution.

### 5. Tests

Actuellement, il n'y a **pas de tests automatisés**. Recommandations futures :
- **Jest** + **supertest** pour tester les routes
- **Tests unitaires** sur `OperationsManager` (logique Trello)
- **Tests d'intégration** sur le flow complet (OAuth2 → profil → opérations)

### 6. Déploiement

Pour déployer en production :

1. **Variables d'environnement** : Configurer `.env` avec les valeurs prod
2. **DATABASE_URL** : Pointer vers une DB PostgreSQL production
3. **HTTPS** : Activer `HTTPS=true` et configurer un reverse proxy (nginx/Caddy)
4. **PM2** : Utiliser PM2 pour gérer le process Node.js
   ```bash
   pm2 start app.js --name lspd-assistant
   pm2 save
   pm2 startup
   ```
5. **Logs** : Configurer PM2 pour persister les logs (`pm2 logs`)
6. **Monitoring** : Surveiller la RAM/CPU (`pm2 monit`)

### 7. Contribution

Lors de l'ajout de nouvelles features :

1. **Lire le code existant** pour comprendre les patterns
2. **Suivre les conventions** (naming, style, structure)
3. **Tester manuellement** avant de commit
4. **Commit messages** : Descriptifs (ex : `feat: add rookie patrol versioning`)
5. **Branches** : Créer une branche par feature (`git checkout -b feat/xxx`)
6. **Pull requests** : Décrire clairement les changements + ajouter captures si UI modifiée

## Roadmap et améliorations futures

- [ ] Système de permissions granulaire (ACL par fonctionnalité)
- [ ] Cache Redis pour les rôles Discord / profils agents
- [ ] Interface d'édition multi-boards Trello
- [ ] Export CSV des présences / sanctions
- [ ] Tests automatisés (Jest + supertest)
- [ ] Refactor frontend en Vue/React (progressif, sans casser l'existant)
- [ ] Pipeline CI/CD (GitHub Actions)
- [ ] Monitoring APM (Sentry, Datadog...)
- [ ] Système de notifications push (Service Worker)
- [ ] Mode hors-ligne (PWA)

## Ressources utiles

- **Documentation PostgreSQL** : https://www.postgresql.org/docs/
- **Documentation Express** : https://expressjs.com/
- **Documentation Socket.IO** : https://socket.io/docs/
- **Documentation discord.js** : https://discord.js.org/
- **Documentation Passport** : http://www.passportjs.org/

## Support

Pour toute question ou problème :
- **Auteurs** : Medouille (`medouille_`), Porka (`porka.`)
- **Discord** : Contacter les auteurs via Discord
- **Issues** : https://github.com/Medouille089/lspdassistant/issues

---

**Dernière mise à jour** : 2026-01-09
**Version** : 1.23.0
