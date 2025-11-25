const express = require("express");
const router = express.Router();
const multer = require("multer");
const { AttachmentBuilder, EmbedBuilder, ChannelType } = require("discord.js");
const { getConfig, getBot } = require("../config/config");
const pool = require("../config/db");

const upload = multer();

router.post("/upload-convocation", upload.single("image"), async (req, res) => {

  const bot = getBot();
  const user = req.user;
  const imageFile = req.file;

  const { nom, prenom, date, heure, lieu, motif, officier, grade } = req.body;
  if (!imageFile) return res.status(400).json({ error: "Aucune image reçue." });

  try {
    const conf = await getConfig();
    const forumChannelId = conf.convocation_thread_id;
    const logsChannelId = conf.logs_convocations;

    const forumChannel = await bot.channels.fetch(forumChannelId);
    const logsChannel = await bot.channels.fetch(logsChannelId);

    if (forumChannel.type !== ChannelType.GuildForum) {
      console.error("Le salon spécifié n’est pas un salon forum.");
      return res.status(400).json({ error: "Le salon spécifié n’est pas un salon forum valide." });
    }

    const botUser = bot.user;
    const nomComplet = `${nom || "Inconnu"} ${prenom || ""}`.trim();

    // Nom d'affichage de l'utilisateur (fallback si non fourni)
    const displayName = user?.guild_member?.nick || user?.username || user?.displayName || 'Utilisateur inconnu';
    // Nom court pour le thread (2 caractères)
    const shortName = (user?.guild_member?.nick || user?.username || '').substring(0, 2) || '??';

    // Si user vient d'un middleware d'auth, on peut fetch Member du serveur si besoin
    try {

      // Insert en base d'abord pour récupérer l'ID et pouvoir inclure le lien directement
      const safeDate = date && date.trim() !== '' ? date : null;
      const safeHeure = heure && heure.trim() !== '' ? heure : null;
      const insertRes = await pool.query(`
        INSERT INTO lspd_convocations (nom, prenom, date, heure, lieu, motif, officer, grade)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [nom, prenom, safeDate, safeHeure, lieu, motif, officier, grade]);

      const convocationId = insertRes.rows[0]?.id;
      const isLocal = process.env.IS_LOCAL === "true";
      const baseUrl = isLocal ? "http://localhost:3001/viewConvocation.html" : "https://lspd-assistant.fr/viewConvocation.html";
      const convocationLink = convocationId ? `${baseUrl}?id=${convocationId}` : null;


      const embed = new EmbedBuilder()
        .setTitle("Nouvelle convocation")
        .addFields(
          { name: "Personne concernée", value: nomComplet, inline: true },
          // Le lien doit apparaître AU-DESSUS de "Envoyée par"
          ...(convocationLink ? [{ name: "Consulter la convocation", value: `[Voir la convocation ${convocationId}](${convocationLink})` }] : []),
          { name: "Envoyée par", value: displayName, inline: false }
        )
        .setColor(0x0b1b5a)
        .setThumbnail(botUser.displayAvatarURL({ extension: 'png' }))
        .setFooter({
          text: "LSPD Assistant",
          iconURL: botUser.displayAvatarURL({ extension: "png", size: 256 })
        })
        .setTimestamp();

      // Crée le thread dans le forum avec l'embed (sans image)
      // Formater la date pour n'afficher que JJ/MM
      const dateFormatted = new Date(date).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit'
      });

      const convocationThread = await forumChannel.threads.create({
        name: `${nomComplet} - ${dateFormatted} à ${heure} - ${shortName}`,
        message: {
          embeds: [embed]
        }
      });

      // Persist the created thread id on the convocation record if possible.
      try {
        if (convocationId && convocationThread?.id) {
          await pool.query('UPDATE lspd_convocations SET discord_thread_id = ? WHERE id = ?', [convocationThread.id, convocationId]);
        }
      } catch (err) {
        // Column may not exist in older DB schema; warn but continue.
        console.warn('Unable to persist discord_thread_id for convocation:', err && err.message ? err.message : err);
      }


      // Envoie l’image dans un second message
      const attachment = new AttachmentBuilder(imageFile.buffer, {
        name: imageFile.originalname
      });

      await convocationThread.send({ files: [attachment] });

      // LOG
      if (logsChannel?.isTextBased()) {
        const embedLog = new EmbedBuilder()
          .setColor(0x0b1b5a)
          .setTitle(`Nouvelle convocation - ${nomComplet}`)
          .setDescription(`${displayName} a envoyé une convocation - <#${convocationThread.id}>`);

        if (convocationLink) {
          embedLog.addFields({ name: "Consulter la convocation", value: convocationLink });
        }

        // Ajoute le champ ID's après le lien
        embedLog.addFields({
          name: "ID's",
          value: `> <@${user?.id || 'ID inconnu'}> (\`${user?.id || 'ID inconnu'}\`)\n> <#${convocationThread.id}> (\`${convocationThread.id}\`)`,
          inline: false
        });

        embedLog.setFooter({ text: "LSPD Assistant", iconURL: botUser.displayAvatarURL({ extension: 'png', size: 256 }) }).setTimestamp();

        await logsChannel.send({ embeds: [embedLog] });
      }

      res.json({ success: true, message: "Convocation envoyée avec succès.", id: convocationId, link: convocationLink });

    } catch (error) {
      console.error("Erreur envoi convocation :", error);
      res.status(500).json({ error: "Erreur lors de l’envoi de la convocation." });
    }
  } catch (error) {
    console.error("Erreur générale :", error);
    res.status(500).json({ error: "Erreur lors du traitement de la requête." });
  }
});

