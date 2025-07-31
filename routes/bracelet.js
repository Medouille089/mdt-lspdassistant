const express = require("express");
const router = express.Router();
const path = require("path");
const fetch = require("node-fetch");
const pool = require("../config/db");
const bot = require("../config/bot");
const config = require("../config/config");
const { checkAuth } = require("../config/middleware");
const { formatDate, formatDateFR } = require("../utils/formatDate");
const createForumPost = require("../utils/createForumPost");
const { WEBHOOK_BRACELET } = require("../config/env");

const { EmbedBuilder } = require("discord.js");

// Redirige "/" vers "/login"
router.get("/", (req, res) => {
    res.redirect("/login");
});

// Affiche la page protégée (dashboard)
router.get("/protected", checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, "..", "LSPD", "dashboard.html"));
});

// Route GET – Fournit l'URL du webhook
router.get('/api/webhook-url', (req, res) => {
    res.json({ webhook: WEBHOOK_BRACELET });
});

// Route POST – Enregistrement d’un nouveau bracelet
router.post('/api/formulaire', checkAuth, async (req, res) => {
    const { nom, prenom, tel, motif, dateDebut } = req.body;
    const user = req.user;
    if (!user) {
        return res.status(401).json({ error: "Utilisateur non connecté" });
    }

    console.log('Données reçues:', { nom, prenom, tel, motif, dateDebut });

    try {
        const { rows: rows1 } = await pool.query("SELECT id_brac FROM bracelets");
        const { rows: rows2 } = await pool.query("SELECT id_brac FROM historiqueBracelets");

        console.log('IDs existants bracelets:', rows1.length, 'historique:', rows2.length);

        const allIds = [...rows1, ...rows2]
            .map(r => parseInt(r.id_brac.replace("BRAC", "")))
            .filter(n => !isNaN(n));
        const nextNum = (Math.max(0, ...allIds) + 1).toString().padStart(4, '0');
        const id_brac = `BRAC${nextNum}`;

        console.log('ID généré:', id_brac);

        await pool.query(
            `INSERT INTO bracelets (nom, prenom, tel, date_debut, id_brac, motif)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [nom, prenom, tel, dateDebut, id_brac, motif]
        );

        console.log('Insertion en base OK');

        const port = process.env.PORT || 3001;
        const response = await fetch(`http://localhost:${port}/api/create-post`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-internal": "true"
            },
            body: JSON.stringify({ id_brac, nom, prenom, tel, motif, dateDebut })
        });

        console.log('Réponse POST create-post:', response.status);

        const data = await response.json();
        let threadId;
        if (response.ok && data.threadId) {
            threadId = data.threadId;
            await pool.query(
                'UPDATE bracelets SET id_thread = $1 WHERE id_brac = $2',
                [threadId, id_brac]
            );
            console.log('Mise à jour thread ID OK');
        }
        const mentionThread = threadId ? `<#${threadId}>` : 'Thread inconnu';

        const conf = await config.getConfig();
        if (conf.logs_channel) {
            const logsChannel = await bot.channels.fetch(conf.logs_channel);

            if (logsChannel?.isTextBased()) {
                const embedLog = new EmbedBuilder()
                    .setColor(0x0b1b5a)
                    .setTitle(`Nouveau bracelet - ${id_brac}`)
                    .setDescription(`<@${user.id}> a ajouté un nouveau bracelet - ${mentionThread} \`${id_brac}\``)
                    .addFields({
                        name: "ID's",
                        value: `> <@${req.user.id}> (\`${req.user.id}\`) \n> ${mentionThread} (\`${threadId}\`)`,
                        inline: false
                    })
                    .setFooter({
                        text: "LSPD Assistant",
                        iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 })
                    })
                    .setTimestamp();

                await logsChannel.send({ embeds: [embedLog] });
                console.log('Log bot envoyé dans LOGS_CHANNEL');
            }
        }

        res.status(201).json({ message: 'Bracelet enregistré', id_brac });
    } catch (err) {
        console.error("Erreur insertion :", err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// Route POST – Création d’un post (thread Discord)
router.post('/api/create-post', async (req, res) => {
    console.log("POST /api/create-post reçu avec body:", req.body);
    const { id_brac, nom, prenom, tel, motif, dateDebut } = req.body;

    try {
        const formattedDateDebut = formatDate(dateDebut);
        const threadTitle = `${id_brac} - ${nom} ${prenom} - ${formattedDateDebut}`;

        const embedPayload = {
            embeds: [{
                title: "Nouveau bracelet",
                color: 0x0b1b5a,
                fields: [
                    { name: "ID Bracelet", value: id_brac, inline: true },
                    { name: "Nom", value: nom, inline: true },
                    { name: "Prénom", value: prenom, inline: true },
                    { name: "Motif", value: motif, inline: true },
                    { name: "Téléphone", value: tel, inline: false },
                    {
                        name: "Date d'activation",
                        value: `**${formattedDateDebut}**`,
                        inline: false
                    }
                ],
                footer: {
                    text: "LSPD Assistant",
                    icon_url: bot.user.displayAvatarURL({ extension: 'png', size: 256 })
                },
                thumbnail: {
                    url: bot.user.displayAvatarURL({ extension: 'png', size: 256 })
                },
                timestamp: new Date().toISOString()
            }]
        };

        const conf = await config.getConfig();
        const thread = await createForumPost(bot, conf.thread_id, threadTitle, embedPayload);

        console.log(`🧵 Thread créé avec l'ID : ${thread.id}`);

        res.json({ message: `✅ Post créé : ${thread.name}`, threadId: thread.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '❌ Erreur lors de la création du post.' });
    }
});

// Route GET – Récupère tous les bracelets actifs
router.get('/api/formulaires', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, id_brac, nom, prenom, tel, date_debut, motif FROM bracelets ORDER BY id DESC');
        res.json(result.rows.map(row => ({
            id: row.id,
            id_brac: row.id_brac,
            nom: row.nom,
            prenom: row.prenom,
            tel: row.tel,
            motif: row.motif,
            dateDebut: row.date_debut.toLocaleDateString('fr-CA'),
        })));
    } catch (err) {
        console.error('Erreur GET /api/formulaires:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route PUT – Met à jour un bracelet existant
router.put('/api/formulaires/:id', checkAuth, async (req, res) => {
    const user = req.user;
    const id = req.params.id;
    const { nom, prenom, tel, dateDebut, motif } = req.body;

    try {
        // Récupérer les données actuelles
        const { rows } = await pool.query(
            'SELECT id_thread, id_brac, nom AS old_nom, prenom AS old_prenom, date_debut AS old_date_debut FROM bracelets WHERE id = $1',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Bracelet non trouvé' });
        }

        const { id_thread: threadId, id_brac, old_nom, old_prenom, old_date_debut } = rows[0];
        const mentionThread = threadId ? `<#${threadId}>` : 'Thread inconnu';

        // Mettre à jour le bracelet
        await pool.query(
            'UPDATE bracelets SET nom=$1, prenom=$2, tel=$3, date_debut=$4, motif=$5 WHERE id=$6',
            [nom, prenom, tel, dateDebut, motif, id]
        );

        const dateDebutFormatted = formatDateFR(dateDebut);
        const oldDateFormatted = formatDateFR(old_date_debut);

        // Mise à jour du thread Discord s'il existe
        if (threadId) {
            const thread = await bot.channels.fetch(threadId);
            if (thread?.isThread()) {
                const shouldRename = (
                    nom !== old_nom ||
                    prenom !== old_prenom ||
                    dateDebutFormatted !== oldDateFormatted
                );

                if (shouldRename) {
                    const newThreadName = `${id_brac} - ${nom} ${prenom} - ${dateDebutFormatted}`;
                    await thread.setName(newThreadName);
                    console.log(`🔄 Thread renommé : ${newThreadName}`);
                }

                const embed = new EmbedBuilder()
                    .setTitle("Bracelet modifié")
                    .setColor(0x0b1b5a)
                    .addFields(
                        { name: "ID Bracelet", value: id_brac, inline: true },
                        { name: "Nom", value: nom || '—', inline: true },
                        { name: "Prénom", value: prenom || '—', inline: true },
                        { name: "Motif", value: motif || '—', inline: true },
                        { name: "Téléphone", value: tel || '—', inline: false },
                        {
                            name: "Date d'activation",
                            value: `**${dateDebutFormatted || '—'}**`,
                            inline: false
                        }
                    )
                    .setFooter({
                        text: "LSPD Assistant",
                        iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 })
                    })
                    .setThumbnail(bot.user.displayAvatarURL({ extension: 'png', size: 256 }))
                    .setTimestamp();

                await thread.send({ embeds: [embed] });

                // Log modification dans LOGS_CHANNEL
                const conf = await config.getConfig();
                if (conf.logs_channel) {
                    const logsChannel = await bot.channels.fetch(conf.logs_channel);
                    if (logsChannel?.isTextBased()) {
                        const embedLog = new EmbedBuilder()
                            .setColor(0x0b1b5a)
                            .setTitle(`Bracelet modifié - ${id_brac}`)
                            .setDescription(`<@${user.id}> a modifié un bracelet - ${mentionThread} \`${id_brac}\``)
                            .addFields({
                                name: "ID's",
                                value: `> <@${req.user.id}> (\`${req.user.id}\`) \n> ${mentionThread} (\`${threadId}\`)`,
                                inline: false
                            })
                            .setFooter({
                                text: "LSPD Assistant",
                                iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 })
                            })
                            .setTimestamp();

                        await logsChannel.send({ embeds: [embedLog] });
                        console.log('Log modification envoyé');
                    }
                }
            }
        }

        res.json({ message: "Bracelet mis à jour avec succès" });
    } catch (err) {
        console.error('Erreur PUT /api/formulaires/:id:', err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// Route DELETE – Supprime un bracelet actif et le transfère dans l'historique
router.delete('/api/formulaires/:id', checkAuth, async (req, res) => {
    const id = req.params.id;

    // Récupérer client Discord ET connexion PG séparément
    const clientDiscord = config.getBot();
    const dbClient = await pool.connect();

    try {
        await dbClient.query('BEGIN');

        const { rows } = await dbClient.query("SELECT * FROM bracelets WHERE id = $1", [id]);
        if (rows.length === 0) {
            await dbClient.query('ROLLBACK');
            return res.status(404).json({ error: 'Non trouvé' });
        }

        const data = rows[0];

        // Insérer dans historique
        await dbClient.query(
            `INSERT INTO historiqueBracelets (nom, prenom, tel, date_debut, id_brac, motif, id_thread)
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [data.nom, data.prenom, data.tel, data.date_debut, data.id_brac, data.motif, data.id_thread]
        );

        // Supprimer de bracelets
        await dbClient.query("DELETE FROM bracelets WHERE id = $1", [id]);

        await dbClient.query('COMMIT');

        // Gestion thread Discord
        const conf = await config.getConfig();
        if (data.id_thread && conf.archive_tag) {
            try {
                const thread = await clientDiscord.channels.fetch(data.id_thread);
                if (thread?.isThread()) {
                    await thread.setAppliedTags([conf.archive_tag]);

                    const embed = new EmbedBuilder()
                        .setTitle("Bracelet archivé")
                        .setColor(0x0b1b5a)
                        .addFields(
                            { name: "ID Bracelet", value: data.id_brac, inline: true },
                            { name: "Nom", value: data.nom || '—', inline: true },
                            { name: "Prénom", value: data.prenom || '—', inline: true },
                            { name: "Motif", value: data.motif || '—', inline: true },
                            { name: "Téléphone", value: data.tel || '—', inline: false },
                            {
                                name: "Date d'activation",
                                value: `**${formatDateFR(data.date_debut) || '—'}**`,
                                inline: false
                            }
                        )
                        .setFooter({
                            text: "LSPD Assistant",
                            iconURL: clientDiscord.user.displayAvatarURL({ extension: 'png', size: 256 })
                        })
                        .setThumbnail(clientDiscord.user.displayAvatarURL({ extension: 'png', size: 256 }))
                        .setTimestamp();

                    await thread.send({ embeds: [embed] });

                    // Log archivage dans LOGS_CHANNEL
                    if (conf.logs_channel) {
                        const logsChannel = await clientDiscord.channels.fetch(conf.logs_channel);
                        if (logsChannel?.isTextBased()) {
                            const mentionThread = data.id_thread ? `<#${data.id_thread}>` : 'Thread inconnu';

                            const embedLog = new EmbedBuilder()
                                .setColor(0x0b1b5a)
                                .setTitle(`Archive bracelet - ${data.id_brac}`)
                                .setDescription(`<@${req.user.id}> a archivé le bracelet - ${mentionThread} \`${data.id_brac}\``)
                                .addFields({
                                    name: "ID's",
                                    value: `> <@${req.user.id}> (\`${req.user.id}\`) \n > ${mentionThread} (\`${data.id_thread}\`)`,
                                    inline: false
                                })
                                .setFooter({
                                    text: "LSPD Assistant",
                                    iconURL: clientDiscord.user.displayAvatarURL({ extension: 'png', size: 256 })
                                })
                                .setTimestamp();
                            await logsChannel.send({ embeds: [embedLog] });
                        }
                    }
                } else {
                    console.warn(`Thread ${data.id_thread} introuvable ou non valide.`);
                }
            } catch (e) {
                console.error("Erreur lors de la gestion du thread Discord :", e);
            }
        }

        res.sendStatus(200);
    } catch (e) {
        await dbClient.query('ROLLBACK');
        console.error("Erreur DELETE /api/formulaires/:id:", e);
        res.status(500).json({ error: "Erreur serveur" });
    } finally {
        dbClient.release();
    }
});


