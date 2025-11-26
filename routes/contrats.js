const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const bot = require("../config/bot");
const config = require("../config/config");
const { checkAuth } = require("../config/middleware");
const { AttachmentBuilder, EmbedBuilder } = require("discord.js");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/contrats - Liste de tous les contrats
router.get('/api/contrats', checkAuth, async (req, res) => {
    try {
        const { search, statut, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT *
            FROM contrats
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        // Filtre de recherche (entreprise, numéro)
        if (search) {
            query += ` AND (LOWER(nom_entreprise) LIKE $${paramIndex} OR LOWER(numero_contrat) LIKE $${paramIndex})`;
            params.push(`%${search.toLowerCase()}%`);
            paramIndex++;
        }

        // Filtre statut
        if (statut) {
            if (statut === 'resilie') {
                query += ` AND (statut = $${paramIndex} OR statut = 'Résilié')`;
                params.push('resilie');
            } else {
                query += ` AND statut = $${paramIndex}`;
                params.push(statut);
            }
            paramIndex++;
        }

        // Order by
        query += ' ORDER BY created_at DESC';

        // Pagination
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), parseInt(offset));

        const { rows } = await pool.query(query, params);

        // Compter le total pour la pagination
        let countQuery = 'SELECT COUNT(*) FROM contrats WHERE 1=1';
        const countParams = [];
        let countParamIndex = 1;

        if (search) {
            countQuery += ` AND (LOWER(nom_entreprise) LIKE $${countParamIndex} OR LOWER(numero_contrat) LIKE $${countParamIndex})`;
            countParams.push(`%${search.toLowerCase()}%`);
            countParamIndex++;
        }

        if (statut) {
            if (statut === 'resilie') {
                countQuery += ` AND (statut = $${countParamIndex} OR statut = 'Résilié')`;
                countParams.push('resilie');
            } else {
                countQuery += ` AND statut = $${countParamIndex}`;
                countParams.push(statut);
            }
        }

        const { rows: countRows } = await pool.query(countQuery, countParams);
        const total = parseInt(countRows[0].count);

        res.json({
            contrats: rows,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des contrats:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération des contrats' });
    }
});

// GET /api/contrats/:id - Détails d'un contrat
router.get('/api/contrats/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const { rows } = await pool.query(
            'SELECT * FROM contrats WHERE id = $1',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Contrat non trouvé' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Erreur lors de la récupération du contrat:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la récupération du contrat' });
    }
});

// POST /api/contrats - Créer un nouveau contrat
router.post('/api/contrats', checkAuth, async (req, res) => {
    try {
        const {
            nom_entreprise,
            representant_entreprise,
            contact_entreprise,
            date_debut,
            date_fin,
            duree_mois,
            objet_contrat,
            clauses,
            statut,
            officier_responsable,
            grade_officier
        } = req.body;

        const username = req.session?.user?.username || 'Inconnu';

        // Générer le numéro de contrat
        const { rows: countRows } = await pool.query('SELECT COUNT(*) FROM contrats');
        const count = parseInt(countRows[0].count, 10) + 1;
        const numero_contrat = `CNT${count.toString().padStart(4, '0')}`;

        const query = `
            INSERT INTO contrats (
                numero_contrat, nom_entreprise, representant_entreprise, contact_entreprise,
                date_debut, date_fin, duree_mois, objet_contrat, clauses, statut,
                officier_responsable, grade_officier, created_by, updated_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
        `;

        const { rows } = await pool.query(query, [
            numero_contrat,
            nom_entreprise,
            representant_entreprise || null,
            contact_entreprise || null,
            date_debut,
            date_fin,
            duree_mois,
            objet_contrat,
            JSON.stringify(clauses || []),
            statut || 'actif',
            officier_responsable,
            grade_officier || null,
            username,
            username
        ]);

        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Erreur lors de la création du contrat:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la création du contrat' });
    }
});

