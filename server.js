require("dotenv").config();
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const fetch = require("node-fetch");
const { Pool } = require("pg");
const cron = require("node-cron");
const axios = require("axios");
const { Client, GatewayIntentBits, ActivityType, EmbedBuilder } = require("discord.js");
const { threadId } = require("worker_threads");

const app = express();
const port = process.env.PORT || 3001;

// === Variables d'env ===
const {
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  GUILD_ID,
  REQUIRED_ROLE_ID,
  TOKEN,
  WEBHOOK_BRACELET,
  SESSION_SECRET,
  DISCORD_WEBHOOK_LOGS,
  DATABASE_URL,
  SUPERVISOR_ROLE_ID,
  THREAD_ID,
  ARCHIVE_TAG
} = process.env;

// === PostgreSQL pool ===
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// === Discord Bot setup ===
const bot = new Client({
  intents: [GatewayIntentBits.Guilds],
});

bot.once("ready", () => {
  console.log(`🤖 Bot connecté en tant que ${bot.user.tag}`);
  bot.user.setPresence({
    activities: [{ name: "Assister le LSPD", type: ActivityType.Playing }],
    status: "online",
  });
});

bot.login(TOKEN);

// === Sessions + Passport ===
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

app.use((req, res, next) => {
  const publicPaths = ['/login', '/callback', '/logout', '/bracelet'];

  // Autorise les requêtes internes (ex : create-post)
  if (req.headers['x-internal'] === 'true') return next();

  if (publicPaths.includes(req.path)) return next();

  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.redirect('/login');
  }

  next();
});

app.use(express.static(path.join(__dirname, "LSPD")));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(
  new DiscordStrategy(
    {
      clientID: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      callbackURL: REDIRECT_URI,
      scope: ["identify", "guilds", "guilds.members.read"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Utiliser le token bot pour récupérer le membre de la guilde
        const response = await fetch(
          `https://discord.com/api/guilds/${GUILD_ID}/members/${profile.id}`,
          {
            headers: {
              Authorization: `Bot ${TOKEN}`,
            },
          }
        );

        if (!response.ok) {
          console.error("❌ Erreur récupération membre :", await response.text());
          return done(null, profile);
        }

        const guildMember = await response.json();
        profile.guild_member = guildMember;

        return done(null, profile);
      } catch (err) {
        console.error("❌ Erreur stratégie Discord :", err);
        return done(err, null);
      }
    }
  )
);


// === Middleware auth ===
function checkAuth(req, res, next) {
  if (!req.isAuthenticated()) return res.redirect("/login");

  const member = req.user.guilds.find((g) => g.id === GUILD_ID);
  const hasRole = req.user.guild_member?.roles.includes(REQUIRED_ROLE_ID);

  if (!member || !hasRole) {
    return res.status(403).send(`
      <!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Accès refusé</title></head><body>
      <h1>⛔ Accès refusé</h1>
      <p>Désolé <strong>${req.user.username}</strong>, vous n’avez pas le rôle requis pour accéder à cette page.</p>
      <a href="/logout">Se déconnecter</a>
      </body></html>
    `);
  }

  next();
}

// === Logging connexion ===
async function sendLoginLog(userId, action) {
  const embed = {
    color: 0xff0000,
    title: "⚠️ Connexion utilisateur",
    description: `<@${userId}> ${action}`,
    timestamp: new Date().toISOString(),
    footer: {
      text: "LSPD Assistant",
      icon_url: "https://i.ibb.co/DDQWSHmZ/assistant.png"
    },
  };

  try {
    await fetch(DISCORD_WEBHOOK_LOGS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (err) {
    console.error("Erreur log connexion :", err);
  }
}

// === Routes auth ===
app.get("/login", passport.authenticate("discord"));

app.get('/callback', (req, res, next) => {
  if (!req.query.code) {
    return res.status(403).send('Accès interdit.');
  }
  next();
}, passport.authenticate('discord', { failureRedirect: '/' }),
  async (req, res) => {
    const hasRole = req.user.guild_member?.roles.includes(process.env.REQUIRED_ROLE_ID);
    const action = hasRole
      ? "s'est connecté(e) avec succès ✅"
      : "a tenté(e) de se connecter sans les rôles requis ❌";

    await sendLoginLog(req.user.id, action);

    res.redirect('/protected');
  }
);

app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/login");
  });
});

