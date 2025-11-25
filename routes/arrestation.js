const express = require("express");
const router = express.Router();
router.use(express.urlencoded({ extended: true }));
const multer = require("multer");
const pool = require("../config/db");
const config = require("../config/config");
const { getBot } = require("../config/config");
const { AttachmentBuilder, EmbedBuilder, ChannelType } = require("discord.js");
const upload = multer({ storage: multer.memoryStorage() });

router.post("/api/arrestation", upload.any(), async (req, res) => {
    const bot = getBot();
    const conf = await config.getConfig();
    const forumChannelId = conf.arrestation_thread_id;
    const logsChannelId = conf.logs_arrestations;

    try {
        const {
            date, name, fileInput1, fileInput2, profession,
            DDN, address, tel, droits,
            entreecellule, sortiecellule, bracelet,
            miranda, avocat, nourriture, ems,
            avocatName, officer, grade, lieu,
            motifArrestation, circonstances, arme, uof,
            accusations, implique, rapports_lies
        } = req.body;

        const files = req.files;

        try {
            console.log('JSON.parse(rapports_lies):', JSON.parse(req.body.rapports_lies));
        } catch (err) {
            console.error('Erreur de parsing rapports_lies:', err);
        }

        const forum = await bot.channels.fetch(forumChannelId);
        const botUser = await bot.user;

        const { rows } = await pool.query("SELECT COUNT(*) FROM lspd_arrestations");
        const count = parseInt(rows[0].count, 10) + 1;
        const arrestationId = `ART${count.toString().padStart(4, "0")}`;

        // Construire la date formatée
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, "0");
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const yyyy = now.getFullYear();
        const hh = String(now.getHours()).padStart(2, "0");
        const min = String(now.getMinutes()).padStart(2, "0");
        const formattedDate = `${dd}/${mm}/${yyyy} ${hh}:${min}`;

        const isLocal = process.env.IS_LOCAL === "true";
        const baseUrl = isLocal
            ? "http://localhost:3001/viewArrestation.html"
            : "https://lspd-assistant.fr/viewArrestation.html";
        const arrestationLink = `${baseUrl}?id=${arrestationId}`;

        const embed = new EmbedBuilder()
            .setTitle("Nouveau rapport d'arrestation")
            .setThumbnail(botUser.displayAvatarURL({ extension: 'png' }))
            .addFields(
                { name: "ID d'arrestation", value: arrestationId },
                { name: "Date", value: formattedDate, inline: true },
                { name: "Individu", value: name, inline: true },
                { name: "Officier rédacteur", value: officer, inline: true },
                { name: "Avocat", value: avocatName || "Non précisé", inline: true },
                { name: "Accusations", value: JSON.parse(accusations || "[]").join("\n") || "Aucune", inline: true },
                { name: "Lieu", value: lieu || "Non précisé", inline: true },
                { name: "Consulter le dossier", value: `[Voir le dossier d'arrestation ${arrestationId}](${arrestationLink})` }
            )
            .setFooter({
                text: "LSPD Assistant",
                iconURL: botUser.displayAvatarURL()
            })
            .setColor(0x0b1b5a)
            .setTimestamp();

        const thread = await forum.threads.create({
            name: `${arrestationId} - ${formattedDate} - ${name}`,
            message: { embeds: [embed] },
            autoArchiveDuration: 1440,
        });

        // Envoi des images uniquement
        const imageFiles = (files || []).filter(f => f.mimetype && f.mimetype.startsWith("image/"));
        if (imageFiles.length) {
            const attachments = imageFiles.map(f => new AttachmentBuilder(f.buffer, { name: f.originalname }));
            await thread.send({ files: attachments }).catch(err => {
                console.error("Erreur envoi images au thread Discord :", err);
            });
        }

        let rapportsLiesValue = [];

        try {
            // Si le front a envoyé une string JSON -> parse
            if (typeof rapports_lies === "string" && rapports_lies.trim() !== "") {
                rapportsLiesValue = JSON.parse(rapports_lies);
            }
            // Si déjà tableau JS (par exemple, si envoyé via JSON)
            else if (Array.isArray(rapports_lies)) {
                rapportsLiesValue = rapports_lies;
            }
        } catch (err) {
            console.error("Erreur parsing rapports_lies:", err);
        }

        // DEBUG: affiche la valeur finale avant INSERT
        console.log("Valeur finale rapportsLiesValue:", rapportsLiesValue);


        await pool.query(`
            INSERT INTO lspd_arrestations
            (arrestation_id, date_arrestation, profession, ddn, address, tel, droits,
             entree_cellule, sortie_cellule, bracelet, miranda, avocat, nourriture, ems,
             avocatname, officer, grade, lieu, motifarrestation, circonstances, arme, uof, accusations, discord_thread_id, name, rapports_lies)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            arrestationId, date, profession, DDN, address, tel, droits,
            entreecellule, sortiecellule, bracelet, miranda,
            avocat, nourriture, ems,
            avocatName, officer, grade, lieu,
            motifArrestation, circonstances, arme, uof,
            JSON.stringify(JSON.parse(accusations || "[]")), thread.id, name,
            JSON.stringify(rapportsLiesValue)
        ]);

        const logsChannel = await bot.channels.fetch(logsChannelId);
        if (logsChannel?.isTextBased()) {
            const embedLog = new EmbedBuilder()
                .setColor(0x0b1b5a)
                .setTitle(`Nouveau rapport d'arrestation - ${arrestationId}`)
                .setDescription(`${req.user?.guild_member?.nick || 'Utilisateur inconnu'} a créé un nouveau rapport - <#${thread.id}> \`${arrestationId}\``)
                .addFields({
                    name: "ID's",
                    value: `> <@${req.user?.id || 'Utilisateur inconnu'}> (\`${req.user?.id || 'ID inconnu'}\`) \n> <#${thread.id}> (\`${thread.id}\`)`
                })
                .setFooter({
                    text: "LSPD Assistant",
                    iconURL: botUser.displayAvatarURL({ extension: 'png', size: 256 })
                })
                .setTimestamp();

            await logsChannel.send({ embeds: [embedLog] });
        }

        res.json({
            message: "Rapport enregistré et envoyé !",
            arrestationId
        });

    } catch (err) {
        console.error("Erreur API /api/arrestation :", err);
        res.status(500).json({ error: "Erreur lors de l’envoi du rapport." });
    }
});


