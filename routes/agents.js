const express = require("express");
const router = express.Router();
const { checkAuth } = require("../config/middleware");
const pool = require("../config/db");

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

    console.log('Demande profil:', { 
      requestedUser: userId, 
      currentUser: user.id, 
      isSupervisor: user.isSupervisor, 
      isCommandStaff: user.isCommandStaff 
    });

    // Simplifier les permissions - permettre à tous les utilisateurs connectés de voir les profils
    console.log('Utilisateur:', { id: user.id, isSupervisor: user.isSupervisor, isCommandStaff: user.isCommandStaff, roles: user.roles });
    
    // Autoriser l'accès pour tous les utilisateurs connectés (temporaire pour déboguer)
    console.log('Autorisation accordée pour le profil');

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
        'INSERT INTO lspd_agent_profiles (discord_id, photo_url) VALUES ($1, $2) RETURNING *',
        [userId, defaultPhoto]
      );
      const created = newProfile.rows[0];
      // Normaliser champs tableaux
      created.armes = [];
      created.vehicules = [];
      return res.json(created);
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
    let { photo_url, armes, vehicules, matricule, nom, prenom, specialites } = req.body;

    // Normaliser armes / vehicules (peuvent arriver en string JSON ou déjà en array)
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

    // Autoriser l'édition pour tous (temporaire pour déboguer)
    console.log('Édition du profil autorisée pour:', user.id);

    // Mode édition désactivé temporairement - autoriser toutes les modifications

    // Mettre à jour le profil
    // Récupérer l'ancien profil pour diff AVANT update
    const oldRes = await pool.query('SELECT * FROM lspd_agent_profiles WHERE discord_id = $1', [userId]);
    const oldProfileRaw = oldRes.rows[0] || null;
    let oldProfile = null;
    if (oldProfileRaw) {
      oldProfile = { ...oldProfileRaw };
      try { if (typeof oldProfile.armes === 'string') oldProfile.armes = JSON.parse(oldProfile.armes || '[]'); } catch { oldProfile.armes = []; }
      try { if (typeof oldProfile.vehicules === 'string') oldProfile.vehicules = JSON.parse(oldProfile.vehicules || '[]'); } catch { oldProfile.vehicules = []; }
      if (!Array.isArray(oldProfile.armes)) oldProfile.armes = [];
      if (!Array.isArray(oldProfile.vehicules)) oldProfile.vehicules = [];
    }

    const result = await pool.query(
      `UPDATE lspd_agent_profiles 
       SET photo_url = $1, armes = $2, vehicules = $3, matricule = $4, 
           nom = $5, prenom = $6, date_modification = NOW()
       WHERE discord_id = $7 
       RETURNING *`,
      [photo_url, JSON.stringify(armes || []), JSON.stringify(vehicules || []), matricule, nom, prenom, userId]
    );

    if (result.rows.length === 0) {
      // Créer le profil s'il n'existe pas
      const newProfile = await pool.query(
        `INSERT INTO lspd_agent_profiles 
         (discord_id, photo_url, armes, vehicules, matricule, nom, prenom)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [userId, photo_url, JSON.stringify(armes || []), JSON.stringify(vehicules || []), matricule, nom, prenom]
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
      const logsChannelId = conf.logs_channel;
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

        const fieldChanges = [];

        const trackSimple = (label, oldVal, newVal) => {
          const o = (oldVal || '').trim();
            const n = (newVal || '').trim();
            if (o !== n) {
              fieldChanges.push({ name: label, value: `Ancien: ${o || '—'}\nNouveau: ${n || '—'}`, inline: false });
            }
        };
        trackSimple('Matricule', oldProfile?.matricule, matricule);
        trackSimple('Nom', oldProfile?.nom, nom);
        trackSimple('Prénom', oldProfile?.prenom, prenom);
        if ((oldProfile?.photo_url || '') !== (photo_url || '')) {
          fieldChanges.push({ name: 'Photo', value: `Ancien: ${oldProfile?.photo_url || '—'}\nNouveau: ${photo_url || '—'}`, inline: false });
        }
        if (armesDiff.added.length || armesDiff.removed.length) {
          let value = '';
          if (armesDiff.added.length) value += `➕ ${armesDiff.added.join('\n➕ ')}\n`;
          if (armesDiff.removed.length) value += `➖ ${armesDiff.removed.join('\n➖ ')}`;
          fieldChanges.push({ name: 'Armes modifiées', value: value.slice(0, 1000) || '—', inline: false });
        }
        if (vehiculesDiff.added.length || vehiculesDiff.removed.length) {
          let value = '';
          if (vehiculesDiff.added.length) value += `➕ ${vehiculesDiff.added.join('\n➕ ')}\n`;
          if (vehiculesDiff.removed.length) value += `➖ ${vehiculesDiff.removed.join('\n➖ ')}`;
          fieldChanges.push({ name: 'Véhicules modifiés', value: value.slice(0, 1000) || '—', inline: false });
        }

        const { EmbedBuilder } = require('discord.js');
        const channel = await bot.channels.fetch(logsChannelId).catch(() => null);
        if (channel?.isTextBased()) {
          const title = selfEdit
            ? `${actorName} a modifié son profil`
            : `${actorName} a modifié le profil de ${targetName}`;
          const embed = new EmbedBuilder()
            .setColor(0x0b1b5a)
            .setTitle(title)
            .setTimestamp();
          if (fieldChanges.length) {
            fieldChanges.slice(0, 10).forEach(fc => embed.addFields(fc));
          } else {
            embed.setDescription('Aucun changement détecté (données identiques).');
          }
          // IDs field
          embed.addFields({ name: 'ID\'s', value: `> <@${user.id}> (\`${user.id}\`)\n> <@${userId}> (\`${userId}\`)`, inline: false });
          await channel.send({ embeds: [embed] });
        }
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

    // Autoriser l'activation du mode édition pour tous (temporaire pour déboguer)
    console.log('Activation mode édition autorisée pour:', user.id);

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

    // Simplifier les permissions pour les formations
    console.log('Formations - Utilisateur:', { id: user.id, isSupervisor: user.isSupervisor, isCommandStaff: user.isCommandStaff });
    
    // Autoriser l'accès aux formations pour tous (temporaire pour déboguer)
    console.log('Autorisation accordée pour les formations');

    // Récupérer la configuration des formations depuis la table lspd_formations
    const formationsConfig = await pool.query('SELECT * FROM lspd_formations LIMIT 1');

    if (formationsConfig.rows.length === 0) {
      console.log('Aucune configuration de formation trouvée');
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
      { nom: 'ASD', discord_role_id: config.asd_role_id }
    ].filter(formation => formation.discord_role_id && formation.discord_role_id.trim() !== ''); // Exclure les formations sans rôle défini

    // Récupérer les rôles de l'utilisateur ciblé depuis Discord
    let targetUserRoles = [];
    
    try {
      // Essayer de récupérer les rôles via l'API Discord
  const discordResponse = await fetch(`${req.protocol}://${req.get('host')}/api/discord/member/${userId}`);
      if (discordResponse.ok) {
        const memberData = await discordResponse.json();
        targetUserRoles = memberData.roles || [];
        console.log('Rôles Discord récupérés pour', userId, ':', targetUserRoles);
      } else {
        // Fallback : si c'est notre propre profil, utiliser nos rôles de session
        if (user.id === userId) {
          targetUserRoles = user.roles || [];
        }
        console.log('Fallback rôles pour', userId, ':', targetUserRoles);
      }
    } catch (error) {
      console.warn('Erreur récupération rôles Discord:', error);
      // Fallback : si c'est notre propre profil, utiliser nos rôles de session
      if (user.id === userId) {
        targetUserRoles = user.roles || [];
      }
    }
    
    console.log('Debug formations:', {
      userId,
      currentUserId: user.id,
      targetUserRoles,
      formationsAvailables: formationsAvailables.map(f => ({ nom: f.nom, roleId: f.discord_role_id }))
    });
    
    // Filtrer les formations que l'utilisateur possède
    const userFormations = formationsAvailables.filter(formation => 
      targetUserRoles.includes(formation.discord_role_id)
    );

    console.log('Formations trouvées pour l\'utilisateur:', userFormations);
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
    console.log('Récupération grade pour:', userId);

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