app.get('/api/user', checkAuth, async (req, res) => {
  const user = req.user;

  try {
    const guild = await bot.guilds.fetch(process.env.GUILD_ID);
    const member = await guild.members.fetch(user.id);
    const roleIds = member.roles.cache.map(role => role.id);

    const supervisorRoleIdTrimmed = SUPERVISOR_ROLE_ID.trim();
    const isSupervisor = roleIds.includes(supervisorRoleIdTrimmed);

    res.set('Cache-Control', 'no-store');

    res.json({
      id: user.id,
      username: member.displayName || user.username,
      avatar: user.avatar,
      discriminator: user.discriminator,
      roles: roleIds,
      isSupervisor,
    });

  } catch (err) {
    console.error('Erreur fetch member:', err);
    res.status(500).json({ error: 'Impossible de récupérer le membre.' });
  }
});

// === Routes protégées bracelets + historique ===
app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/protected", checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "LSPD", "dashboard.html"));
});

app.get('/api/webhook-url', (req, res) => {
  res.json({ webhook: process.env.WEBHOOK_BRACELET });
});

// Route POST – Enregistrement d’un nouveau bracelet
app.post('/api/formulaire', checkAuth, async (req, res) => {
  const { nom, prenom, tel, motif, dateDebut } = req.body;
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: "Utilisateur non connecté" });
  }

  console.log('Données reçues:', { nom, prenom, tel, motif, dateDebut });

  try {
    // Log récupération IDs
    const { rows: rows1 } = await pool.query("SELECT id_brac FROM bracelets");
    const { rows: rows2 } = await pool.query("SELECT id_brac FROM historiqueBracelets");

    console.log('IDs existants bracelets:', rows1.length, 'historique:', rows2.length);

    // Génération ID unique
    const allIds = [...rows1, ...rows2]
      .map(r => parseInt(r.id_brac.replace("BRAC", "")))
      .filter(n => !isNaN(n));
    const nextNum = (Math.max(0, ...allIds) + 1).toString().padStart(4, '0');
    const id_brac = `BRAC${nextNum}`;

    console.log('ID généré:', id_brac);

    // Insertion dans bracelets
    await pool.query(`
      INSERT INTO bracelets (nom, prenom, tel, date_debut, id_brac, motif)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [nom, prenom, tel, dateDebut, id_brac, motif]);

    console.log('Insertion en base OK');

    // Appel interne POST /api/create-post
    const response = await fetch(`http://localhost:${port}/api/create-post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal": "true"
      },
      body: JSON.stringify({ id_brac, nom, prenom, tel, motif, dateDebut })
    });


    console.log('Réponse POST create-post:', response.status);

    const data = await response.json();

    if (response.ok && data.threadId) {
      await pool.query(
        'UPDATE bracelets SET id_thread = $1 WHERE id_brac = $2',
        [data.threadId, id_brac]
      );
      console.log('Mise à jour thread ID OK');

      var threadId = data.threadId;
    }
    const mentionThread = threadId ? `<#${threadId}>` : 'Thread inconnu';

    // Webhook logs
    if (process.env.DISCORD_WEBHOOK_LOGS) {
      const embedLog = {
        color: 0x0b1b5a,
        description: `<@${user.id}> a ajouté un nouveau bracelet - ${mentionThread} (${id_brac})`,
        timestamp: new Date().toISOString(),
        footer: {
          text: "LSPD Assistant",
          icon_url: "https://i.ibb.co/DDQWSHmZ/assistant.png"
        },
      };
      await fetch(process.env.DISCORD_WEBHOOK_LOGS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embedLog] }),
      });
      console.log('Webhook log envoyé');
    }

    res.status(201).json({ message: 'Bracelet enregistré', id_brac });
  } catch (err) {
    console.error("Erreur insertion :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


(express.json());
app.post('/api/create-post', async (req, res) => {
  console.log("POST /api/create-post reçu avec body:", req.body);
  const { id_brac, nom, prenom, tel, motif, dateDebut } = req.body;

  try {
    const formattedDateDebut = formatDate(dateDebut);
    const threadTitle = `${id_brac} - ${nom} ${prenom} - ${formattedDateDebut}`;

    const embedPayload = {
      embeds: [{
        title: "Nouveau bracelet",
        color: 0x0b1b5a,
        fields: [
          { name: "ID Bracelet", value: id_brac, inline: true },
          { name: "Nom", value: nom, inline: true },
          { name: "Prénom", value: prenom, inline: true },
          { name: "Motif", value: motif, inline: true },
          { name: "Téléphone", value: tel, inline: false },
          {
            name: "Date de création",
            value: `**${formattedDateDebut}**`,
            inline: false
          }
        ],
        footer: {
          text: "LSPD Assistant",
          icon_url: "https://i.ibb.co/DDQWSHmZ/assistant.png"
        },
        thumbnail: {
          url: "https://i.ibb.co/DDQWSHmZ/assistant.png"
        },
        timestamp: new Date().toISOString()
      }]
    };

    const thread = await createForumPost(bot, THREAD_ID, threadTitle, embedPayload);

    // ✅ Log de l'ID du salon/thread créé
    console.log(`🧵 Thread créé avec l'ID : ${thread.id}`);

    res.json({ message: `✅ Post créé : ${thread.name}`, threadId: thread.id });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '❌ Erreur lors de la création du post.' });
  }
});

