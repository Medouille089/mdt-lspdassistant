const express = require("express");
const config = require("../config/config");
const router = express.Router();
const pool = require("../config/db");
const { getBot } = require("../config/config");
const { DateTime } = require("luxon");
const { EmbedBuilder } = require("discord.js");

function getHighestRankedRole(userRoles, configRoles) {
  const matched = configRoles.filter(r => userRoles.includes(r.discord_role_id));
  return matched.sort((a, b) => a.rank - b.rank)[0];
}

router.post("/pointeuse/start", async (req, res) => {
  try {
    const conf = await config.getConfig();
    const { id } = req.user;
    const member = await getBot().guilds.cache.first().members.fetch(id);
    const userRoles = member.roles.cache.map(r => r.id);

    const configRes = await pool.query("SELECT * FROM lspd_config_pointage");
    const topRole = getHighestRankedRole(userRoles, configRes.rows);

    if (!topRole) return res.status(403).json({ error: "Aucun rôle LSPD valide trouvé" });

    const ongoing = await pool.query(
      "SELECT * FROM lspd_pointage WHERE id_discord = $1 AND end_time IS NULL",
      [id]
    );

    if (ongoing.rows.length > 0) {
      return res.status(400).json({ error: "Pointage déjà en cours" });
    }

    const nowParis = DateTime.now().setZone("Europe/Paris").toJSDate();

    await pool.query(`
      INSERT INTO lspd_pointage (id_discord, discord_role_id, start_time)
      VALUES ($1, $2, $3)
    `, [id, topRole.discord_role_id, nowParis]);
    if (conf.logs_channel) {
      try {
        const clientDiscord = getBot();
        const logsChannel = await clientDiscord.channels.fetch(conf.logs_channel);

        if (logsChannel?.isTextBased()) {
          const nowFormatted = DateTime.now().setZone("Europe/Paris").toFormat("dd/MM/yyyy - HH:mm");

          const embedLog = new EmbedBuilder()
            .setColor(0x0b1b5a)
            .setTitle("Pointeuse lancée")
            .setDescription(`<@${req.user.id}> a lancé sa pointeuse - \`${nowFormatted}\``)
            .addFields({
              name: "ID's",
              value: `> <@${req.user.id}> (\`${req.user.id}\`)`,
              inline: false
            })
            .setFooter({
              text: "LSPD Assistant",
              iconURL: clientDiscord.user.displayAvatarURL({ extension: 'png', size: 256 })
            })
            .setTimestamp();

          await logsChannel.send({ embeds: [embedLog] });
        }
      } catch (err) {
        console.error("Erreur lors de l'envoi du log Discord :", err);
      }
    }

    res.json({ success: true, role_used: topRole.role_name, start_time: nowParis });
  } catch (err) {
    console.error("Erreur /pointeuse/start :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/pointeuse/stop", async (req, res) => {
  try {
    const { id } = req.user;
    const conf = await config.getConfig();
    const result = await pool.query(`
      SELECT p.*, c.salary_rate FROM lspd_pointage p
      JOIN lspd_config_pointage c ON p.discord_role_id = c.discord_role_id
      WHERE p.id_discord = $1 AND p.end_time IS NULL
    `, [id]);

    if (!result.rows.length) return res.status(400).json({ error: "Aucun pointage en cours" });

    const row = result.rows[0];

    const start = DateTime.fromJSDate(row.start_time, { zone: "Europe/Paris" });
    const end = DateTime.now().setZone("Europe/Paris");

    const durationHours = end.diff(start, ['hours', 'minutes', 'seconds']).as('hours');
    const earned = +(durationHours * row.salary_rate).toFixed(2);
    const nowParis = end.toJSDate();

    await pool.query(`
      UPDATE lspd_pointage
      SET end_time = $1, salary_earned = $2
      WHERE id = $3
    `, [nowParis, earned, row.id]);

    if (conf.logs_channel) {
      try {
        const clientDiscord = getBot();
        const logsChannel = await clientDiscord.channels.fetch(conf.logs_channel);

        if (logsChannel?.isTextBased()) {
          const nowFormatted = DateTime.now().setZone("Europe/Paris").toFormat("dd/MM/yyyy - HH:mm");

          const embedLog = new EmbedBuilder()
            .setColor(0x0b1b5a)
            .setTitle("Pointeuse arrêtée")
            .setDescription(`<@${req.user.id}> a arrêté sa pointeuse - \`${nowFormatted}\``)
            .addFields({
              name: "ID's",
              value: `> <@${req.user.id}> (\`${req.user.id}\`)`,
              inline: false
            })
            .setFooter({
              text: "LSPD Assistant",
              iconURL: clientDiscord.user.displayAvatarURL({ extension: 'png', size: 256 })
            })
            .setTimestamp();

          await logsChannel.send({ embeds: [embedLog] });
        }
      } catch (err) {
        console.error("Erreur lors de l'envoi du log Discord :", err);
      }
    }

    res.json({
      success: true,
      earned,
      duration: durationHours.toFixed(2),
      end_time: nowParis
    });
  } catch (err) {
    console.error("Erreur /pointeuse/stop :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/pointeuse/historique", async (req, res) => {
  try {
    const { id } = req.user;

    const result = await pool.query(`
      SELECT p.*, c.role_name FROM lspd_pointage p
      JOIN lspd_config_pointage c ON p.discord_role_id = c.discord_role_id
      WHERE id_discord = $1 ORDER BY start_time DESC
    `, [id]);

    // Convertit les timestamps en heure de Paris dans la réponse JSON
    const formatted = result.rows.map(row => {
      const startParis = row.start_time ? DateTime.fromJSDate(row.start_time).setZone('Europe/Paris').toISO() : null;
      const endParis = row.end_time ? DateTime.fromJSDate(row.end_time).setZone('Europe/Paris').toISO() : null;
      return {
        ...row,
        start_time: startParis,
        end_time: endParis
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error("Erreur /pointeuse/historique :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/pointeuse/semaine", async (req, res) => {
  try {
    const { id } = req.user;
    const nowParis = DateTime.now().setZone("Europe/Paris");
    const startOfWeek = nowParis.startOf("week").startOf("day");
    const endOfWeek = startOfWeek.plus({ days: 6 }).endOf("day");

    // Récupération des pointages de la semaine en cours
    const weeklyPointages = await pool.query(
      `
      SELECT p.*, c.role_name, c.salary_rate
      FROM lspd_pointage p
      JOIN lspd_config_pointage c ON p.discord_role_id = c.discord_role_id
      WHERE p.id_discord = $1
      AND p.start_time BETWEEN $2 AND $3
      ORDER BY p.start_time DESC
      `,
      [id, startOfWeek.toISO(), endOfWeek.toISO()]
    );

    // Calcul total du salaire de la semaine en cours (en convertissant en nombre)
    const totalWeekSalary = weeklyPointages.rows.reduce(
      (acc, p) => acc + (Number(p.salary_earned) || 0),
      0
    );

    // Date du début de la période : 3 semaines avant la semaine en cours
    const startOfLast3Weeks = startOfWeek.minus({ weeks: 3 });

    // Récupérer les 3 semaines avant la semaine en cours, excluant la semaine en cours
    const last3WeeksSalariesRes = await pool.query(
      `
      SELECT
        date_trunc('week', start_time) AS week_start,
        SUM(salary_earned) AS total_salary
      FROM lspd_pointage
      WHERE id_discord = $1
        AND start_time >= $2
        AND start_time < $3
        AND salary_earned IS NOT NULL
      GROUP BY week_start
      ORDER BY week_start DESC
      LIMIT 3
      `,
      [id, startOfLast3Weeks.toISO(), startOfWeek.toISO()]
    );

    res.json({
      currentWeek: {
        start: startOfWeek.toISO(),
        end: endOfWeek.toISO(),
        totalSalary: +totalWeekSalary.toFixed(2),
        entries: weeklyPointages.rows.map(row => ({
          start_time: DateTime.fromJSDate(row.start_time).setZone("Europe/Paris").toISO(),
          end_time: row.end_time ? DateTime.fromJSDate(row.end_time).setZone("Europe/Paris").toISO() : null,
          salary_earned: row.salary_earned,
          durationHours: row.end_time
            ? DateTime.fromJSDate(row.end_time).diff(DateTime.fromJSDate(row.start_time), 'hours').hours.toFixed(2)
            : null,
          role_name: row.role_name,
        })),
      },
      last3Weeks: last3WeeksSalariesRes.rows.map(r => ({
        weekStart: DateTime.fromJSDate(r.week_start).setZone("Europe/Paris").toISODate(),
        totalSalary: +parseFloat(r.total_salary).toFixed(2),
      })),
    });
  } catch (err) {
    console.error("Erreur /pointeuse/semaine :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

















router.get("/admin/pointeuses-actives", async (req, res) => {
  try {
    const pointages = await pool.query(`
      SELECT id, id_discord, discord_role_id, start_time
      FROM lspd_pointage
      WHERE end_time IS NULL
      ORDER BY start_time ASC
    `);

    const formatted = pointages.rows.map(row => ({
      id: row.id,
      discord_id: row.id_discord,
      username: `ID: ${row.id_discord}`,
      start_time: DateTime.fromJSDate(row.start_time).setZone('Europe/Paris').toISO()
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Erreur /admin/pointeuses-actives :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/admin/pointeuse/stop/:discordId", async (req, res) => {
  try {
    const { discordId } = req.params;
    const adminDiscordId = req.user.id;
    const conf = await config.getConfig();

    const result = await pool.query(`
      SELECT p.*, c.salary_rate FROM lspd_pointage p
      JOIN lspd_config_pointage c ON p.discord_role_id = c.discord_role_id
      WHERE p.id_discord = $1 AND p.end_time IS NULL
    `, [discordId]);

    if (!result.rows.length) return res.status(400).json({ error: "Aucun pointage en cours pour cet utilisateur" });

    const row = result.rows[0];

    const start = DateTime.fromJSDate(row.start_time, { zone: "Europe/Paris" });
    const end = DateTime.now().setZone("Europe/Paris");

    const durationHours = end.diff(start, ['hours', 'minutes', 'seconds']).as('hours');
    const earned = +(durationHours * row.salary_rate).toFixed(2);
    const nowParis = end.toJSDate();

    await pool.query(`
      UPDATE lspd_pointage
      SET end_time = $1, salary_earned = $2
      WHERE id = $3
    `, [nowParis, earned, row.id]);

    if (conf.logs_channel) {
      try {
        const clientDiscord = getBot();
        const logsChannel = await clientDiscord.channels.fetch(conf.logs_channel);

        if (logsChannel?.isTextBased()) {
          const nowFormatted = end.toFormat("dd/MM/yyyy - HH:mm");

          const embedLog = new EmbedBuilder()
            .setColor(0x0b1b5a)
            .setTitle("Pointeuse arrêtée (Admin)")
            .setDescription(`⛔ Pointeuse stoppée pour <@${discordId}> par <@${adminDiscordId}> - \`${nowFormatted}\``)
            .addFields({
              name: "ID's",
              value: `> <@${discordId}> (\`${discordId}\`)\n> <@${adminDiscordId}> (\`${adminDiscordId}\`)`,
              inline: false,
            })
            .setFooter({
              text: "LSPD Assistant",
              iconURL: clientDiscord.user.displayAvatarURL({ extension: 'png', size: 256 })
            })
            .setTimestamp();

          await logsChannel.send({ embeds: [embedLog] });
        }
      } catch (err) {
        console.error("Erreur log Discord (admin stop) :", err);
      }
    }

    res.json({
      success: true,
      earned,
      duration: durationHours.toFixed(2),
      end_time: nowParis
    });
  } catch (err) {
    console.error("Erreur /admin/pointeuse/stop :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get('/api/user/:discordId', async (req, res) => {
  try {
    const discordId = req.params.discordId;
    const client = getBot();
    const guild = client.guilds.cache.first(); // Adapt selon ta config, ou passe l’ID en config

    if (!guild) return res.status(500).json({ error: "Guild introuvable" });

    const member = await guild.members.fetch(discordId).catch(() => null);

    if (!member) {
      return res.status(404).json({ displayName: null });
    }

    // renvoie le displayName ou le username si displayName vide
    res.json({ displayName: member.displayName || member.user.username });
  } catch (err) {
    console.error("Erreur API /api/user/:discordId", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;
