const express = require("express");
const router = express.Router();
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
    const logsChannelId = conf.logs_channel;
    try {
        console.log(req.body)
        const {
            date, name, fileInput1, fileInput2, profession,
            DDN, address, tel, droits,
            entreecellule, sortiecellule, bracelet,
            miranda, avocat, nourriture, ems,
            avocatName, officer, grade, lieu,
            motifArrestation, circonstances, arme, uof,
            accusations, implique
        } = req.body;
        const files = req.files;

        const forum = await bot.channels.fetch(forumChannelId);
        const botUser = await bot.user;

        const { rows } = await pool.query("SELECT COUNT(*) FROM lspd_arrestations");
        const count = parseInt(rows[0].count, 10) + 1;
        const arrestationId = `ART${count.toString().padStart(4, "0")}`;
        // date is given in format '2000-03-13T12:23'
        const dividedDate = date.split('T');
        const [yyyy, mm, dd] = dividedDate[0].split("-");
        const [hh, min] = dividedDate[1].split(":");
        const formattedDate = `${dd}/${mm}/${yyyy} ${hh}:${min}`;

        const embed = new EmbedBuilder()
            .setTitle("Nouveau rapport d'arrestation")
            .setThumbnail(botUser.displayAvatarURL({ extension: 'png' }))
            .addFields(
                { name: "ID d'arrestation", value: arrestationId },
                { name: "Date", value: formattedDate, inline: true },
                { name: "Individu", value: name, inline: true },
                { name: "Officier rédacteur", value: officer, inline: true },
                { name: "Avocat", value: avocatName || "Non précisé", inline: true },
                { name: "Officiers impliqués", value: implique || "Aucun" },
                { name: "Accusations", value: JSON.parse(accusations || "[]").map(a => a.texte).join(", ") || "Aucune", inline: true },
                { name: "Lieu", value: lieu || "Non précisé", inline: true },
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

        if (files?.length > 0) {
            for (const file of files) {
                const attachment = new AttachmentBuilder(file.buffer, {
                    name: file.originalname
                });
                await thread.send({ files: [attachment] });
            }
        }

        await pool.query(`
      INSERT INTO lspd_arrestations
      (arrestation_id, date_arrestation, profession, ddn, address, tel, droits,
       entree_cellule, sortie_cellule, bracelet, miranda, avocat, nourriture, ems,
       avocatname, officer, grade, lieu, motifarrestation, circonstances, arme, uof, accusations, discord_thread_id)
      VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
    `, [
            arrestationId, date, profession, DDN, address, tel, droits,
            entreecellule, sortiecellule, bracelet, miranda,
            avocat, nourriture, ems,
            avocatName, officer, grade, lieu,
            motifArrestation, circonstances, arme, uof,
            JSON.stringify(JSON.parse(accusations || "[]")), thread.id
        ]);

        const logsChannel = await bot.channels.fetch(logsChannelId);
        if (logsChannel?.isTextBased()) {
            const embedLog = new EmbedBuilder()
                .setColor(0x0b1b5a)
                .setTitle(`Nouveau rapport d'arrestation - ${arrestationId}`)
                .setDescription(`<@${req.user?.id || 'Utilisateur inconnu'}> a créé un nouveau rapport - <#${thread.id}> \`${arrestationId}\``)
                .addFields({
                    name: "ID's",
                    value: `> <@${req.user?.id || 'Utilisateur inconnu'}> (\`${req.user?.id || 'ID inconnu'}\`) \n> <#${thread.id}> (\`${thread.id}\`)`,
                    inline: false
                })
                .setFooter({
                    text: "LSPD Assistant",
                    iconURL: botUser.displayAvatarURL({ extension: 'png', size: 256 })
                })
                .setTimestamp();

            await logsChannel.send({ embeds: [embedLog] });
            console.log('Log création rapport envoyé');
        }

        res.json({
            message: "Rapport enregistré et envoyé !",
            arrestationId: arrestationId
        });

    } catch (err) {
        console.error("Erreur API /api/arrestation :", err);
        res.status(500).json({ error: "Erreur lors de l’envoi du rapport." });
    }
});

// router.get('/api/getIncident', async (req, res) => {
//     try {
//         const result = await pool.query(`
//       SELECT 
//         incident_id,
//         date_incident,
//         heure_incident,
//         officier_redacteur,
//         grade,
//         recit,
//         officier_implique,
//         type_rapport,
//         lieu_incident,
//         discord_thread_id
//       FROM incidents
//       ORDER BY date_incident DESC, heure_incident DESC
//     `);

//         const bot = getBot(); // Assure-toi que le bot est prêt

//         const withImages = await Promise.all(result.rows.map(async row => {
//             let images = [];

//             try {
//                 const thread = await bot.channels.fetch(row.discord_thread_id);

//                 if (thread?.isThread()) {
//                     const messages = await thread.messages.fetch({ limit: 100 });

//                     messages.forEach(msg => {
//                         msg.attachments.forEach(att => {
//                             if (att.contentType?.startsWith("image/")) {
//                                 images.push(att.url);
//                             }
//                         });
//                     });
//                 }
//             } catch (err) {
//                 console.error(`Erreur lors de la récupération des images du thread ${row.discord_thread_id}:`, err);
//             }

//             return {
//                 id: row.incident_id,
//                 date: row.date_incident.toISOString().split('T')[0],
//                 heure: row.heure_incident,
//                 officier: row.officier_redacteur,
//                 grade: row.grade,
//                 recit: row.recit,
//                 implique: row.officier_implique,
//                 type: row.type_rapport,
//                 lieu: row.lieu_incident,
//                 threadId: row.discord_thread_id,
//                 images
//             };
//         }));

//         res.json(withImages);

//     } catch (err) {
//         console.error('Erreur GET /api/incidents :', err);
//         res.status(500).json({ error: 'Erreur serveur' });
//     }
// });


module.exports = router;
