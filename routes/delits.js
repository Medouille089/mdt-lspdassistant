const express = require("express");
const router = express.Router();
const multer = require("multer");
const pool = require("../config/db");
const config = require("../config/config");
const { getBot } = require("../config/config");
const { AttachmentBuilder, EmbedBuilder, ChannelType } = require("discord.js");
const { GUILD_ID } = require('../config/env');
const bot = require("../config/bot");
const { checkAuth } = require("../config/middleware");
const upload = multer({ storage: multer.memoryStorage() });

// Middleware pour vérifier si l'utilisateur est Command Staff
async function checkCommandStaff(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Non authentifié' });
    }

    try {
        const conf = await config.getConfig();
        const commandStaffRoleId = conf.commandstaff_id?.trim();
        const id_superadmin = conf.id_superadmin?.trim();

        const guild = await bot.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(req.user.id);
        const roleIds = member.roles.cache.map(role => role.id);

        const isCommandStaff = (commandStaffRoleId && roleIds.includes(commandStaffRoleId)) || 
                               (id_superadmin && roleIds.includes(id_superadmin));

        if (!isCommandStaff) {
            return res.status(403).json({ error: 'Accès refusé : Réservé au Command Staff' });
        }

        next();
    } catch (err) {
        console.error('Erreur checkCommandStaff :', err);
        res.status(500).json({ error: 'Erreur serveur lors de la vérification des permissions' });
    }
}

// router.post("/api/arrestation", upload.any(), async (req, res) => {
//     const bot = getBot();
//     const conf = await config.getConfig();
//     const forumChannelId = conf.arrestation_thread_id;
//     const logsChannelId = conf.logs_channel;
//     try {
//         const {
//             date, name, fileInput1, fileInput2, profession,
//             DDN, address, tel, droits,
//             entreecellule, sortiecellule, bracelet,
//             miranda, avocat, nourriture, ems,
//             avocatName, officer, grade, lieu,
//             motifArrestation, circonstances, arme, uof,
//             accusations, implique
//         } = req.body;
//         const files = req.files;

//         const forum = await bot.channels.fetch(forumChannelId);
//         const botUser = await bot.user;

//         const { rows } = await pool.query("SELECT COUNT(*) FROM lspd_arrestations");
//         const count = parseInt(rows[0].count, 10) + 1;
//         const arrestationId = `ART${count.toString().padStart(4, "0")}`;
//         const dividedDate = date.split('T');
//         const [yyyy, mm, dd] = dividedDate[0].split("-");
//         const [hh, min] = dividedDate[1].split(":");
//         const formattedDate = `${dd}/${mm}/${yyyy} ${hh}:${min}`;

//         const embed = new EmbedBuilder()
//             .setTitle("Nouveau rapport d'arrestation")
//             .setThumbnail(botUser.displayAvatarURL({ extension: 'png' }))
//             .addFields(
//                 { name: "ID d'arrestation", value: arrestationId },
//                 { name: "Date", value: formattedDate, inline: true },
//                 { name: "Individu", value: name, inline: true },
//                 { name: "Officier rédacteur", value: officer, inline: true },
//                 { name: "Avocat", value: avocatName || "Non précisé", inline: true },
//                 { name: "Accusations", value: JSON.parse(accusations || "[]").map(a => a).join("\n") || "Aucune", inline: true },
//                 { name: "Lieu", value: lieu || "Non précisé", inline: true },
//             )
//             .setFooter({
//                 text: "LSPD Assistant",
//                 iconURL: botUser.displayAvatarURL()
//             })
//             .setColor(0x0b1b5a)
//             .setTimestamp();

//         const thread = await forum.threads.create({
//             name: `${arrestationId} - ${formattedDate} - ${name}`,
//             message: { embeds: [embed] },
//             autoArchiveDuration: 1440,
//         });

//         if (files?.length > 0) {
//             for (const file of files) {
//                 const attachment = new AttachmentBuilder(file.buffer, {
//                     name: file.originalname
//                 });
//                 await thread.send({ files: [attachment] });
//             }
//         }

