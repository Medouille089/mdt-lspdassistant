const express = require('express');
const router = express.Router();
const pool = require('./db');
const { checkAuth } = require('./middleware');
const { EmbedBuilder } = require('discord.js');
const { getBot } = require('../config/config');

// GET /api/grades - Récupère la configuration des rôles LSPD
router.get('/api/grades', checkAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM lspd_grades LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Aucune configuration trouvée.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erreur lors du GET /api/grades :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/api/grades', checkAuth, async (req, res) => {
  const {
    rookie_role_id,
    officier_1_role_id,
    officier_2_role_id,
    officier_3_role_id,
    slo_role_id,
    sergent_1_role_id,
    sergent_2_role_id,
    sergent_chef_role_id,
    lieutenant_role_id,
    lieutenant_chef_role_id,
    capitaine_role_id,
    commandant_role_id,
    chief_role_id,
    division_enquete_role_id
  } = req.body;

  try {
    const bot = getBot();
    const config = await pool.query('SELECT * FROM configlspd LIMIT 1');
    const logsChannelId = config.rows[0]?.logs_channel;
    let logsChannel = null;
    if (logsChannelId) {
      try {
        logsChannel = await bot.channels.fetch(logsChannelId);
      } catch (err) {
        console.error(`Impossible de récupérer le salon de logs (${logsChannelId}) :`, err.message);
      }
    }

    console.log(logsChannel);

    const previous = await pool.query('SELECT * FROM lspd_grades LIMIT 1');
    const oldGrades = previous.rows[0] || {};

    console.log('--- REQ.BODY ---', req.body);
    console.log('--- DIVISION_ENQUETE_ROLE_ID ---', division_enquete_role_id);

    await pool.query(`
      INSERT INTO lspd_grades (
        id, rookie_role_id, officier_1_role_id, officier_2_role_id, officier_3_role_id,
        slo_role_id, sergent_1_role_id, sergent_2_role_id, sergent_chef_role_id,
        lieutenant_role_id, lieutenant_chef_role_id, capitaine_role_id,
        commandant_role_id, chief_role_id, division_enquete_role_id
      ) VALUES (
        1, $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11,
        $12, $13, $14
      )
      ON CONFLICT (id)
      DO UPDATE SET
        rookie_role_id = $1,
        officier_1_role_id = $2,
        officier_2_role_id = $3,
        officier_3_role_id = $4,
        slo_role_id = $5,
        sergent_1_role_id = $6,
        sergent_2_role_id = $7,
        sergent_chef_role_id = $8,
        lieutenant_role_id = $9,
        lieutenant_chef_role_id = $10,
        capitaine_role_id = $11,
        commandant_role_id = $12,
        chief_role_id = $13,
        division_enquete_role_id = $14
    `, [
      rookie_role_id,
      officier_1_role_id,
      officier_2_role_id,
      officier_3_role_id,
      slo_role_id,
      sergent_1_role_id,
      sergent_2_role_id,
      sergent_chef_role_id,
      lieutenant_role_id,
      lieutenant_chef_role_id,
      capitaine_role_id,
      commandant_role_id,
      chief_role_id,
      division_enquete_role_id
    ]);

    // Log Discord si changement
    const labels = {
      rookie_role_id: "Rookie",
      officier_1_role_id: "Officier I",
      officier_2_role_id: "Officier II",
      officier_3_role_id: "Officier III",
      slo_role_id: "SLO",
      sergent_1_role_id: "Sergent I",
      sergent_2_role_id: "Sergent II",
      sergent_chef_role_id: "Sergent Chef",
      lieutenant_role_id: "Lieutenant",
      lieutenant_chef_role_id: "Lieutenant Chef",
      capitaine_role_id: "Capitaine",
      commandant_role_id: "Commandant",
      chief_role_id: "Chief",
      division_enquete_role_id: "Division Enquête"
    };

    for (const key in labels) {
      const oldId = oldGrades[key]?.trim();
      const newId = req.body[key]?.trim();

      if (oldId !== newId && logsChannel) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle(`🔧 Rôle ${labels[key]} modifié`)
          .setDescription(`<@${req.user.id}> a modifié le rôle **${labels[key]}**`)
          .addFields({
            name: "Détails",
            value: `> Utilisateur: <@${req.user.id}> (\`${req.user.id}\`)\n> Avant: <@&${oldId}> (\`${oldId}\`)\n> Après: <@&${newId}> (\`${newId}\`)`,
            inline: false
          })
          .setFooter({
            text: "LSPD Assistant",
            iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 })
          })
          .setTimestamp();

        await logsChannel.send({ embeds: [embed] }).catch(console.error);
      }
    }

    res.status(200).json({ message: 'Configuration des grades mise à jour' });

  } catch (error) {
    console.error('Erreur lors du PUT /api/grades :', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des grades' });
  }
});

module.exports = router;