async function createForumPost(client, channelId, title, embed) {
  const channel = await client.channels.fetch(channelId);
  if (!channel || channel.type !== 15) {
    throw new Error("Le canal n'est pas un forum channel !");
  }

  const thread = await channel.threads.create({
    name: title,
    message: {
      embeds: embed.embeds
    }
  });

  return thread;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const d = ('0' + date.getDate()).slice(-2);
  const m = ('0' + (date.getMonth() + 1)).slice(-2);
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

// Route GET – Récupère tous les bracelets actifs
app.get('/api/formulaires', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, id_brac, nom, prenom, tel, date_debut, motif FROM bracelets ORDER BY id DESC');
    res.json(result.rows.map(row => ({
      id: row.id,
      id_brac: row.id_brac,
      nom: row.nom,
      prenom: row.prenom,
      tel: row.tel,
      motif: row.motif,
      dateDebut: row.date_debut.toLocaleDateString('fr-CA'),
    })));
  } catch (err) {
    console.error('Erreur GET /api/formulaires:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route PUT – Met à jour un bracelet existant
app.put('/api/formulaires/:id', async (req, res) => {
  const id = req.params.id;
  const { nom, prenom, tel, dateDebut, motif } = req.body;

  try {
    // 1. Récupérer les données actuelles
    const { rows } = await pool.query(
      'SELECT id_thread, id_brac, nom AS old_nom, prenom AS old_prenom, date_debut AS old_date_debut FROM bracelets WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Bracelet non trouvé' });
    }

    const { id_thread: threadId, id_brac, old_nom, old_prenom, old_date_debut } = rows[0];

    // 2. Mettre à jour le bracelet
    await pool.query(
      'UPDATE bracelets SET nom=$1, prenom=$2, tel=$3, date_debut=$4, motif=$5 WHERE id=$6',
      [nom, prenom, tel, dateDebut, motif, id]
    );

    // Fonction pour formater une date en JJ/MM/AAAA
    function formatDateFR(dateStr) {
      if (!dateStr) return '—';
      const date = new Date(dateStr);
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yyyy = date.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }

    const dateDebutFormatted = formatDateFR(dateDebut);
    const oldDateFormatted = formatDateFR(old_date_debut);

    // 3. Mettre à jour le thread s'il existe et que threadId est valide
    if (threadId) {
      const thread = await bot.channels.fetch(threadId);
      if (thread && thread.isThread()) {

        // 🔍 Vérifier s’il faut renommer le thread
        const shouldRename = (
          nom !== old_nom ||
          prenom !== old_prenom ||
          dateDebutFormatted !== oldDateFormatted
        );

        if (shouldRename) {
          const newThreadName = `${id_brac} - ${nom} ${prenom} - ${dateDebutFormatted}`;
          await thread.setName(newThreadName);
          console.log(`🔄 Thread renommé : ${newThreadName}`);
        }

        // ✅ Envoyer l'embed de modification
        const embed = new EmbedBuilder()
          .setTitle(`Bracelet modifié`)
          .setDescription(`Le bracelet \`${id_brac}\` a été mis à jour.`)
          .addFields(
            { name: 'Nom', value: nom || '—', inline: true },
            { name: 'Prénom', value: prenom || '—', inline: true },
            { name: 'Date de création', value: dateDebutFormatted, inline: true },
            { name: 'Motif', value: motif || '—', inline: false },
            { name: 'Téléphone', value: tel || '—', inline: true }
          )
          .setColor(0x0b1b5a)
          .setFooter({
            text: "LSPD Assistant",
            iconURL: "https://i.ibb.co/DDQWSHmZ/assistant.png"
          })
          .setTimestamp();

        await thread.send({ embeds: [embed] });
      } else {
        console.warn(`Thread ${threadId} introuvable ou non valide.`);
      }
    } else {
      console.warn(`Pas de threadId pour le bracelet ${id_brac}`);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Erreur PUT /api/formulaires/:id:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// Route DELETE – Supprime un bracelet actif et le transfère dans l'historique
app.delete('/api/formulaires/:id', async (req, res) => {
  const id = req.params.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query("SELECT * FROM bracelets WHERE id = $1", [id]);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Non trouvé' });
    }

    const data = rows[0];

    // Insérer dans historique
    await client.query(`
      INSERT INTO historiqueBracelets (nom, prenom, tel, date_debut, id_brac, motif, id_thread)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [data.nom, data.prenom, data.tel, data.date_debut, data.id_brac, data.motif, data.id_thread]);

    // Supprimer de bracelets
    await client.query("DELETE FROM bracelets WHERE id = $1", [id]);

    // Commit avant de faire appels Discord pour éviter deadlock si problème Discord
    await client.query('COMMIT');

    // Si thread Discord existe, on ajoute le tag et envoie un embed
    if (data.id_thread && ARCHIVE_TAG) {
      try {
        const thread = await bot.channels.fetch(data.id_thread);
        if (thread && thread.isThread()) {
          // Ajouter le tag archive
          await thread.setAppliedTags([ARCHIVE_TAG]);

          // Envoyer embed
          const embed = new EmbedBuilder()
            .setTitle('Bracelet archivé')
            .setDescription(`Le bracelet \`${data.id_brac}\` a été archivé.`)
            .addFields(
              { name: 'Nom', value: data.nom || '—', inline: true },
              { name: 'Prénom', value: data.prenom || '—', inline: true },
              { name: 'Téléphone', value: data.tel || '—', inline: true },
              { name: 'Date de création', value: data.date_debut ? new Date(data.date_debut).toLocaleDateString('fr-FR') : '—', inline: true },
              { name: 'Motif', value: data.motif || '—', inline: false }
            )
            .setColor(0xff0000) // rouge pour archivage
            .setFooter({
              text: "LSPD Assistant",
              iconURL: "https://i.ibb.co/DDQWSHmZ/assistant.png"
            })
            .setTimestamp();

          await thread.send({ embeds: [embed] });
        } else {
          console.warn(`Thread ${data.id_thread} introuvable ou non valide.`);
        }
      } catch (discordErr) {
        console.error('Erreur Discord lors archivage:', discordErr);
      }
    } else {
      if (!data.id_thread) console.warn('Pas de threadId pour ce bracelet.');
      if (!ARCHIVE_TAG) console.warn('ARCHIVE_TAG non défini dans .env');
    }

    res.json({ message: 'Transféré dans l’historique et archivé' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur suppression:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  } finally {
    client.release();
  }
});

// Route GET – Récupère tout l’historique des bracelets archivés
app.get('/api/historique', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM historiqueBracelets ORDER BY id DESC');
    const data = result.rows.map(row => ({
      id: row.id,
      nom: row.nom,
      prenom: row.prenom,
      tel: row.tel,
      motif: row.motif,
      dateDebut: new Date(row.date_debut).toLocaleDateString('fr-CA'),
      id_brac: row.id_brac
    }));
    res.json(data);
  } catch (err) {
    console.error("Erreur chargement historique :", err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route GET – Génère le prochain ID BRAC à afficher
app.get('/api/next-id-brac', async (req, res) => {
  try {
    const { rows: histo } = await pool.query(`SELECT id_brac FROM historiqueBracelets ORDER BY id_brac DESC LIMIT 1`);
    const { rows: actifs } = await pool.query(`SELECT id_brac FROM bracelets ORDER BY id_brac DESC LIMIT 1`);

    const lastId = [...histo, ...actifs]
      .map(r => parseInt(r.id_brac.replace('BRAC', '')))
      .sort((a, b) => b - a)[0] || 0;

    const nextId = lastId + 1;
    const formattedId = 'BRAC' + nextId.toString().padStart(4, '0');
    res.json({ id_brac: formattedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur génération ID' });
  }
});

// Fonction d’envoi d’un message Discord via un webhook lors d’un archivage
async function envoyerWebhookArchivage(nombre, ids) {
  if (!webhookBracelets) return;

  const message = {
    embeds: [
      {
        title: "📦 Archivage automatique de bracelets",
        description: `**${nombre} bracelet(s)** ont été archivés.`,
        color: 0x0b1b5a,
        fields: [
          {
            name: "Identifiants archivés",
            value: ids.length ? ids.join(", ") : "Aucun",
          },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: "LSPD Assistant" },
      },
    ],
  };

  try {
    await axios.post(webhookBracelets, message);
    console.log(`[WEBHOOK] Envoyé avec succès`);
  } catch (err) {
    console.error("[WEBHOOK] Échec de l'envoi :", err.message);
  }
}

// === Serveur ===
app.listen(port, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${port}`);
});
