const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { checkAuth, checkAuthOrDOJ } = require("../config/middleware");
const bot = require("../config/bot");
const { GUILD_ID } = require("../config/env");
const { getConfig } = require("../config/config");
const pool = require('../config/db');
const { cache, CACHE_DURATIONS } = require('../config/cache');
const { cacheUser } = require('../config/cacheMiddleware');

router.get('/api/user', checkAuthOrDOJ, async (req, res) => {
  const user = req.user;

  try {
    const cacheKey = `user:${user.id}`;
    const cachedUser = cache.get(cacheKey);

    if (cachedUser) {
      return res.json(cachedUser);
    }

    const conf = await getConfig();
    const SUPER_ADMIN_ROLE = conf.id_superadmin ? String(conf.id_superadmin).trim() : null;

    const guild = await bot.guilds.fetch(GUILD_ID);
    guild.members.cache.delete(user.id);
    const member = await guild.members.fetch(user.id);
    const roleIds = member.roles.cache.map(role => role.id);

    const isSuperAdmin = SUPER_ADMIN_ROLE ? roleIds.includes(SUPER_ADMIN_ROLE) : false;

    // Si super-admin, on bypass et ne l’enregistre pas dans la BDD
    if (isSuperAdmin) {
      return res.json({
        id: user.id,
        username: member.displayName || user.username,
        avatar: user.avatar,
        discriminator: user.discriminator,
        roles: roleIds,
        isSupervisor: true,
        isCommandStaff: true,
        isSuperAdmin: true,
        grade: "Administrateur"
      });
    }

    // Vérifier si l'utilisateur est DOJ
    const isDOJ = req.user.isDOJ || false;
    if (isDOJ) {
      return res.json({
        id: user.id,
        username: member.displayName || user.username,
        avatar: user.avatar,
        discriminator: user.discriminator,
        roles: roleIds,
        isSupervisor: false,
        isCommandStaff: false,
        isSuperAdmin: false,
        isDOJ: true,
        grade: "DOJ"
      });
    }

    // Récupération des grades depuis la BDD
    const { rows } = await pool.query('SELECT * FROM lspd_grades LIMIT 1');
    const row = rows[0];
    const gradeList = [
      [row.rookie_role_id],
      [row.officier_1_role_id],
      [row.officier_2_role_id],
      [row.officier_3_role_id],
      [row.slo_role_id],
      [row.sergent_1_role_id],
      [row.sergent_2_role_id],
      [row.sergent_chef_role_id],
      [row.lieutenant_role_id],
      [row.lieutenant_chef_role_id],
      [row.capitaine_role_id],
      [row.commandant_role_id],
      [row.chief_role_id]
    ].filter(r => r[0]);

    let grade = "Agent";
    for (let i = gradeList.length - 1; i >= 0; i--) {
      const [roleId] = gradeList[i];
      if (roleIds.includes(roleId)) {
        const discordRole = guild.roles.cache.get(roleId);
        if (discordRole) {
          grade = discordRole.name;
          break;
        }
      }
    }

    // 💾 Insère uniquement si pas super-admin
    await pool.query(`
      INSERT INTO lspd_live_users (user_id, display_name, last_seen)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET display_name = $2, last_seen = NOW()
    `, [user.id, member.displayName || user.username]);

    const userData = {
      id: user.id,
      username: member.displayName || user.username,
      avatar: user.avatar,
      discriminator: user.discriminator,
      roles: roleIds,
      isSupervisor: user.isSupervisor,
      isCommandStaff: user.isCommandStaff,
      isSuperAdmin: user.isSuperAdmin,
      isDOJ: false,
      grade
    };

    cache.set(cacheKey, userData, CACHE_DURATIONS.USER_SESSION);

    res.set('Cache-Control', 'no-store');
    res.json(userData);

  } catch (err) {
    console.error('Erreur fetch member:', err);
    res.status(500).json({ error: 'Impossible de récupérer le membre.' });
  }
});

// ===== NOUVELLES ROUTES POUR L'AUTHENTIFICATION LOCALE =====