// PUT /api/contrats/:id - Modifier un contrat
router.put('/api/contrats/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            nom_entreprise,
            representant_entreprise,
            contact_entreprise,
            date_debut,
            date_fin,
            duree_mois,
            objet_contrat,
            clauses,
            statut,
            officier_responsable,
            grade_officier
        } = req.body;

        const username = req.session?.user?.username || 'Inconnu';

        // Vérifier que le contrat existe
        const { rows: existingRows } = await pool.query(
            'SELECT * FROM contrats WHERE id = $1',
            [id]
        );

        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Contrat non trouvé' });
        }

        const query = `
            UPDATE contrats
            SET nom_entreprise = $1,
                representant_entreprise = $2,
                contact_entreprise = $3,
                date_debut = $4,
                date_fin = $5,
                duree_mois = $6,
                objet_contrat = $7,
                clauses = $8,
                statut = $9,
                officier_responsable = $10,
                grade_officier = $11,
                updated_by = $12
            WHERE id = $13
            RETURNING *
        `;

        const { rows } = await pool.query(query, [
            nom_entreprise,
            representant_entreprise || null,
            contact_entreprise || null,
            date_debut,
            date_fin,
            duree_mois,
            objet_contrat,
            JSON.stringify(clauses || []),
            statut,
            officier_responsable,
            grade_officier || null,
            username,
            id
        ]);

        // Log Discord
        try {
            const conf = await config.getConfig();
            const logsChannelId = conf.logs_contrats;

            if (logsChannelId) {
                const logsChannel = await bot.channels.fetch(logsChannelId);
                const embed = new EmbedBuilder()
                    .setTitle('Contrat modifié')
                    .setColor('#FFA500')
                    .addFields(
                        { name: 'Numéro', value: existingRows[0].numero_contrat, inline: true },
                        { name: 'Entreprise', value: nom_entreprise, inline: true },
                        { name: 'Statut', value: statut, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: `Modifié par ${username}` });

                await logsChannel.send({ embeds: [embed] });
            }
        } catch (logError) {
            console.error('Erreur lors de l\'envoi du log Discord:', logError);
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Erreur lors de la modification du contrat:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la modification du contrat' });
    }
});

// POST /api/contrats/:id/image - Upload de l'image du contrat pour Discord
router.post('/api/contrats/:id/image', checkAuth, upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'Aucune image fournie' });
        }

        const { rows } = await pool.query('SELECT * FROM contrats WHERE id = $1', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Contrat non trouvé' });
        const contrat = rows[0];

        const conf = await config.getConfig();
        const logsChannelId = conf.logs_contrats;
        const threadChannelId = conf.contrats_thread_id;

        const embed = new EmbedBuilder()
            .setTitle('Nouveau contrat créé')
            .setColor('#00FF00')
            .addFields(
                { name: 'Numéro', value: contrat.numero_contrat, inline: true },
                { name: 'Entreprise', value: contrat.nom_entreprise, inline: true },
                { name: 'Durée', value: `${contrat.duree_mois} mois`, inline: true },
                { name: 'Officier', value: contrat.officier_responsable, inline: true },
                { name: 'Statut', value: contrat.statut || 'actif', inline: true },
                { name: 'Contact', value: contrat.contact_entreprise || 'N/A', inline: true }
            )
            .setDescription(`**Objet:** ${contrat.objet_contrat}`)
            .setTimestamp()
            .setFooter({ text: `Créé par ${contrat.created_by}` });

        const attachment = new AttachmentBuilder(file.buffer, { name: file.originalname });

        let threadId = null;

        if (threadChannelId) {
            const threadChannel = await bot.channels.fetch(threadChannelId);
            let targetThread;

            // Trouver le thread existant
            try {
                if (threadChannel.type === 15) { // GUILD_FORUM
                    const threads = await threadChannel.threads.fetch();
                    targetThread = threads.threads.find(t => t.name.startsWith(contrat.numero_contrat));
                } else {
                    const threads = await threadChannel.threads.fetch();
                    targetThread = threads.threads.find(t => t.name.startsWith(contrat.numero_contrat));
                }
            } catch (e) {
                console.error('Erreur fetch threads:', e);
            }

            if (targetThread) {
                await targetThread.send({ files: [attachment] });
                threadId = targetThread.id;
            } else {
                // Création du thread avec Embed + Image
                if (threadChannel.type === 15) { // GUILD_FORUM
                    const thread = await threadChannel.threads.create({
                        name: `${contrat.numero_contrat} - ${contrat.nom_entreprise}`,
                        message: {
                            embeds: [embed],
                            files: [attachment]
                        }
                    });
                    threadId = thread.id;
                } else {
                    const thread = await threadChannel.threads.create({
                        name: `${contrat.numero_contrat} - ${contrat.nom_entreprise}`,
                        autoArchiveDuration: 10080, // 1 semaine
                        reason: 'Nouveau contrat'
                    });
                    await thread.send({ embeds: [embed], files: [attachment] });
                    threadId = thread.id;
                }
            }
        }

        // Log simple
        if (logsChannelId) {
            try {
                const logsChannel = await bot.channels.fetch(logsChannelId);
                const mentionThread = threadId ? `<#${threadId}>` : 'Aucun thread';
                const user = req.user || {};
                const userName = user.guild_member?.nick || user.displayName || user.username || 'Utilisateur inconnu';
                const userId = user.id || 'Inconnu';

                const embedLog = new EmbedBuilder()
                    .setColor(0x0b1b5a)
                    .setTitle(`Nouveau contrat - ${contrat.numero_contrat}`)
                    .setDescription(`${userName} a créé un nouveau contrat pour **${contrat.nom_entreprise}**`)
                    .addFields({
                        name: "ID's",
                        value: `> <@${userId}> (\`${userId}\`)\n> ${mentionThread} (\`${threadId || 'N/A'}\`)`,
                        inline: false
                    })
                    .addFields({
                        name: "Détails",
                        value: `> **Entreprise:** ${contrat.nom_entreprise}\n> **Durée:** ${contrat.duree_mois} mois\n> **Officier:** ${contrat.officier_responsable}`,
                        inline: false
                    })
                    .setFooter({
                        text: "LSPD Assistant",
                        iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 })
                    })
                    .setTimestamp();

                await logsChannel.send({ embeds: [embedLog] });
            } catch (e) {
                console.error('Erreur log channel:', e);
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur upload image contrat:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/contrats/:id/terminate - Résilier un contrat
router.post('/api/contrats/:id/terminate', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const username = req.session?.user?.username || 'Inconnu';

        const { rows } = await pool.query(
            'UPDATE contrats SET statut = $1, updated_by = $2 WHERE id = $3 RETURNING *',
            ['resilie', username, id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Contrat non trouvé' });
        }

        // Log Discord
        try {
            const conf = await config.getConfig();
            const logsChannelId = conf.logs_contrats;

            if (logsChannelId) {
                const logsChannel = await bot.channels.fetch(logsChannelId);
                const user = req.user || {};
                const userName = user.guild_member?.nick || user.displayName || user.username || 'Utilisateur inconnu';
                const userId = user.id || 'Inconnu';

                const embedLog = new EmbedBuilder()
                    .setColor(0x0b1b5a)
                    .setTitle(`Contrat résilié - ${rows[0].numero_contrat}`)
                    .setDescription(`${userName} a résilié le contrat de **${rows[0].nom_entreprise}**`)
                    .addFields({
                        name: "ID's",
                        value: `> <@${userId}> (\`${userId}\`)`,
                        inline: false
                    })
                    .setFooter({
                        text: "LSPD Assistant",
                        iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 })
                    })
                    .setTimestamp();

                await logsChannel.send({ embeds: [embedLog] });
            }
        } catch (logError) {
            console.error('Erreur lors de l\'envoi du log Discord:', logError);
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Erreur lors de la résiliation du contrat:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la résiliation du contrat' });
    }
});

