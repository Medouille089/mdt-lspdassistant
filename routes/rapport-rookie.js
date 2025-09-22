const express = require('express');
const router = express.Router();
const bot = require('../config/bot');
const { getConfig } = require('../config/config');
const { EmbedBuilder } = require('discord.js');

const GUILD_ID = process.env.GUILD_ID; // depuis le .env
console.log('📢 GUILD_ID chargé depuis .env:', GUILD_ID);

router.get('/api/rookies', async (req, res) => {
  try {
    console.log('🔹 Route /api/rookies appelée');

    const config = await getConfig();
    console.log('🔹 Config récupérée:', config);

    const rookieRoleId = config.rookie_role_id;
    if (!GUILD_ID || !rookieRoleId) {
      console.error('❌ GUILD_ID ou rookie_role_id manquant');
      return res.status(500).json({ error: 'GUILD_ID ou rookie_role_id manquant' });
    }

    const guild = await bot.guilds.fetch(GUILD_ID);
    console.log('🔹 Guild récupérée:', guild.name);

    await guild.members.fetch();
    console.log('🔹 Membres fetchés');

    const rookies = guild.members.cache
      .filter(member => member.roles.cache.has(rookieRoleId))
      .map(member => ({
        id: member.id,
        displayName: member.displayName || member.user.username
      }));

    console.log('🔹 Rookies trouvés:', rookies.length);
    res.json(rookies);
  } catch (err) {
    console.error('❌ Erreur rookies:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des rookies' });
  }
});

router.get('/api/me', (req, res) => {
  console.log('🔹 Route /api/me appelée');
  if (!req.user) {
    console.warn('⚠️ Utilisateur non connecté');
    return res.status(401).json({ error: 'Non connecté' });
  }

  const me = {
    id: req.user.id,
    displayName: req.user.guild_member?.nick || req.user.username,
    grade: req.user.grade || 'Grade inconnu'
  };
  console.log('🔹 Utilisateur connecté:', me);
  res.json(me);
});

router.post('/api/rapport-rookie', async (req, res) => {
  try {
    console.log('🔹 Route POST /api/rapport-rookie appelée');
    console.log('🔹 Body reçu:', req.body);

    const config = await getConfig();

    const {
      rookieId, conduite, radio, procedures, ville, trello, mdt,
      hierarchie, attitude, appreciation, officier, grade
    } = req.body;

    const channel = await bot.channels.fetch('1419619602962583573');
    console.log('🔹 Salon Discord récupéré:', channel.name);

    const guild = await bot.guilds.fetch(GUILD_ID);
    await guild.members.fetch(rookieId);
    const rookieMember = guild.members.cache.get(rookieId);

    console.log('🔹 Rookie sélectionné:', rookieMember.displayName);

    const embed = new EmbedBuilder()
      .setColor(0x0b1b5a)
      .setTitle('Avis Rookie')
      .addFields(
        { name: 'Rapport sur', value: rookieMember.displayName, inline: false },
        { name: 'Agent qui rédige', value: officier, inline: true },
        { name: 'Grade', value: grade, inline: true },
        { name: 'Conduite', value: conduite, inline: true },
        { name: 'Radio', value: radio, inline: true },
        { name: 'Procédures', value: procedures, inline: true },
        { name: 'Connaissance de la ville', value: ville, inline: true },
        { name: 'Trello', value: trello, inline: true },
        { name: 'MDT', value: mdt, inline: true },
        { name: 'Connaissance de la Hiérarchie', value: hierarchie, inline: true },
        { name: 'Attitude', value: attitude, inline: false },
        { name: 'Appréciation Global', value: appreciation, inline: false }
      )
      .setFooter({ text: 'LSPD Assistant', iconURL: bot.user.displayAvatarURL() })
      .setThumbnail(bot.user.displayAvatarURL())
      .setTimestamp(new Date());

    await channel.send({ embeds: [embed] });
    console.log('✅ Rapport envoyé dans Discord');

    res.json({ message: 'Rapport enregistré et envoyé !' });
  } catch (err) {
    console.error('❌ Erreur rapport-rookie:', err);
    res.status(500).json({ error: 'Erreur lors de l’envoi du rapport.' });
  }
});

module.exports = router;