// Route pour récupérer les infos Discord (utilisé dans register.html)
router.get('/api/user/discord-info', (req, res) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  let displayName = req.user.username;
  if (req.user.guild_member && req.user.guild_member.nick) {
    displayName = req.user.guild_member.nick;
  } else if (req.user.displayName) {
    displayName = req.user.displayName;
  }
  res.json({
    discord_id: req.user.id,
    username: req.user.username,
    displayName,
    discriminator: req.user.discriminator,
    avatar: req.user.avatar
      ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`
      : null
  });
});

// Route pour créer un compte local après auth Discord
router.post('/register', async (req, res) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: 'Vous devez être authentifié via Discord pour créer un compte' });
  }

  const { username, email, password } = req.body;

  // Validation
  if (!username || !password) {
    return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
  }

  if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
    return res.status(400).json({ error: 'Nom d\'utilisateur invalide (3-30 caractères, lettres, chiffres, tirets et underscores)' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
  }

  try {
    // Vérifier si le compte Discord est déjà lié
    const existingAccount = await pool.query(
      'SELECT id FROM user_accounts WHERE discord_id = $1',
      [req.user.id]
    );

    if (existingAccount.rows.length > 0) {
      return res.status(400).json({ error: 'Ce compte Discord est déjà lié à un compte' });
    }

    // Vérifier si le nom d'utilisateur est déjà pris
    const existingUsername = await pool.query(
      'SELECT id FROM user_accounts WHERE username = $1',
      [username]
    );

    if (existingUsername.rows.length > 0) {
      return res.status(400).json({ error: 'Ce nom d\'utilisateur est déjà pris' });
    }

    // Hash du mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Créer le compte
    await pool.query(
      `INSERT INTO user_accounts (discord_id, username, password_hash, email, created_at, last_login)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [req.user.id, username, passwordHash, email || null]
    );

    // Log de création de compte
    const config = await getConfig();
    if (config.logs_channel) {
      try {
        const logsChannel = await bot.channels.fetch(config.logs_channel);
        if (logsChannel?.isTextBased()) {
          const { EmbedBuilder } = require('discord.js');
          const embed = new EmbedBuilder()
            .setTitle('✅ Nouveau compte créé')
            .setColor(0x00ff00)
            .setDescription(`Compte local créé pour <@${req.user.id}>`)
            .addFields(
              { name: 'Discord', value: `${req.user.username}#${req.user.discriminator}`, inline: true },
              { name: 'Username', value: username, inline: true },
              { name: 'Email', value: email || 'Non renseigné', inline: true }
            )
            .setTimestamp();

          await logsChannel.send({ embeds: [embed] });
        }
      } catch (err) {
        console.error('Erreur log création compte:', err);
      }
    }

    res.json({ success: true, message: 'Compte créé avec succès', redirect: '/protected' });
  } catch (error) {
    console.error('Erreur création compte:', error);
    res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }
});