// DELETE /api/contrats/:id - Supprimer un contrat
router.delete('/api/contrats/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const username = req.session?.user?.username || 'Inconnu';

        // Récupérer les infos avant suppression
        const { rows: existingRows } = await pool.query(
            'SELECT * FROM contrats WHERE id = $1',
            [id]
        );

        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Contrat non trouvé' });
        }

        await pool.query('DELETE FROM contrats WHERE id = $1', [id]);

        // Log Discord
        try {
            const conf = await config.getConfig();
            const logsChannelId = conf.logs_contrats;

            if (logsChannelId) {
                const logsChannel = await bot.channels.fetch(logsChannelId);
                const user = req.user || {};
                const userName = user.guild_member?.nick || user.displayName || user.username || 'Utilisateur inconnu';
                const userId = user.id || 'Inconnu';

                const embedLog = new EmbedBuilder()
                    .setColor(0x0b1b5a)
                    .setTitle(`Contrat supprimé - ${existingRows[0].numero_contrat}`)
                    .setDescription(`${userName} a supprimé le contrat de **${existingRows[0].nom_entreprise}**`)
                    .addFields({
                        name: "ID's",
                        value: `> <@${userId}> (\`${userId}\`)`,
                        inline: false
                    })
                    .setFooter({
                        text: "LSPD Assistant",
                        iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 })
                    })
                    .setTimestamp();

                await logsChannel.send({ embeds: [embedLog] });
            }
        } catch (logError) {
            console.error('Erreur lors de l\'envoi du log Discord:', logError);
        }

        res.json({ message: 'Contrat supprimé avec succès' });
    } catch (error) {
        console.error('Erreur lors de la suppression du contrat:', error);
        res.status(500).json({ error: 'Erreur serveur lors de la suppression du contrat' });
    }
});

module.exports = router;
