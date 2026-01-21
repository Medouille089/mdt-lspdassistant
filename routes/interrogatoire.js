const express = require("express");
const router = express.Router();
router.use(express.urlencoded({ extended: true }));
const pool = require("../config/db");
const config = require("../config/config");
const { getBot } = require("../config/config");
const { EmbedBuilder } = require("discord.js");

// GET - Liste des rapports d'interrogatoire avec pagination et recherche
router.get("/api/rapports-interrogatoire", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const dateStart = req.query.dateStart || '';
        const dateEnd = req.query.dateEnd || '';
        const citoyenId = req.query.citoyenId;
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let params = [];
        let paramIndex = 1;

        if (search) {
            whereConditions.push(`(
                officier_redacteur ILIKE $${paramIndex} OR 
                citoyen_nom ILIKE $${paramIndex} OR 
                citoyen_prenom ILIKE $${paramIndex} OR
                recit ILIKE $${paramIndex}
            )`);
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (citoyenId && !isNaN(parseInt(citoyenId))) {
            whereConditions.push(`citoyen_id = $${paramIndex}`);
            params.push(parseInt(citoyenId));
            paramIndex++;
        }

        if (dateStart) {
            whereConditions.push(`date_interrogatoire >= $${paramIndex}`);
            params.push(dateStart);
            paramIndex++;
        }

        if (dateEnd) {
            whereConditions.push(`date_interrogatoire <= $${paramIndex}`);
            params.push(dateEnd);
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0 
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        // Compter le total
        const countQuery = `SELECT COUNT(*) FROM lspd_rapports_interrogatoire ${whereClause}`;
        const countResult = await pool.query(countQuery, params);
        const totalRecords = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalRecords / limit);

        // Récupérer les rapports
        params.push(limit, offset);
        const dataQuery = `
            SELECT * FROM lspd_rapports_interrogatoire 
            ${whereClause}
            ORDER BY date_interrogatoire DESC, heure_interrogatoire DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        
        console.log(`[DEBUG-BACK] Query: ${dataQuery}`);
        console.log(`[DEBUG-BACK] Params:`, params);
        
        const dataResult = await pool.query(dataQuery, params);

        res.json({
            reports: dataResult.rows,
            totalPages,
            currentPage: page,
            totalRecords
        });

    } catch (error) {
        console.error("Erreur chargement rapports interrogatoire:", error);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// GET - Un rapport spécifique
router.get("/api/rapports-interrogatoire/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            "SELECT * FROM lspd_rapports_interrogatoire WHERE id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Rapport non trouvé" });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error("Erreur chargement rapport:", error);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// POST - Créer un nouveau rapport
router.post("/api/rapports-interrogatoire", async (req, res) => {
    const bot = getBot();
    const conf = await config.getConfig();
    const logsChannelId = conf.logs_interrogatoires;

    try {
        const {
            date_interrogatoire,
            heure_interrogatoire,
            officier_redacteur,
            grade_redacteur,
            citoyen_id,
            citoyen_nom,
            citoyen_prenom,
            citoyen_date_naissance,
            droits_cites,
            recit,
            infos_complementaires
        } = req.body;

        // Validation
        if (!date_interrogatoire || !heure_interrogatoire || !citoyen_id || !recit) {
            return res.status(400).json({ error: "Champs obligatoires manquants" });
        }

        const result = await pool.query(
            `INSERT INTO lspd_rapports_interrogatoire (
                date_interrogatoire, heure_interrogatoire, 
                officier_redacteur, grade_redacteur,
                citoyen_id, citoyen_nom, citoyen_prenom, citoyen_date_naissance,
                droits_cites, recit, infos_complementaires,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
            RETURNING *`,
            [
                date_interrogatoire, heure_interrogatoire,
                officier_redacteur, grade_redacteur,
                citoyen_id, citoyen_nom, citoyen_prenom, citoyen_date_naissance,
                droits_cites, recit, infos_complementaires
            ]
        );

        const rapport = result.rows[0];

        // Envoi d'un log Discord si configuré
        if (logsChannelId) {
            try {
                const logsChannel = await bot.channels.fetch(logsChannelId);
                const botUser = await bot.user;

                const embed = new EmbedBuilder()
                    .setTitle("📝 Nouveau rapport d'interrogatoire")
                    .addFields(
                        { name: "ID", value: `#${rapport.id}`, inline: true },
                        { name: "Date", value: new Date(date_interrogatoire).toLocaleDateString('fr-FR'), inline: true },
                        { name: "Heure", value: heure_interrogatoire, inline: true },
                        { name: "Officier", value: `${officier_redacteur} (${grade_redacteur})`, inline: true },
                        { name: "Personne interrogée", value: `${citoyen_prenom} ${citoyen_nom}`, inline: true },
                        { name: "Droits cités", value: droits_cites ? "Oui" : "Non", inline: true }
                    )
                    .setColor(0x0b1b5a)
                    .setFooter({
                        text: "LSPD Assistant",
                        iconURL: botUser.displayAvatarURL()
                    })
                    .setTimestamp();

                await logsChannel.send({ embeds: [embed] });
            } catch (discordError) {
                console.error("Erreur envoi log Discord:", discordError);
            }
        }

        res.status(201).json(rapport);

    } catch (error) {
        console.error("Erreur création rapport:", error);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// PUT - Mettre à jour un rapport
router.put("/api/rapports-interrogatoire/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const {
            date_interrogatoire,
            heure_interrogatoire,
            officier_redacteur,
            grade_redacteur,
            citoyen_id,
            citoyen_nom,
            citoyen_prenom,
            citoyen_date_naissance,
            droits_cites,
            recit,
            infos_complementaires
        } = req.body;

        // Validation
        if (!date_interrogatoire || !heure_interrogatoire || !citoyen_id || !recit) {
            return res.status(400).json({ error: "Champs obligatoires manquants" });
        }

        const result = await pool.query(
            `UPDATE lspd_rapports_interrogatoire SET
                date_interrogatoire = $1,
                heure_interrogatoire = $2,
                officier_redacteur = $3,
                grade_redacteur = $4,
                citoyen_id = $5,
                citoyen_nom = $6,
                citoyen_prenom = $7,
                citoyen_date_naissance = $8,
                droits_cites = $9,
                recit = $10,
                infos_complementaires = $11
            WHERE id = $12
            RETURNING *`,
            [
                date_interrogatoire, heure_interrogatoire,
                officier_redacteur, grade_redacteur,
                citoyen_id, citoyen_nom, citoyen_prenom, citoyen_date_naissance,
                droits_cites, recit, infos_complementaires, id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Rapport non trouvé" });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error("Erreur mise à jour rapport:", error);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// DELETE - Supprimer un rapport
router.delete("/api/rapports-interrogatoire/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "DELETE FROM lspd_rapports_interrogatoire WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Rapport non trouvé" });
        }

        res.json({ message: "Rapport supprimé avec succès" });

    } catch (error) {
        console.error("Erreur suppression rapport:", error);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

module.exports = router;
