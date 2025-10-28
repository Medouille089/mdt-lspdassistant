const express = require("express");
const router = express.Router();
const { checkAuth } = require("../config/middleware");
const pool = require("../config/db");
const { EmbedBuilder } = require('discord.js');

// Helper pour envoyer un embed de log profil agent
async function sendAgentLog({ bot, logsChannelId, action, actorMember, targetMember, actorId, targetId, lines = [] }) {
  try {
    if (!logsChannelId) return;
    const channel = await bot.channels.fetch(logsChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;
    const actorName = actorMember?.displayName || actorId;
    const targetName = targetMember?.displayName || targetId;
  const actionLabelMap = { CREATE: 'CRÉATION', UPDATE: 'MODIFICATION', EDIT_ON: 'MODE ÉDITION ON' };
    const baseLabel = actionLabelMap[action] || action;
    const self = actorId === targetId;
    let title;
    if (action === 'CREATE') {
      title = `${actorName} a créé le profil de ${targetName}`;
    } else if (action === 'UPDATE') {
      title = self
        ? `${actorName} a modifié son profil`
        : `${actorName} a modifié le profil de ${targetName}`;
    } else if (action === 'EDIT_ON') {
      title = `${actorName} a pris le mode édition du profil de ${targetName}`;
    } else {
      title = `${actorName} action sur ${targetName}`;
    }

  if (!lines.length) lines.push('Aucun détail');
  const details = lines.map(l => l.startsWith('>') ? l : `> ${l}`).join('\n').slice(0, 3900);
    const botAvatar = bot.user?.displayAvatarURL({ size: 128 });
    const embed = new EmbedBuilder()
      .setColor(0xFFFFFF)
      .setTitle(title)
  .addFields({ name: 'Détails', value: details })
  .addFields({ name: 'ID\'s', value: `> <@${actorId}> (\`${actorId}\`)` })
      .setFooter({ text: 'LSPD Assistant', iconURL: botAvatar || undefined })
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.warn('Log agent échoué:', e.message);
  }
}

router.get('/api/user', checkAuth, async (req, res) => {
  const user = req.user;

  try {
    res.set('Cache-Control', 'no-store');

    res.json({
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      discriminator: user.discriminator,
      roles: user.roles,
      isSupervisor: user.isSupervisor,
      isCommandStaff: user.isCommandStaff,
      grade: user.grade
    });

  } catch (err) {
    console.error('Erreur fetch user:', err);
    res.status(500).json({ error: 'Impossible de récupérer les infos utilisateur.' });
  }
});

// GET /api/agent-profile/:userId - Récupérer le profil d'un agent
router.get('/api/agent-profile/:userId', checkAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = req.user;

    const result = await pool.query(
      'SELECT * FROM lspd_agent_profiles WHERE discord_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Déterminer avatar Discord par défaut (pour soi ou cible si staff)
      let defaultPhoto = null;
      try {
        const canFetchTarget = user && (user.id === userId || user.isSupervisor || user.isCommandStaff || user.isSuperAdmin);
        if (canFetchTarget) {
          // Si on crée pour un autre user (staff), tenter de récupérer via API interne discord/member
            if (user.id !== userId) {
              try {
                const { getBot } = require('../config/config');
                const bot = getBot();
                const guild = bot.guilds.cache.get(process.env.GUILD_ID);
                if (guild) {
                  const member = await guild.members.fetch(userId).catch(() => null);
                  if (member) {
                    if (member.user.avatar) {
                      defaultPhoto = `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png?size=256`;
                    } else {
                      const hashIdx = member.user.discriminator && member.user.discriminator !== '0'
                        ? parseInt(member.user.discriminator) % 5
                        : (parseInt(member.user.id.slice(-3), 10) % 5);
                      defaultPhoto = `https://cdn.discordapp.com/embed/avatars/${hashIdx}.png`;
                    }
                  }
                }
              } catch(apiErr) {
                console.warn('Fetch avatar membre cible (bot) échoué, fallback sur session si même user:', apiErr.message);
              }
            }
            // Si toujours rien ou c'est soi-même
            if (!defaultPhoto && user && user.id === userId) {
              if (user.avatar) {
                defaultPhoto = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`;
              } else if (user.discriminator) {
                const discrimIndex = parseInt(user.discriminator) % 5;
                defaultPhoto = `https://cdn.discordapp.com/embed/avatars/${discrimIndex}.png`;
              }
            }
        }
      } catch (e) {
        console.warn('Impossible de calculer avatar par défaut:', e);
      }

      const newProfile = await pool.query(
        'INSERT INTO lspd_agent_profiles (discord_id, photo_url, telephone) VALUES ($1, $2, $3) RETURNING *',
        [userId, defaultPhoto, '']
      );
      const created = newProfile.rows[0];
      // Normaliser champs tableaux
      created.armes = [];
      created.vehicules = [];
      res.json(created);
      // Log création
      try {
        const { getConfig, getBot } = require('../config/config');
        const conf = getConfig();
        const logsChannelId = conf.logs_connexion;
        if (logsChannelId) {
          const bot = getBot();
          const guild = bot.guilds.cache.get(process.env.GUILD_ID) || await bot.guilds.fetch(process.env.GUILD_ID);
          const actorMember = await guild.members.fetch(req.user.id).catch(() => null);
          const targetMember = await guild.members.fetch(userId).catch(() => null);
          await sendAgentLog({
            bot,
            logsChannelId,
            action: 'CREATE',
            actorMember,
            targetMember,
            actorId: req.user.id,
            targetId: userId,
            lines: [
              'Action: CRÉATION',
              'Type: Profil Agent',
              `Agent cible: ${targetMember?.displayName || userId}`,
              `Acteur: ${actorMember?.displayName || req.user.id}`,
              `Photo initiale: ${defaultPhoto || '—'}`
            ]
          });
        }
      } catch(e) { console.warn('Log création profil échoué:', e.message); }
      return; // Already responded
    }

    // Parser armes / vehicules si stockés en JSON texte
    const profile = result.rows[0];
    try { if (typeof profile.armes === 'string') profile.armes = JSON.parse(profile.armes || '[]'); } catch { profile.armes = []; }
    try { if (typeof profile.vehicules === 'string') profile.vehicules = JSON.parse(profile.vehicules || '[]'); } catch { profile.vehicules = []; }
    if (!Array.isArray(profile.armes)) profile.armes = [];
    if (!Array.isArray(profile.vehicules)) profile.vehicules = [];

    res.json(profile);
  } catch (err) {
    console.error('Erreur récupération profil agent:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/agent-profile/:userId - Mettre à jour le profil d'un agent
router.put('/api/agent-profile/:userId', checkAuth, async (req, res) => {
  try {
    const { userId } = req.params; // cible
    const user = req.user; // acteur
  let { photo_url, armes, vehicules, matricule, nom, prenom, telephone, specialites } = req.body;

    const parseArray = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
      }
      return [];
    };
    armes = parseArray(armes).filter(a => a && a.nom);
    vehicules = parseArray(vehicules).filter(v => v && v.nom);

    const oldRes = await pool.query('SELECT * FROM lspd_agent_profiles WHERE discord_id = $1', [userId]);
    const oldProfileRaw = oldRes.rows[0] || null;
    let oldProfile = null;
    if (oldProfileRaw) {
      oldProfile = { ...oldProfileRaw };
      try { if (typeof oldProfile.armes === 'string') oldProfile.armes = JSON.parse(oldProfile.armes || '[]'); } catch { oldProfile.armes = []; }
      try { if (typeof oldProfile.vehicules === 'string') oldProfile.vehicules = JSON.parse(oldProfile.vehicules || '[]'); } catch { oldProfile.vehicules = []; }
      if (!Array.isArray(oldProfile.armes)) oldProfile.armes = [];
      if (!Array.isArray(oldProfile.vehicules)) oldProfile.vehicules = [];

      oldProfile.armes = oldProfile.armes.filter(a => a && a.nom);
      oldProfile.vehicules = oldProfile.vehicules.filter(v => v && v.nom);
    }

    const result = await pool.query(
      `UPDATE lspd_agent_profiles 
       SET photo_url = $1, armes = $2, vehicules = $3, matricule = $4, 
           nom = $5, prenom = $6, telephone = $7, date_modification = NOW()
       WHERE discord_id = $8 
       RETURNING *`,
      [photo_url, JSON.stringify(armes || []), JSON.stringify(vehicules || []), matricule, nom, prenom, telephone, userId]
    );

    if (result.rows.length === 0) {
      // Créer le profil s'il n'existe pas
      const newProfile = await pool.query(
        `INSERT INTO lspd_agent_profiles 
         (discord_id, photo_url, armes, vehicules, matricule, nom, prenom, telephone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [userId, photo_url, JSON.stringify(armes || []), JSON.stringify(vehicules || []), matricule, nom, prenom, telephone]
      );
      const created = newProfile.rows[0];
      try { created.armes = JSON.parse(created.armes || '[]'); } catch { created.armes = []; }
      try { created.vehicules = JSON.parse(created.vehicules || '[]'); } catch { created.vehicules = []; }
      return res.json(created);
    }

    const updated = result.rows[0];
    try { updated.armes = JSON.parse(updated.armes || '[]'); } catch { updated.armes = []; }
    try { updated.vehicules = JSON.parse(updated.vehicules || '[]'); } catch { updated.vehicules = []; }
    res.json(updated);

    // ===== LOG DISCORD =====
    try {
      const { getConfig, getBot } = require('../config/config');
      const conf = getConfig();
      const logsChannelId = conf.logs_connexion;
      if (logsChannelId) {
        const bot = getBot();
        const guild = bot.guilds.cache.get(process.env.GUILD_ID) || await bot.guilds.fetch(process.env.GUILD_ID);
        // Fetch display names
        const actorMember = await guild.members.fetch(user.id).catch(() => null);
        const targetMember = await guild.members.fetch(userId).catch(() => null);
  const actorName = actorMember?.displayName || user.username || user.id;
  const targetName = targetMember?.displayName || ((updated.prenom && updated.nom) ? `${updated.prenom} ${updated.nom}`.trim() : (updated.nom || updated.prenom || userId));
        const selfEdit = user.id === userId;

  // Les champs updated.armes / updated.vehicules ont été parsés juste avant (arrays)
  // Utiliser directement les valeurs en fallback sur celles reçues dans la requête (armes/vehicules variables locales)
  let newArmes = Array.isArray(updated.armes) ? updated.armes : (Array.isArray(armes) ? armes : []);
  let newVehicules = Array.isArray(updated.vehicules) ? updated.vehicules : (Array.isArray(vehicules) ? vehicules : []);
  // Filtrer entrées vides
  newArmes = newArmes.filter(a => a && a.nom);
  newVehicules = newVehicules.filter(v => v && v.nom);

        // Diff helper
        const stringifyEquip = (list, type) => list.map(e => type === 'arme' ? `${e.nom}${e.numero_serie ? ' (#'+e.numero_serie+')' : ''}` : `${e.nom}${e.immatriculation ? ' [ '+e.immatriculation+' ]' : ''}`);
        const diffList = (oldList = [], newList = [], type) => {
          const oldS = new Set(stringifyEquip(oldList, type));
          const newS = new Set(stringifyEquip(newList, type));
          const added = [...newS].filter(x => !oldS.has(x));
          const removed = [...oldS].filter(x => !newS.has(x));
          return { added, removed };
        };

        const armesDiff = diffList(oldProfile?.armes || [], newArmes, 'arme');
        const vehiculesDiff = diffList(oldProfile?.vehicules || [], newVehicules, 'vehicule');

        const lines = [];
        lines.push('Action: MODIFICATION');
        lines.push('Type: Profil Agent');
        lines.push(`Agent cible: ${targetName}`);
        if (!selfEdit) lines.push(`Acteur: ${actorName}`);
        const simpleChangeLine = (label, oldVal, newVal) => {
          const o = (oldVal || '').trim();
          const n = (newVal || '').trim();
          if (o !== n) lines.push(`${label}: \`${o || '—'}\` -> \`${n || '—'}\``);
        };
        simpleChangeLine('Matricule', oldProfile?.matricule, matricule);
        simpleChangeLine('Nom', oldProfile?.nom, nom);
        simpleChangeLine('Prénom', oldProfile?.prenom, prenom);
        if ((oldProfile?.photo_url || '') !== (photo_url || '')) {
          lines.push(`Photo: ${(oldProfile?.photo_url || '—')} -> ${(photo_url || '—')}`);
        }
        // Listes complètes old/new
        const formatList = (arr, prefix) => (arr && arr.length ? arr.map(a => prefix + a).join(', ') : '—');
        const oldArmesList = (oldProfile?.armes || []).map(a => a && a.nom ? `${a.nom}${a.numero_serie ? ' (#'+a.numero_serie+')' : ''}` : null).filter(Boolean);
        const newArmesList = newArmes.map(a => a && a.nom ? `${a.nom}${a.numero_serie ? ' (#'+a.numero_serie+')' : ''}` : null).filter(Boolean);
        const oldVehList = (oldProfile?.vehicules || []).map(v => v && v.nom ? `${v.nom}${v.immatriculation ? ' [ '+v.immatriculation+' ]' : ''}` : null).filter(Boolean);
        const newVehList = newVehicules.map(v => v && v.nom ? `${v.nom}${v.immatriculation ? ' [ '+v.immatriculation+' ]' : ''}` : null).filter(Boolean);
        // Diff synthèse
        if (armesDiff.added.length) lines.push(`Armes ajoutées: ${armesDiff.added.join(', ')}`);
        if (armesDiff.removed.length) lines.push(`Armes retirées: ${armesDiff.removed.join(', ')}`);
        if (vehiculesDiff.added.length) lines.push(`Véhicules ajoutés: ${vehiculesDiff.added.join(', ')}`);
        if (vehiculesDiff.removed.length) lines.push(`Véhicules retirés: ${vehiculesDiff.removed.join(', ')}`);
        // Listes complètes
        lines.push(`Anciennes armes: ${oldArmesList.length ? oldArmesList.join(', ') : '—'}`);
        lines.push(`Nouvelles armes: ${newArmesList.length ? newArmesList.join(', ') : '—'}`);
        lines.push(`Anciens véhicules: ${oldVehList.length ? oldVehList.join(', ') : '—'}`);
        lines.push(`Nouveaux véhicules: ${newVehList.length ? newVehList.join(', ') : '—'}`);
        if (lines.length <= 4) lines.push('Aucun changement détecté');
        await sendAgentLog({
          bot,
          logsChannelId,
          action: 'UPDATE',
          actorMember,
          targetMember,
          actorId: user.id,
          targetId: userId,
          lines
        });
      }

    } catch (logErr) {
      console.warn('Log modification profil échoué:', logErr.message);
    }
  } catch (err) {
    console.error('Erreur mise à jour profil agent:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/agent-profile/:userId/edit-mode - Activer le mode édition
router.post('/api/agent-profile/:userId/edit-mode', checkAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = req.user;


    // Vérifier si quelqu'un d'autre est en mode édition
    const editCheck = await pool.query(
      'SELECT is_editing, edited_by, edit_started_at FROM lspd_agent_profiles WHERE discord_id = $1',
      [userId]
    );
    
    if (editCheck.rows.length > 0) {
      const { is_editing, edited_by, edit_started_at } = editCheck.rows[0];
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      if (is_editing && edited_by && edited_by !== user.id && 
          edit_started_at && new Date(edit_started_at) > fiveMinutesAgo) {
        return res.status(423).json({ 
          error: 'Ce profil est en cours de modification par un autre utilisateur',
          lockedBy: edited_by
        });
      }
    }

    // Activer le mode édition
    await pool.query(
      `UPDATE lspd_agent_profiles 
       SET is_editing = true, edited_by = $1, edit_started_at = NOW()
       WHERE discord_id = $2`,
      [user.id, userId]
    );

    res.json({ success: true, editMode: true });
    // Log acquisition edit-mode
    try {
      const { getConfig, getBot } = require('../config/config');
      const conf = getConfig();
      if (conf.logs_connexion) {
        const bot = getBot();
        const guild = bot.guilds.cache.get(process.env.GUILD_ID) || await bot.guilds.fetch(process.env.GUILD_ID);
        const actorMember = await guild.members.fetch(user.id).catch(() => null);
        const targetMember = await guild.members.fetch(userId).catch(() => null);
        await sendAgentLog({
          bot,
          logsChannelId: conf.logs_connexion,
          action: 'EDIT_ON',
          actorMember,
          targetMember,
          actorId: user.id,
          targetId: userId,
          lines: [
            'Action: MODE ÉDITION ON',
            'Type: Profil Agent',
            `Agent cible: ${targetMember?.displayName || userId}`,
            `Acteur: ${actorMember?.displayName || user.id}`
          ]
        });
      }
    } catch(e) { console.warn('Log edit-mode on échoué:', e.message); }
  } catch (err) {
    console.error('Erreur activation mode édition:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/agent-profile/:userId/edit-mode - Désactiver le mode édition
router.delete('/api/agent-profile/:userId/edit-mode', checkAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = req.user;

    // Désactiver le mode édition seulement si c'est le même utilisateur
    await pool.query(
      `UPDATE lspd_agent_profiles 
       SET is_editing = false, edited_by = NULL, edit_started_at = NULL
       WHERE discord_id = $1 AND edited_by = $2`,
      [userId, user.id]
    );

    res.json({ success: true, editMode: false });
  } catch (err) {
    console.error('Erreur désactivation mode édition:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/agent-formations/:userId - Récupérer les formations d'un agent
router.get('/api/agent-formations/:userId', checkAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = req.user;

    // Récupérer la configuration des formations depuis la table lspd_formations
    const formationsConfig = await pool.query('SELECT * FROM lspd_formations LIMIT 1');

    if (formationsConfig.rows.length === 0) {
      return res.json([]);
    }

    const config = formationsConfig.rows[0];

    // Définir les formations disponibles avec leurs noms et rôles Discord
    const formationsAvailables = [
      { nom: 'Négociateur', discord_role_id: config.negociateur_role_id },
      { nom: 'Lead Terrain', discord_role_id: config.lead_terrain_role_id },
      { nom: 'Dispatcher', discord_role_id: config.dispatcher_role_id },  
      { nom: 'Mary Unit', discord_role_id: config.mary_unit_role_id },
      { nom: 'Nautics Unit', discord_role_id: config.nautics_unit_role_id },
      { nom: 'VIR', discord_role_id: config.vir_role_id },
      { nom: 'Convoi', discord_role_id: config.convoie_role_id },
      { nom: 'ASD', discord_role_id: config.asd_role_id },
      { nom: 'Plongée', discord_role_id: config.plongee_role_id },
      { nom: 'Parachute', discord_role_id: config.parachute_role_id },
      { nom: 'Premiers Secours', discord_role_id: config.premiers_secours_role_id },
      { nom: 'Bomb Squad', discord_role_id: config.bomb_squad_role_id }
    ].filter(formation => formation.discord_role_id && formation.discord_role_id.trim() !== ''); // Exclure les formations sans rôle défini

    // Récupérer les rôles de l'utilisateur ciblé depuis Discord
    let targetUserRoles = [];
    try {
      const bot = require('../config/bot');
      const guildId = process.env.GUILD_ID;
      const guild = await bot.guilds.fetch(guildId);
      // Forcer le refresh du membre
      guild.members.cache.delete(userId);
      const member = await guild.members.fetch(userId);
      targetUserRoles = member.roles.cache.map(role => role.id);
    } catch (error) {
      console.warn('Erreur récupération rôles Discord:', error);
      // Fallback : si c'est notre propre profil, utiliser nos rôles de session
      if (user.id === userId) {
        targetUserRoles = user.roles || [];
      }
    }
    
    // Filtrer les formations que l'utilisateur possède
    const userFormations = formationsAvailables.filter(formation => 
      targetUserRoles.includes(formation.discord_role_id)
    );

    res.json(userFormations);
  } catch (err) {
    console.error('Erreur récupération formations:', err);
    // Retourner une liste vide en cas d'erreur plutôt qu'une erreur 500
    res.json([]);
  }
});


// GET /api/agent-grade/:userId - Récupérer le grade d'un agent  
router.get('/api/agent-grade/:userId', checkAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Charger config grades
    const gradesConfig = await pool.query('SELECT * FROM lspd_grades LIMIT 1');
    if (gradesConfig.rows.length === 0) {
      return res.json({ grade: 'Agent' });
    }
    const config = gradesConfig.rows[0];

    const gradeHierarchy = [
      { nom: 'Chief', role_id: config.chief_role_id },
      { nom: 'Commandant', role_id: config.commandant_role_id },
      { nom: 'Capitaine', role_id: config.capitaine_role_id },
      { nom: 'Lieutenant Chef', role_id: config.lieutenant_chef_role_id },
      { nom: 'Lieutenant', role_id: config.lieutenant_role_id },
      { nom: 'Sergent Chef', role_id: config.sergent_chef_role_id },
      { nom: 'Sergent II', role_id: config.sergent_2_role_id },
      { nom: 'Sergent I', role_id: config.sergent_1_role_id },
      { nom: 'SLO', role_id: config.slo_role_id },
      { nom: 'Officier III', role_id: config.officier_3_role_id },
      { nom: 'Officier II', role_id: config.officier_2_role_id },
      { nom: 'Officier I', role_id: config.officier_1_role_id },
      { nom: 'Rookie', role_id: config.rookie_role_id }
    ].filter(g => g.role_id && g.role_id.trim() !== '');

    let userRoles = [];
    try {
      const bot = require('../config/bot');
      const guildId = process.env.GUILD_ID;
      const guild = bot.guilds.cache.get(guildId);
      if (guild) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
          userRoles = member.roles.cache.map(r => r.id);
        }
      }
    } catch (e) {
      console.warn('Impossible de récupérer les rôles via bot, fallback:', e.message);
    }

    // Fallback si vide: utiliser session si c'est soi-même
    if (!userRoles.length && req.user?.id === userId) {
      userRoles = req.user.roles || [];
    }

    for (const grade of gradeHierarchy) {
      if (userRoles.includes(grade.role_id)) {
        return res.json({ grade: grade.nom });
      }
    }

    return res.json({ grade: 'Agent' });
  } catch (err) {
    console.error('Erreur récupération grade:', err);
    return res.json({ grade: 'Agent' });
  }
});


module.exports = router;
