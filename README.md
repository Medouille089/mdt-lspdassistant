# 🚓 LSPD Assistant

Plateforme tout-en-un (Site Web + Bot Discord + Board temps réel) pour la gestion opérationnelle et administrative d'un service de police RP (LSPD). 

Permet la centralisation des profils agents, rapports, convocations, sanctions, présences, absences, cartes d'équipement, et un tableau de bord collaboratif de type Trello en temps réel.

</div>

## ✨ Principales fonctionnalités

| Domaine | Fonctions clés |
|---------|----------------|
| Authentification | Login via Discord OAuth2 + Session sécurisée (Express Session + Passport) |
| Profils Agents | Création auto, photo, matricule, armes, véhicules, grade dynamique basé sur les rôles Discord |
| Grades & Formations | Mapping dynamique depuis la base (tables `lspd_grades`, `lspd_formations`) vers les rôles Discord |
| Convocations / Tickets | Gestion, archivage, consultation |
| Sanctions / Infractions | Nettoyage automatique (script `cleanSanctions`) + consultation ciblée |
| Présence & Pointeuse | Suivi, rappels programmés (`rappelPointeuse`) |
| Absences | Déclaration et administration |
| Rapport Rookie | Suivi des nouveaux agents |
| Trello | Temps réel via Socket.IO + persistance PostgreSQL + fallback mémoire |
| PDF / Export | Génération (via `pdfkit` / `puppeteer` selon modules) |
| Intégration Discord | Rôles, avatars, webhooks, logs, récupération dynamique des membres |
| Sécurité | Vérification de rôle requis + SuperAdmin + support DOJ conditionnel |

## 🧱 Stack Technique

- **Runtime**: Node.js (CommonJS)
- **Serveur**: Express 5
- **Auth**: Passport + passport-discord
- **Temps réel**: Socket.IO
- **Base de données principale**: PostgreSQL (`pg`)
- **Programmation planifiée**: node-cron
- **Bot Discord**: discord.js v14
- **Génération PDF / Rendering**: pdfkit, puppeteer
- **Front**: HTML/CSS/JS vanilla (pages dans `LSPD/`), Trello module ES + scripts modulaires
- **Sessions**: express-session (cookie HTTPOnly)
- **Formats de date**: luxon + moment-timezone

## 🗂️ Structure du projet (vue partielle)

```
app.js                # Bootstrap serveur, Socket.IO, Trello, routes
dbSchema.js           # Fonctions pour normaliser / persister Trello (legacy / util)
routes/               # Routes REST (agents, arrestation, sanctions, etc.)
config/               # Auth, bot, env, grades, setup, DB pool
utils/                # Tâches périodiques & helpers (cleanSanctions, rappelPointeuse...)
LSPD/                 # Frontend (HTML/CSS/JS) + Trello board
	trello/             # Board temps réel (index.html + scripts)
	scripts/            # Scripts spécifiques (infosagent.js, dashboard.js ...)
	styles/             # Feuilles de style
commands/             # Commandes Discord (si invoquées via bot)
```

## 🔐 Authentification & Rôles

1. OAuth2 Discord via Passport → création de session.
2. Middleware global (dans `app.js`) bloque tout sauf pages publiques & assets.
3. `checkAuth` (et variantes DOJ) vérifie rôle requis (depuis table `configlspd`) ou super admin.
4. Grade calculé côté route `/api/agent-grade/:userId` en scannant les rôles.

## 🧬 Modèle de données (extraits principaux)

### Base LSPD (exemples de tables utilisées)
- `configlspd`: configuration dynamique (role requis, logs, ids spéciaux).
- `lspd_grades`: mapping roles → grade hiérarchique.
- `lspd_formations`: mapping roles → formations (unités spécialisées).
- `lspd_agent_profiles`: profils agents (photo_url, armes[], vehicules[], matricule, nom, prenom, is_editing...).
- `trello_*` tables: `trello_boards`, `trello_lists`, `trello_cards`, `trello_tags`, `trello_card_tags`.

### Profils agents
`armes` et `vehicules` sont stockés en JSON (string côté DB → parsé côté API). Création automatique si absent lors du premier GET.

## 🔄 Flux Trello temps réel

1. Client charge `/trello` → index + modules ES.
2. Connexion Socket.IO → envoi `boardSync` (état complet).
3. Chaque opération (ajout carte, tag, déplacement) produit un diff appliqué via `OperationsManager` + sauvegarde PostgreSQL (avec retry & fallback mémoire).
4. En absence de `DATABASE_URL`, mode mémoire (non persistant) logué au démarrage.

## ⚙️ Installation & Démarrage