// Route pour connexion locale
router.post('/login-local', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
  }

  try {
    // Récupérer le compte
    const result = await pool.query(
      'SELECT * FROM user_accounts WHERE username = $1 AND is_active = true',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }

    const account = result.rows[0];

    // Vérifier le mot de passe
    const isValid = await bcrypt.compare(password, account.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
    }

    // Mettre à jour la dernière connexion
    await pool.query(
      'UPDATE user_accounts SET last_login = NOW() WHERE id = $1',
      [account.id]
    );

    // Récupérer les infos Discord via l'API Discord
    const fetch = require('node-fetch');
    const { TOKEN } = require('../config/env');

    try {
      const response = await fetch(
        `https://discord.com/api/guilds/${GUILD_ID}/members/${account.discord_id}`,
        {
          headers: {
            Authorization: `Bot ${TOKEN}`,
          },
        }
      );

      if (!response.ok) {
        console.error('Erreur récupération membre Discord:', await response.text());
        return res.status(403).json({ error: 'Impossible de vérifier votre compte Discord. Vous n\'êtes peut-être plus membre du serveur.' });
      }

      const guildMember = await response.json();

      // Créer un objet user similaire à celui de Discord OAuth
      const user = {
        id: account.discord_id,
        username: account.username,
        discriminator: '0000', // Pas disponible via bot
        avatar: null,
        guild_member: guildMember
      };

      // Récupérer la config pour les rôles
      const config = await getConfig();
      const { required_role_id, logs_channel, commandstaff_id, supervisor_role_id, id_superadmin, doj_role_id } = config;

      const roleIds = guildMember.roles || [];

      // Vérifier les permissions
      const isSuperAdmin = id_superadmin ? roleIds.includes(id_superadmin.trim()) : false;
      const hasRequiredRole = isSuperAdmin ? true : roleIds.includes(required_role_id);
      const isDOJ = doj_role_id ? roleIds.includes(doj_role_id.trim()) : false;

      if (!hasRequiredRole && !isDOJ) {
        return res.status(403).json({ error: 'Vous n\'avez pas les permissions nécessaires pour accéder au site' });
      }

      // Configurer la session
      user.roles = roleIds;
      user.isCommandStaff = commandstaff_id ? roleIds.includes(commandstaff_id.trim()) : false;
      user.isSupervisor = supervisor_role_id ? roleIds.includes(supervisor_role_id.trim()) : false;
      user.isSuperAdmin = isSuperAdmin;
      user.isDOJ = isDOJ;

      // Authentifier l'utilisateur avec Passport
      req.login(user, (err) => {
        if (err) {
          console.error('Erreur login:', err);
          return res.status(500).json({ error: 'Erreur lors de la connexion' });
        }

        // Log de connexion
        if (logs_channel) {
          bot.channels.fetch(logs_channel).then(logsChannel => {
            if (logsChannel?.isTextBased()) {
              const { EmbedBuilder } = require('discord.js');
              const embed = new EmbedBuilder()
                .setTitle('🔐 Connexion locale')
                .setColor(0x0b1b5a)
                .setDescription(`<@${account.discord_id}> s'est connecté(e) via compte local`)
                .addFields(
                  { name: 'Username', value: username, inline: true },
                  { name: 'Discord ID', value: account.discord_id, inline: true }
                )
                .setTimestamp();

              logsChannel.send({ embeds: [embed] }).catch(console.error);
            }
          }).catch(console.error);
        }

        // Récupérer l'URL de redirection depuis la session
        const redirectTo = req.session.returnTo || '/protected';
        delete req.session.returnTo;

        res.json({ success: true, redirect: redirectTo });
      });

    } catch (error) {
      console.error('Erreur récupération Discord:', error);
      return res.status(500).json({ error: 'Erreur lors de la vérification de votre compte Discord' });
    }

  } catch (error) {
    console.error('Erreur login local:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// Route pour demander un reset de mot de passe
router.post('/forgot-password', async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Nom d\'utilisateur requis' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM user_accounts WHERE username = $1 AND is_active = true',
      [username]
    );

    // Pour des raisons de sécurité, on ne dit pas si le compte existe ou non
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Si ce compte existe, un lien de réinitialisation a été envoyé en message privé Discord.'
      });
    }

    const account = result.rows[0];

    // Générer un token de réinitialisation
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 heure

    // Stocker le token dans la BDD
    await pool.query(
      'UPDATE user_accounts SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, resetTokenExpires, account.id]
    );

    // Envoyer le lien via Discord DM
    try {
      const user = await bot.users.fetch(account.discord_id);
      const resetLink = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}`;

      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setTitle('🔐 Réinitialisation de mot de passe')
        .setColor(0x0b1b5a)
        .setDescription('Vous avez demandé à réinitialiser votre mot de passe pour LSPD Assistant.')
        .addFields(
          { name: 'Lien de réinitialisation', value: `[Cliquez ici pour réinitialiser](${resetLink})` },
          { name: '⏰ Validité', value: 'Ce lien est valide pendant 1 heure' }
        )
        .setFooter({ text: 'Si vous n\'avez pas demandé cette réinitialisation, ignorez ce message.' })
        .setTimestamp();

      await user.send({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur envoi DM:', error);
      // On ne révèle pas l'erreur pour des raisons de sécurité
    }

    res.json({
      success: true,
      message: 'Si ce compte existe, un lien de réinitialisation a été envoyé en message privé Discord.'
    });

  } catch (error) {
    console.error('Erreur forgot password:', error);
    res.status(500).json({ error: 'Erreur lors de la demande de réinitialisation' });
  }
});

// Route pour réinitialiser le mot de passe
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token et mot de passe requis' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
  }

  try {
    // Vérifier le token
    const result = await pool.query(
      'SELECT * FROM user_accounts WHERE reset_token = $1 AND reset_token_expires > NOW() AND is_active = true',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Lien de réinitialisation invalide ou expiré' });
    }

    const account = result.rows[0];

    // Hash du nouveau mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Mettre à jour le mot de passe et supprimer le token
    await pool.query(
      'UPDATE user_accounts SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = NOW() WHERE id = $2',
      [passwordHash, account.id]
    );

    // Log de réinitialisation
    const config = await getConfig();
    if (config.logs_channel) {
      try {
        const logsChannel = await bot.channels.fetch(config.logs_channel);
        if (logsChannel?.isTextBased()) {
          const { EmbedBuilder } = require('discord.js');
          const embed = new EmbedBuilder()
            .setTitle('🔑 Mot de passe réinitialisé')
            .setColor(0xffaa00)
            .setDescription(`<@${account.discord_id}> a réinitialisé son mot de passe`)
            .addFields(
              { name: 'Username', value: account.username, inline: true }
            )
            .setTimestamp();

          await logsChannel.send({ embeds: [embed] });
        }
      } catch (err) {
        console.error('Erreur log reset password:', err);
      }
    }

    res.json({ success: true, message: 'Mot de passe réinitialisé avec succès' });

  } catch (error) {
    console.error('Erreur reset password:', error);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe' });
  }
});

module.exports = router;