//         await pool.query(`
//       INSERT INTO lspd_arrestations
//       (arrestation_id, date_arrestation, profession, ddn, address, tel, droits,
//        entree_cellule, sortie_cellule, bracelet, miranda, avocat, nourriture, ems,
//        avocatname, officer, grade, lieu, motifarrestation, circonstances, arme, uof, accusations, discord_thread_id, name)
//       VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
//     `, [
//             arrestationId, date, profession, DDN, address, tel, droits,
//             entreecellule, sortiecellule, bracelet, miranda,
//             avocat, nourriture, ems,
//             avocatName, officer, grade, lieu,
//             motifArrestation, circonstances, arme, uof,
//             JSON.stringify(JSON.parse(accusations || "[]")), thread.id, name
//         ]);

//         const logsChannel = await bot.channels.fetch(logsChannelId);
//         if (logsChannel?.isTextBased()) {
//             const embedLog = new EmbedBuilder()
//                 .setColor(0x0b1b5a)
//                 .setTitle(`Nouveau rapport d'arrestation - ${arrestationId}`)
//                 .setDescription(`<@${req.user?.id || 'Utilisateur inconnu'}> a créé un nouveau rapport - <#${thread.id}> \`${arrestationId}\``)
//                 .addFields({
//                     name: "ID's",
//                     value: `> <@${req.user?.id || 'Utilisateur inconnu'}> (\`${req.user?.id || 'ID inconnu'}\`) \n> <#${thread.id}> (\`${thread.id}\`)`,
//                     inline: false
//                 })
//                 .setFooter({
//                     text: "LSPD Assistant",
//                     iconURL: botUser.displayAvatarURL({ extension: 'png', size: 256 })
//                 })
//                 .setTimestamp();

//             await logsChannel.send({ embeds: [embedLog] });
//         }

//         res.json({
//             message: "Rapport enregistré et envoyé !",
//             arrestationId: arrestationId
//         });

//     } catch (err) {
//         console.error("Erreur API /api/arrestation :", err);
//         res.status(500).json({ error: "Erreur lors de l’envoi du rapport." });
//     }
// });

router.get('/api/getDelits', checkAuth, async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT
       id,
       chef_accusation, 
       code_article, 
       type, 
       amende,
       peine,
       commentaire
      FROM lspd_delit
      ORDER BY type, code_article
    `);

        const delits = result.rows.map(row => {
            return {
                id: row.id,
                chef_accusation: row.chef_accusation,
                code_article: row.code_article,
                type: row.type,
                amende: row.amende,
                peine: row.peine,
                commentaire: row.commentaire,
            };
        });

        res.json(delits);

    } catch (err) {
        console.error('Erreur GET /api/getDelits :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST - Ajouter un nouveau délit
router.post('/api/delits', checkCommandStaff, async (req, res) => {
    try {
        const { chef_accusation, code_article, type, amende, peine, commentaire } = req.body;

        if (!chef_accusation || !type) {
            return res.status(400).json({ error: 'Chef d\'accusation et type sont requis' });
        }

        const result = await pool.query(`
            INSERT INTO lspd_delit (chef_accusation, code_article, type, amende, peine, commentaire)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [chef_accusation, code_article, type, amende || '$0', peine || '00:00', commentaire || '']);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Erreur POST /api/delits :', err);
        res.status(500).json({ error: 'Erreur lors de l\'ajout du délit' });
    }
});

// PUT - Modifier un délit existant
router.put('/api/delits/:id', checkCommandStaff, async (req, res) => {
    try {
        const { id } = req.params;
        const { chef_accusation, code_article, type, amende, peine, commentaire } = req.body;

        const result = await pool.query(`
            UPDATE lspd_delit
            SET chef_accusation = $1, code_article = $2, type = $3, amende = $4, peine = $5, commentaire = $6, updated_at = NOW()
            WHERE id = $7
            RETURNING *
        `, [chef_accusation, code_article, type, amende, peine, commentaire, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Délit non trouvé' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Erreur PUT /api/delits/:id :', err);
        res.status(500).json({ error: 'Erreur lors de la modification du délit' });
    }
});

// DELETE - Supprimer un délit
router.delete('/api/delits/:id', checkCommandStaff, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            DELETE FROM lspd_delit
            WHERE id = $1
            RETURNING *
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Délit non trouvé' });
        }

        res.json({ message: 'Délit supprimé avec succès', delit: result.rows[0] });
    } catch (err) {
        console.error('Erreur DELETE /api/delits/:id :', err);
        res.status(500).json({ error: 'Erreur lors de la suppression du délit' });
    }
});


module.exports = router;