router.get('/api/getArrestation', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                name,
                date_arrestation,
                profession,
                ddn,
                address,
                tel,
                droits,
                entree_cellule,
                sortie_cellule,
                bracelet,
                miranda,
                avocat,
                nourriture,
                ems,
                avocatname,
                officer,
                grade,
                lieu,
                motifarrestation,
                circonstances,
                arme,
                uof,
                accusations,
                discord_thread_id,
                arrestation_id,
                rapports_lies
            FROM lspd_arrestations
            ORDER BY date_arrestation DESC
        `);

        const bot = getBot(); // Assure-toi que le bot est prêt

        const withImages = await Promise.all(result.rows.map(async row => {
            let images = [];

            try {
                const thread = await bot.channels.fetch(row.discord_thread_id);

                if (thread?.isThread()) {
                    const messages = await thread.messages.fetch({ limit: 100 });
                    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
                    // messages.fetch returns messages usually newest-first; sort by timestamp ascending
                    const orderedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
                    orderedMessages.forEach(msg => {
                        msg.attachments.forEach(att => {
                            if (att.contentType?.startsWith("image/")) {
                                images.push(att.url);
                            }
                        });
                        const links = msg.content.match(urlRegex);
                    });
                }
            } catch (err) {
                console.error(`Erreur lors de la récupération des images du thread ${row.discord_thread_id}:`, err);
            }

            return {
                name: row.name,
                date: row.date_arrestation,
                profession: row.profession,
                ddn: row.ddn,
                address: row.address,
                tel: row.tel,
                droits: row.droits,
                entree_cellule: row.entree_cellule,
                sortie_cellule: row.sortie_cellule,
                bracelet: row.bracelet,
                miranda: row.miranda,
                avocat: row.avocat,
                nourriture: row.nourriture,
                ems: row.ems,
                avocatName: row.avocatname,
                officer: row.officer,
                grade: row.grade,
                lieu: row.lieu,
                motifArrestation: row.motifarrestation,
                circonstances: row.circonstances,
                arme: row.arme,
                uof: row.uof,
                accusations: row.accusations,
                threadId: row.discord_thread_id,
                arrestationId: row.arrestation_id,
                images: images,
                rapports_lies: row.rapports_lies
            };
        }));

        res.json(withImages);

    } catch (err) {
        console.error('Erreur GET /api/getArrestation :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});


module.exports = router;
