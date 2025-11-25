const express = require("express");
const router = express.Router();
const { checkAuth } = require("../config/middleware");
const bot = require("../config/bot");
const { GUILD_ID } = require("../config/env");
const pool = require("../config/db");
const { cache, CACHE_DURATIONS } = require("../config/cache");

router.get("/api/officers", checkAuth, async (req, res) => {
  try {
    const cacheKey = 'officers:list';
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }


    // Récupérer required_role_id depuis la table configlspd
    const configRes = await pool.query("SELECT required_role_id FROM configlspd LIMIT 1");
    const REQUIRED_ROLE = configRes.rows[0]?.required_role_id?.trim();
    if (!REQUIRED_ROLE) return res.json([]); // pas de rôle configuré

    // Récupérer les grades
    const gradesRes = await pool.query("SELECT * FROM lspd_grades LIMIT 1");
    const gradesRow = gradesRes.rows[0];
    const gradeList = [
      gradesRow.rookie_role_id,
      gradesRow.officier_1_role_id,
      gradesRow.officier_2_role_id,
      gradesRow.officier_3_role_id,
      gradesRow.slo_role_id,
      gradesRow.sergent_1_role_id,
      gradesRow.sergent_2_role_id,
      gradesRow.sergent_chef_role_id,
      gradesRow.lieutenant_role_id,
      gradesRow.lieutenant_chef_role_id,
      gradesRow.capitaine_role_id,
      gradesRow.commandant_role_id,
      gradesRow.chief_role_id
    ].filter(Boolean);

    const guild = await bot.guilds.fetch(GUILD_ID);
    await guild.members.fetch();

    const agents = [];

    guild.members.cache.forEach(member => {
      if (member.user.bot) return; // ignore bots
      if (!member.roles.cache.has(REQUIRED_ROLE)) return;

      // Déterminer le grade le plus haut
      let grade = null;
      let maxIndex = -1;

      for (let i = 0; i < gradeList.length; i++) {
        const roleId = gradeList[i];
        if (member.roles.cache.has(roleId) && i > maxIndex) {
          const role = guild.roles.cache.get(roleId);
          grade = role ? role.name : null;
          maxIndex = i;
        }
      }

      // Si aucun grade, on ignore ce membre
      if (!grade) return;

      agents.push({
        id: member.id,
        displayName: member.displayName || member.user?.username || "Inconnu",
        grade,
        gradeIndex: maxIndex // pour le tri
      });
    });

    // Récupérer les photos de profil depuis lspd_agent_profiles
    const discordIds = agents.map(a => a.id);
    let photosMap = {};
    
    if (discordIds.length > 0) {
      const photosRes = await pool.query(
        'SELECT discord_id, photo_url FROM lspd_agent_profiles WHERE discord_id = ANY(?)',
        [discordIds]
      );
      photosMap = photosRes.rows.reduce((acc, row) => {
        acc[row.discord_id] = row.photo_url;
        return acc;
      }, {});
    }

    // Ajouter photo_url à chaque agent
    agents.forEach(agent => {
      agent.photo_url = photosMap[agent.id] || null;
    });

    // Trier par gradeIndex descendant (plus haut grade en premier)
    agents.sort((a, b) => b.gradeIndex - a.gradeIndex);

    // Retirer gradeIndex avant d'envoyer
    const finalAgents = agents.map(({ id, displayName, grade, photo_url }) => ({ id, displayName, grade, photo_url }));

    cache.set(cacheKey, finalAgents, CACHE_DURATIONS.GUILD_MEMBERS);

    res.json(finalAgents);

  } catch (err) {
    console.error("Erreur récupération officers:", err);
    res.status(500).json({ error: "Impossible de récupérer la liste des officers." });
  }
});

module.exports = router;