### Prérequis
- Node.js 18+
- PostgreSQL (optionnel si juste test local sans persistance Trello)
- Une application Discord + un bot avec intents appropriés

### Installation
```bash
git clone https://github.com/Medouille089/lspdassistant.git
cd lspdassistant
npm install
cp .env.example .env   # (si tu crées un modèle)
```

### Variables d'environnement (`config/env.js` charge process.env)
| Nom | Description |
|-----|-------------|
| CLIENT_ID | ID OAuth2 Discord |
| CLIENT_SECRET | Secret OAuth2 |
| REDIRECT_URI | URL callback (ex: http://localhost:3001/callback) |
| GUILD_ID | ID du serveur Discord principal |
| TOKEN | Token du bot Discord |
| WEBHOOK_BRACELET | Webhook spécifique (bracelet / tracking) |
| SESSION_SECRET | Secret cryptage session Express |
| DISCORD_WEBHOOK_LOGS | Webhook logs système |
| DATABASE_URL | Chaîne connexion PostgreSQL (ssl activé) |
| PORT | Port HTTP (défaut 3001) |

### Lancer en dev
```bash
npm run dev
```
Accès principal: `http://localhost:3001/connect.html`  
Trello board: `http://localhost:3001/trello/`

### Lancer en production
```bash
npm start
```
Assure-toi d'avoir `DATABASE_URL` pour la persistance Trello.

## 📡 Endpoints API (aperçu non exhaustif)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /api/user | Infos utilisateur session (id, roles, grade) |
| GET | /api/agent-profile/:userId | Récupère ou crée profil agent |
| PUT | /api/agent-profile/:userId | Met à jour profil (armes, vehicules, etc.) |
| POST | /api/agent-profile/:id/edit-mode | Verrouillage édition |
| DELETE | /api/agent-profile/:id/edit-mode | Libère le verrou |
| GET | /api/agent-formations/:userId | Formations déduites des rôles |
| GET | /api/agent-grade/:userId | Grade le plus haut |
| (Autres) | arrestation / sanctions / absence / convocation | Domaines métiers spécifiques |

> Pour une cartographie complète, parcourir le dossier `routes/`.

## 🖥️ Pages Front principales

| Fichier | Rôle |
|---------|------|
| connect.html | Page d'entrée / login flow |
| dashboard.html | Vue synthèse (statistiques / navigation) |
| infos-agent.html | Profil agent (édition inline équipements) |
| admin*.html | Interfaces d'administration (grades, annonces, pointeuse, absences, sanctions) |
| trello/index.html | Board collaboratif temps réel |

## 🛡️ Sécurité & Bonnes pratiques
- Vérification d'auth sur quasi toutes les routes (middleware global + `checkAuth`).
- Rôle requis configurable depuis DB (table configlspd) pour éviter un hardcode.
- SuperAdmin bypass pour maintenance.
- Session HTTPOnly (penser à activer `secure: true` derrière HTTPS en prod).
- Parsing JSON sécurisé (try/catch) pour champs dynamiques (armes / véhicules).

## 🧪 Tests
Actuellement aucun test auto (script `npm test` placeholder). Recommandations:
- Ajouter Jest + supertest pour routes critiques.
- Tests unitaires sur `OperationsManager` pour intégrité des diffs.

## 🚀 Roadmap suggérée
- [ ] Ajouter fichier `.env.example` livré.
- [ ] Système de permissions granulaire par fonctionnalité.
- [ ] Cache Redis pour rôles Discord / profils fréquemment consultés.
- [ ] Interface d’édition Trello multi-boards.
- [ ] Export CSV des présences / sanctions.
- [ ] Refactor front en modules ou migration progressive vers un framework (Vue/React) sans casser l’existant.
- [ ] Tests automatisés + pipeline CI.

## 🤝 Contribution
1. Fork & branche de feature.
2. Respecter style existant (CommonJS, pas d'intro TypeScript sans consensus).
3. PR descriptive (ajouter captures si UI modifiée).

## 🧩 Dépannage rapide
| Problème | Cause fréquente | Solution |
|----------|-----------------|----------|
| 403 sur /api/... | Rôle requis absent | Vérifier table `configlspd` + rôles Discord |
| Board vide | Pas de `DATABASE_URL` ou schéma non créé | Vérifier logs démarrage /trello/debug |
| Grade toujours "Agent" | Rôles grade non configurés | Mettre à jour `lspd_grades` |
| Avatar manquant | Bot ne fetch pas le membre | Vérifier permissions intents & GUILD_ID |

## 📄 Licence
MIT – voir `LICENSE.md`.

## 👥 Auteurs
**Medouille**, **Porka**, **Trello by Hash** – contributions & maintenance.

---

Pour support: contacter `medouille_` ou `porka.` sur Discord.


