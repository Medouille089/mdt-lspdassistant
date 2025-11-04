const express = require("express");
const router = express.Router();
const { checkAuth } = require("../config/middleware");
const pool = require("../config/db");
const bot = require("../config/bot");
const { GUILD_ID } = require("../config/env");
const { getConfig } = require("../config/config");
const { EmbedBuilder } = require("discord.js");

// Fonction utilitaire pour fetch un channel avec gestion d'erreur
async function safeFetchChannel(bot, channelId) {
  try {
    return await bot.channels.fetch(channelId);
  } catch (err) {
    console.error(`Impossible de récupérer le salon ${channelId}:`, err.message);
    return null;
  }
}

// Middleware pour vérifier si l'utilisateur est super admin
async function checkSuperAdmin(req, res, next) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const conf = await getConfig();
    const SUPER_ADMIN_ROLE = conf.id_superadmin ? String(conf.id_superadmin).trim() : null;

    if (!SUPER_ADMIN_ROLE) {
      return res.status(500).json({ error: "Rôle super admin non configuré" });
    }

    const guild = await bot.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(req.user.id);
    const roleIds = member.roles.cache.map(role => role.id);

    if (!roleIds.includes(SUPER_ADMIN_ROLE)) {
      return res.status(403).json({ error: "Accès refusé. Seuls les super administrateurs peuvent accéder à cette page." });
    }

    next();
  } catch (error) {
    console.error("[Accounts] Erreur vérification super admin:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
}

// GET - Liste tous les comptes utilisateurs
router.get("/api/accounts", checkAuth, checkSuperAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        ua.id,
        ua.discord_id,
        ua.username,
        ua.email,
        ua.created_at,
        ua.updated_at,
        ua.last_login,
        ua.is_active,
        lap.photo_url
      FROM user_accounts ua
      LEFT JOIN lspd_agent_profiles lap ON ua.discord_id = lap.discord_id
      ORDER BY ua.created_at DESC
    `);

    // Enrichir avec les informations Discord (display name)
    const guild = await bot.guilds.fetch(GUILD_ID);
    
    for (const account of rows) {
      try {
        const member = await guild.members.fetch(account.discord_id).catch(() => null);
        if (member) {
          account.displayName = member.displayName || member.user.username;
        } else {
          account.displayName = account.username;
        }
      } catch (error) {
        // Si on ne peut pas récupérer le membre, on continue
        console.warn(`Impossible de récupérer les infos Discord pour ${account.discord_id}`);
        account.displayName = account.username;
      }
    }

    res.json(rows);
  } catch (error) {
    console.error("Erreur lors de la récupération des comptes:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des comptes" });
  }
});

// DELETE - Supprime un compte utilisateur
router.delete("/api/accounts/:id", checkAuth, checkSuperAdmin, async (req, res) => {
  const accountId = parseInt(req.params.id);

  if (isNaN(accountId)) {
    return res.status(400).json({ error: "ID de compte invalide" });
  }

  try {
    // Vérifier que le compte existe
    const { rows } = await pool.query(
      "SELECT discord_id, username FROM user_accounts WHERE id = $1",
      [accountId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Compte non trouvé" });
    }

    const account = rows[0];

    // Empêcher la suppression de son propre compte
    if (account.discord_id === req.user.id) {
      return res.status(403).json({ error: "Vous ne pouvez pas supprimer votre propre compte" });
    }

    // Récupérer les membres Discord pour les logs
    const guild = await bot.guilds.fetch(GUILD_ID);
    const actorMember = await guild.members.fetch(req.user.id).catch(() => null);
    const targetMember = await guild.members.fetch(account.discord_id).catch(() => null);

    // Supprimer le compte
    await pool.query("DELETE FROM user_accounts WHERE id = $1", [accountId]);


    // Envoi du log dans logs_config
    try {
      const conf = await getConfig();
      const logsChannel = await safeFetchChannel(bot, conf.logs_config);
      
      if (logsChannel) {
        const actorDisplayName = actorMember?.displayName || req.user.username;
        const targetDisplayName = targetMember?.displayName || account.username;

        // Construire l'URL de la photo de profil
        let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png'; // Avatar par défaut
        if (targetMember && targetMember.user.avatar) {
          avatarUrl = `https://cdn.discordapp.com/avatars/${account.discord_id}/${targetMember.user.avatar}.png?size=256`;
        }

        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle("⚠️ Suppression de compte")
          .setDescription(`${actorDisplayName} a supprimé le compte de ${targetDisplayName}`)
          .addFields({
            name: "Détails",
            value: `> **Username:** ${account.username}\n> **Photo de profil:** [Voir l'avatar](${avatarUrl})`,
            inline: false,
          })
          .addFields({
            name: "ID's",
            value: `> <@${req.user.id}> (\`${req.user.id}\`)\n> <@${account.discord_id}> (\`${account.discord_id}\`)`,
            inline: false,
          })
          .setFooter({
            text: "LSPD Assistant",
            iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 }),
          })
          .setTimestamp();

        await logsChannel.send({ embeds: [embed] });
      }
    } catch (logError) {
      console.error("Erreur lors de l'envoi du log de suppression:", logError);
      // Ne pas faire échouer la suppression si le log échoue
    }

    res.json({ 
      success: true, 
      message: "Compte supprimé avec succès",
      deletedAccount: {
        username: account.username,
        discord_id: account.discord_id
      }
    });
  } catch (error) {
    console.error("Erreur lors de la suppression du compte:", error);
    res.status(500).json({ error: "Erreur lors de la suppression du compte" });
  }
});

module.exports = router;
