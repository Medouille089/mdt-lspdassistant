const express = require("express");
const router = express.Router();
const { checkAuth } = require("../config/middleware");
const pool = require("../config/db");
const bot = require("../config/bot");
const { GUILD_ID } = require("../config/env");
const { getConfig } = require("../config/config");

// Middleware pour vérifier si l'utilisateur est super admin
async function checkSuperAdmin(req, res, next) {
  try {
    if (!req.isAuthenticated()) {
      console.log("[Accounts] Utilisateur non authentifié");
      return res.status(401).json({ error: "Non authentifié" });
    }

    const conf = await getConfig();
    const SUPER_ADMIN_ROLE = conf.id_superadmin ? String(conf.id_superadmin).trim() : null;

    if (!SUPER_ADMIN_ROLE) {
      console.log("[Accounts] Rôle super admin non configuré dans la config");
      return res.status(500).json({ error: "Rôle super admin non configuré" });
    }

    const guild = await bot.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(req.user.id);
    const roleIds = member.roles.cache.map(role => role.id);

    if (!roleIds.includes(SUPER_ADMIN_ROLE)) {
      console.log(`[Accounts] Accès refusé pour ${req.user.username} - Super admin requis`);
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
        id,
        discord_id,
        username,
        email,
        created_at,
        updated_at,
        last_login,
        is_active
      FROM user_accounts
      ORDER BY created_at DESC
    `);

    // Enrichir avec les avatars Discord
    const guild = await bot.guilds.fetch(GUILD_ID);
    
    for (const account of rows) {
      try {
        const member = await guild.members.fetch(account.discord_id).catch(() => null);
        if (member && member.user) {
          account.avatar = member.user.avatar;
        }
      } catch (error) {
        // Si on ne peut pas récupérer le membre, on continue
        console.warn(`Impossible de récupérer l'avatar pour ${account.discord_id}`);
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

    // Supprimer le compte
    await pool.query("DELETE FROM user_accounts WHERE id = $1", [accountId]);

    console.log(`Compte supprimé: ${account.username} (${account.discord_id}) par ${req.user.username} (${req.user.id})`);

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