router.get("/api/getConvocation", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM lspd_convocations ORDER BY date DESC, heure DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Erreur lors de la récupération des convocations :", error);
    res.status(500).json({ error: "Erreur lors de la récupération des convocations." });
  }
});

// Update convocation fields (partial)
router.put('/api/convocation/:id', async (req, res) => {
  const id = req.params.id;
  const { nom, prenom, date, heure, lieu, motif, officier, grade } = req.body || {};
  try {
    // Build dynamic update: only provided fields will be updated
    const fields = [];
    const values = [];
    let idx = 1;
    if (nom !== undefined) { fields.push(`nom = $${idx++}`); values.push(nom); }
    if (prenom !== undefined) { fields.push(`prenom = $${idx++}`); values.push(prenom); }
    if (date !== undefined) { fields.push(`date = $${idx++}`); values.push(date); }
    if (heure !== undefined) { fields.push(`heure = $${idx++}`); values.push(heure); }
    if (lieu !== undefined) { fields.push(`lieu = $${idx++}`); values.push(lieu); }
    if (motif !== undefined) { fields.push(`motif = $${idx++}`); values.push(motif); }
    if (officier !== undefined) { fields.push(`officer = $${idx++}`); values.push(officier); }
    if (grade !== undefined) { fields.push(`grade = $${idx++}`); values.push(grade); }

    if (fields.length === 0) return res.status(400).json({ error: 'Aucun champ à mettre à jour.' });

    values.push(id);
    const q = `UPDATE lspd_convocations SET ${fields.join(', ')} WHERE id = ?`;
    await pool.query(q, values);
    const selectRes = await pool.query('SELECT * FROM lspd_convocations WHERE id = ?', [id]);
    res.json({ success: true, convocation: selectRes.rows[0] });
  } catch (err) {
    console.error('Erreur update convocation', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la convocation.' });
  }
});

// Resend convocation image to existing thread (accepts multipart/form-data with image)
router.post('/api/convocation/:id/resend', upload.single('image'), async (req, res) => {
  const id = req.params.id;
  const imageFile = req.file;
  try {
    const rows = await pool.query('SELECT * FROM lspd_convocations WHERE id = ?', [id]);
    const conv = rows.rows[0];
    if (!conv) return res.status(404).json({ error: 'Convocation introuvable' });

    const threadId = conv.discord_thread_id || conv.discord_thread || null;
    if (!threadId) return res.status(400).json({ error: 'Aucun thread associé à cette convocation.' });

    const conf = await getConfig();
    const forumChannelId = conf.convocation_thread_id;
    const bot = getBot();
    const forumChannel = await bot.channels.fetch(forumChannelId);

    // Fetch the thread and send the image as a new message (no embed)
    const thread = await forumChannel.threads.fetch(threadId);
    if (!thread) return res.status(404).json({ error: 'Thread Discord introuvable' });

    if (!imageFile) return res.status(400).json({ error: 'Aucune image reçue.' });

    const attachment = new AttachmentBuilder(imageFile.buffer, { name: imageFile.originalname });
    await thread.send({ files: [attachment] });

    res.json({ success: true, message: 'Image renvoyée dans le thread.' });
  } catch (err) {
    console.error('Erreur resend convocation:', err);
    res.status(500).json({ error: 'Erreur lors du renvoi de la convocation.' });
  }
});

module.exports = router;