// Route GET – Récupère tout l’historique des bracelets archivés
router.get('/api/historique', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM historiqueBracelets ORDER BY id DESC');
        const data = result.rows.map(row => ({
            id: row.id,
            nom: row.nom,
            prenom: row.prenom,
            tel: row.tel,
            motif: row.motif,
            dateDebut: new Date(row.date_debut).toLocaleDateString('fr-CA'),
            id_brac: row.id_brac
        }));
        res.json(data);
    } catch (err) {
        console.error("Erreur chargement historique :", err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route GET – Génère le prochain ID BRAC à afficher
router.get('/api/next-id-brac', async (req, res) => {
    try {
        const { rows: histo } = await pool.query(`SELECT id_brac FROM historiqueBracelets ORDER BY id_brac DESC LIMIT 1`);
        const { rows: actifs } = await pool.query(`SELECT id_brac FROM bracelets ORDER BY id_brac DESC LIMIT 1`);

        const lastId = [...histo, ...actifs]
            .map(r => parseInt(r.id_brac.replace('BRAC', '')))
            .sort((a, b) => b - a)[0] || 0;

        const nextId = lastId + 1;
        const formattedId = 'BRAC' + nextId.toString().padStart(4, '0');
        res.json({ id_brac: formattedId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur génération ID' });
    }
});

router.post('/api/formulaires/pointer/:id', async (req, res) => {
    const id = req.params.id;
    const user = req.user

    const clientDiscord = config.getBot();

    try {
        const conf = await config.getConfig();
        const { rows } = await pool.query(
            'SELECT id_thread, id_brac, nom, prenom FROM bracelets WHERE id = $1',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Bracelet non trouvé' });
        }

        const data = rows[0];

        if (!data.id_thread) {
            return res.status(400).json({ error: 'Aucun thread Discord associé' });
        }

        const thread = await bot.channels.fetch(data.id_thread);
        if (!thread?.isThread()) {
            return res.status(404).json({ error: 'Thread Discord introuvable ou invalide' });
        }

        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR');
        const heureStr = now.toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        const embed = new EmbedBuilder()
            .setTitle("📍 Bracelet pointé")
            .setColor(0x2ECC71)
            .addFields(
                { name: "ID Bracelet", value: data.id_brac, inline: true },
                { name: "Nom", value: data.nom || '—', inline: true },
                { name: "Prénom", value: data.prenom || '—', inline: true },
                { name: "Date", value: dateStr, inline: true },
                { name: "Heure", value: heureStr, inline: true },
                { name: "Pointé par", value: `<@${user.id}>`, inline: false }
            )
            .setFooter({
                text: user.guild_member.nick,
                iconURL: bot.user.displayAvatarURL({ extension: 'png', size: 256 })
            })
            .setThumbnail(bot.user.displayAvatarURL({ extension: 'png', size: 256 }))
            .setTimestamp();

        await thread.send({ embeds: [embed] });
        // Log axrchivage dans LOGS_CHANNEL
        if (conf.logs_channel) {
            const logsChannel = await clientDiscord.channels.fetch(conf.logs_channel);
            if (logsChannel?.isTextBased()) {
                const mentionThread = data.id_thread ? `<#${data.id_thread}>` : 'Thread inconnu';

                const embedLog = new EmbedBuilder()
                    .setColor(0x0b1b5a)
                    .setTitle(`Bracelet pointé - ${data.id_brac}`)
                    .setDescription(`<@${req.user.id}> a pointé le bracelet - ${mentionThread} \`${data.id_brac}\``)
                    .addFields({
                        name: "ID's",
                        value: `> <@${req.user.id}> (${req.user.id}) \n > ${mentionThread} (\`${data.id_thread}\`)`,
                        inline: false
                    })
                    .setFooter({
                        text: "LSPD Assistant",
                        iconURL: clientDiscord.user.displayAvatarURL({ extension: 'png', size: 256 })
                    })
                    .setTimestamp();
                await logsChannel.send({ embeds: [embedLog] });
            }
        }

        res.json({ message: 'Pointage envoyé dans le thread Discord.' });
    } catch (err) {
        console.error('Erreur lors du pointage :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
