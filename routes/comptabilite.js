const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { checkAuth } = require("../config/middleware");
const { DateTime } = require("luxon");
const { getBot } = require("../config/config");

async function getUserGrade(userId) {
    try {
        const gradesConfig = await pool.query('SELECT * FROM lspd_grades LIMIT 1');
        if (gradesConfig.rows.length === 0) {
            return 'Agent';
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

        const bot = getBot();
        const guild = bot.guilds.cache.first();
        const member = await guild.members.fetch(userId).catch(() => null);

        if (!member) return 'Agent';

        const userRoles = member.roles.cache.map(r => r.id);

        for (const grade of gradeHierarchy) {
            if (userRoles.includes(grade.role_id)) {
                return grade.nom;
            }
        }

        return 'Agent';
    } catch (err) {
        console.error('Erreur récupération grade:', err);
        return 'Agent';
    }
}

function getBasePayByGrade(grade, hours) {
    if (hours < 3) return 0;

    const basePay = {
        'Rookie': 5000,
        'Officier I': 6000,
        'Officier II': 7000,
        'Officier III': 8000,
        'SLO': 9000,
        'Sergent I': 10000,
        'Sergent II': 11000,
        'Sergent Chef': 12000,
        'Lieutenant': 13000,
        'Lieutenant Chef': 14000,
        'Capitaine': 15000,
        'Commandant': 16000,
        'Chief': 17000
    };

    return basePay[grade] || 0;
}

router.get("/api/comptabilite", checkAuth, async (req, res) => {
    try {
        const nowParis = DateTime.now().setZone("Europe/Paris");
        const startOfWeek = nowParis.startOf("week").startOf("day");
        const endOfWeek = startOfWeek.plus({ days: 6 }).endOf("day");

        const startOfLastWeek = startOfWeek.minus({ weeks: 1 });
        const endOfLastWeek = startOfWeek.minus({ seconds: 1 });

        const query = `
      SELECT DISTINCT p.id_discord
      FROM lspd_pointage p
      WHERE p.start_time BETWEEN ? AND ?
         OR p.start_time BETWEEN ? AND ?
    `;

        const usersResult = await pool.query(query, [
            startOfLastWeek.toISO(),
            endOfLastWeek.toISO(),
            startOfWeek.toISO(),
            endOfWeek.toISO(),
        ]);

        const bot = getBot();
        const comptabiliteData = [];

        for (const userRow of usersResult.rows) {
            const userId = userRow.id_discord;

            let displayName = userId;
            try {
                const guild = bot.guilds.cache.first();
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member) {
                    displayName = member.displayName;
                }
            } catch (e) {
            }

            const grade = await getUserGrade(userId);

            const thisWeekQuery = `
        SELECT 
          COALESCE(SUM(p.salary_earned), 0) AS salary_this_week,
          COALESCE(SUM(TIMESTAMPDIFF(SECOND, p.start_time, COALESCE(p.end_time, NOW())) / 3600), 0) AS hours_this_week
        FROM lspd_pointage p
        WHERE p.id_discord = ? AND p.start_time BETWEEN ? AND ?
      `;
            const thisWeekResult = await pool.query(thisWeekQuery, [userId, startOfWeek.toISO(), endOfWeek.toISO()]);

            const lastWeekQuery = `
        SELECT 
          COALESCE(SUM(p.salary_earned), 0) AS salary_last_week,
          COALESCE(SUM(TIMESTAMPDIFF(SECOND, p.start_time, COALESCE(p.end_time, NOW())) / 3600), 0) AS hours_last_week
        FROM lspd_pointage p
        WHERE p.id_discord = ? AND p.start_time BETWEEN ? AND ?
      `;
            const lastWeekResult = await pool.query(lastWeekQuery, [userId, startOfLastWeek.toISO(), endOfLastWeek.toISO()]);

            const hoursThisWeek = parseFloat(thisWeekResult.rows[0].hours_this_week) || 0;
            const salaryThisWeek = parseFloat(thisWeekResult.rows[0].salary_this_week) || 0;
            const hoursLastWeek = parseFloat(lastWeekResult.rows[0].hours_last_week) || 0;
            const salaryLastWeek = parseFloat(lastWeekResult.rows[0].salary_last_week) || 0;

            // Capper les heures à 30h pour les calculs
            const cappedHoursThisWeek = Math.min(hoursThisWeek, 30);
            const cappedHoursLastWeek = Math.min(hoursLastWeek, 30);

            const basePayThisWeek = getBasePayByGrade(grade, cappedHoursThisWeek);
            const basePayLastWeek = getBasePayByGrade(grade, cappedHoursLastWeek);

            // Calculer le salaire horaire avec heures cappées (300$/h)
            const calculatedSalaryThisWeek = cappedHoursThisWeek * 300;
            const calculatedSalaryLastWeek = cappedHoursLastWeek * 300;

            const primeEssenceThisWeek = cappedHoursThisWeek * 333;
            const primeEssenceLastWeek = cappedHoursLastWeek * 333;

            comptabiliteData.push({
                discordId: userId,
                displayName: displayName,
                grade: grade,
                thisWeek: {
                    hours: hoursThisWeek.toFixed(2), // Heures réelles affichées
                    basePay: basePayThisWeek.toFixed(2),
                    hourlySalary: calculatedSalaryThisWeek.toFixed(2),
                    primeEssence: primeEssenceThisWeek.toFixed(2),
                },
                lastWeek: {
                    hours: hoursLastWeek.toFixed(2), // Heures réelles affichées
                    basePay: basePayLastWeek.toFixed(2),
                    hourlySalary: calculatedSalaryLastWeek.toFixed(2),
                    primeEssence: primeEssenceLastWeek.toFixed(2),
                }
            });
        }

        comptabiliteData.sort((a, b) => a.displayName.localeCompare(b.displayName));

        res.json(comptabiliteData);
    } catch (err) {
        console.error("Erreur /api/comptabilite :", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

module.exports = router;
