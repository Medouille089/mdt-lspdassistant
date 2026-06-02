const express = require('express');
const router = express.Router();
// route is intentionally public to allow form submissions without login
const pool = require('../config/db');
const bot = require('../config/bot');
const { EmbedBuilder } = require('discord.js');
const { RECRUITMENT_CHANNEL_ID, RECRUITMENT_BANNER_URL } = require('../config/env');

const LIMITS = { CHUNK_SAFETY: 3800, CONTENT_MAX: 2000 };

function clamp(str, max) {
  if (!str) return '';
  str = String(str);
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

// POST /forms/recruitment
// Public endpoint: receives recruitment form submissions and sends embeds via bot
router.post('/forms/recruitment', async (req, res) => {
  try {
    const body = req.body || {};
    // Build sections similar to original GoogleScript
    const sections = [];
    sections.push('*Une nouvelle candidature a été soumise au département de recrutement du LSPD.*');

    // Build blocks mapping close to the original GoogleScript structure
    const conn = [
      ['ID Discord', body.discordId || '—'],
      ['Username', body.username || (body.author || '—')]
    ];

    const personal = [
      ['Nom & Prénom', body.fullname || '—'],
      ['Date de naissance', body.dob || '—'],
      ['Nationalité', body.nationality || '—']
    ];

    const psych = [
      ['Qualité 1', body.quality1 || '—'],
      ['Qualité 2', body.quality2 || '—'],
      ['Qualité 3', body.quality3 || '—'],
      ['Défaut 1', body.defect1 || '—'],
      ['Défaut 2', body.defect2 || '—'],
      ['Défaut 3', body.defect3 || '—']
    ];

    const motivations = [
      ['Même sans uniforme', body.same_without_uniform || '—'],
      ['Motivations', body.motivations || '—'],
      ['Disponibilités', body.availabilities || '—'],
      ['Grade souhaité', body.desired_rank || '—'],
      ['Qu\'est-ce qu\'un bon policier ?', body.good_police || '—']
    ];

    const connaissances = [
      ['Missions principales', body.missions || '—'],
      ['Bon poste de police', body.good_station || '—'],
      ['Arme principale', body.main_weapon || '—']
    ];

    const hierarchie = [
      ['Classement grades', body.rank_order || '—']
    ];

    const integration = [
      ['Projet d\'entrée', body.entry_plans || '—'],
      ['Division choisie', body.division_choice || '—'],
      ['Rôle supervision', body.supervision_role || '—']
    ];

    const procedures = [
      ['Rôle État-Major', body.etat_major || '—'],
      ['Codes radio', body.radio_codes || '—'],
      ['Infériorité numérique', body.inferiority || '—']
    ];

    const avis = [['Avis', body.avis || '—']];

    function makeBlock(title, pairs) {
      const lines = pairs.map(([k, v]) => `[${clamp(k || '—', 60)}] ${clamp(v || '—', 900)}`);
      return `${title}\n\`\`\`ini\n${lines.join('\n')}\n\`\`\``;
    }

    // Following the original script's section titles and order
    sections.push(makeBlock('👤 **Informations personnelles**', conn.concat(personal)));
    sections.push(makeBlock('🧠 **Profil psychologique**', psych));
    sections.push(makeBlock('🎯 **Motivations & Objectifs**', motivations));
    sections.push(makeBlock('📚 **Connaissances générales**', connaissances));
    sections.push(makeBlock('📘 **Hiérarchie & tactique**', hierarchie));
    sections.push(makeBlock('🚓 **Intégration & avenir**', integration));
    sections.push(makeBlock('⚖️ **Procédures**', procedures));
    sections.push(makeBlock('🔱 **Avis**', avis));

    // Check blacklist table for discord id (if any)
    let preface = '✅ Le candidat n\'est pas **blacklist**. ✅';
    try {
      const discordId = (body.discordId || '').toString().trim();
      if (discordId) {
        const { rows } = await pool.query('SELECT discord_id, reason, agent, created_at FROM lspd_blacklist WHERE discord_id=$1', [discordId]);
        if (rows && rows.length) {
          const r = rows[0];
          preface = `❌ Le candidat qui postule est **blacklist** depuis le **${r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}** pour **${r.reason || '—'}** par l’agent **${r.agent || '—'}**. ❌`;
        }
      }
    } catch (err) {
      console.warn('Erreur vérif blacklist:', err.message || err);
    }
    preface = clamp(preface, LIMITS.CONTENT_MAX);

    // Build embeds by splitting sections into safe chunks
    const embeds = [];
    let current = '';
    let first = true;
    const ts = new Date();
    // Bannière : valeur fournie par le client, sinon config serveur (.env)
    const bannerUrl = body._banner || RECRUITMENT_BANNER_URL || '';
    const pushEmbed = (desc, isLast) => {
      const emb = new EmbedBuilder()
        .setDescription(desc)
        .setColor(0x2c6b9b)
        .setTimestamp(ts);
      if (first) emb.setTitle('📥 Nouvelle Candidature Reçue - LSPD');
      if (isLast && bannerUrl) emb.setImage(bannerUrl);
      emb.setFooter({ text: 'Recrutement LSPD • Système automatisé' });
      embeds.push(emb);
      first = false;
    };

    for (let i = 0; i < sections.length; i++) {
      const piece = (current ? '\n\n' : '') + sections[i];
      if ((current + piece).length > LIMITS.CHUNK_SAFETY) {
        pushEmbed(current, false);
        current = sections[i];
      } else {
        current += piece;
      }
    }
    if (current) pushEmbed(current, true);

    // Salon cible : déterminé côté serveur via la config (.env), on ne fait pas
    // confiance à une valeur fournie par le client.
    const channelId = (RECRUITMENT_CHANNEL_ID || '').toString().trim();
    if (!channelId) return res.status(400).send('Missing target channel (RECRUITMENT_CHANNEL_ID non configuré)');

    // Persist submission to DB before sending to Discord
    let submissionId = null;
    try {
      const payload = { form: body, sections, meta: { ip: req.ip || null } };
      const insert = await pool.query(
        `INSERT INTO recruitment_submissions (
           discord_id, username, channel_id,
           fullname, dob, nationality,
           quality1, quality2, quality3,
           defect1, defect2, defect3,
           same_without_uniform, motivations, availabilities, desired_rank, good_police,
           missions, good_station, rank_order, main_weapon,
           etat_major, radio_codes, inferiority, entry_plans, division_choice, supervision_role, avis,
           payload, banner_url, preface, created_at
         ) VALUES (
           $1,$2,$3,
           $4,$5,$6,
           $7,$8,$9,
           $10,$11,$12,
           $13,$14,$15,$16,$17,
           $18,$19,$20,$21,
           $22,$23,$24,$25,$26,$27,$28,
           $29,$30,$31,NOW()
         ) RETURNING id`,
        [
          body.discordId || null,
          body.username || null,
          channelId,

          body.fullname || null,
          body.dob || null,
          body.nationality || null,

          body.quality1 || null,
          body.quality2 || null,
          body.quality3 || null,

          body.defect1 || null,
          body.defect2 || null,
          body.defect3 || null,

          body.same_without_uniform || null,
          body.motivations || null,
          body.availabilities || null,
          body.desired_rank || null,
          body.good_police || null,

          body.missions || null,
          body.good_station || null,
          body.rank_order || null,
          body.main_weapon || null,

          body.etat_major || null,
          body.radio_codes || null,
          body.inferiority || null,
          body.entry_plans || null,
          body.division_choice || null,
          body.supervision_role || null,
          body.avis || null,

          payload,
          body._banner || null,
          preface
        ]
      );
      submissionId = insert && insert.rows && insert.rows[0] && insert.rows[0].id;
    } catch (dbErr) {
      console.error('DB insert error for recruitment submission:', dbErr && dbErr.message ? dbErr.message : dbErr);
      // Continue — we still try to send, but note that DB insert failed
    }

    // If we created a submission row, store each individual answer
    if (submissionId) {
      try {
        const skipKeys = new Set(['_channel', '_banner']);
        // Prepare insert for each key/value in body
        for (const [key, value] of Object.entries(body)) {
          if (!value && value !== 0) continue; // skip empty
          if (skipKeys.has(key)) continue;
          // truncate long texts to avoid extremely long rows (but payload keeps full data)
          const valText = typeof value === 'string' ? value : JSON.stringify(value);
          await pool.query(
            'INSERT INTO recruitment_answers (submission_id, question_key, question_label, answer_text, created_at) VALUES ($1,$2,$3,$4,NOW())',
            [submissionId, key, null, valText]
          );
        }
      } catch (ansErr) {
        console.warn('Failed storing individual answers for submission', submissionId, ansErr && ansErr.message ? ansErr.message : ansErr);
      }
    }

    // Ensure bot is ready
    if (!bot || !bot.channels) {
      console.error('Bot instance not available');
      // Update DB record as failed if we have an id
      if (submissionId) await pool.query('UPDATE recruitment_submissions SET sent=false, error_text=$1 WHERE id=$2', ['Bot not available', submissionId]).catch(()=>{});
      return res.status(500).send('Bot not available');
    }

    const channel = await bot.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      if (submissionId) await pool.query('UPDATE recruitment_submissions SET sent=false, error_text=$1 WHERE id=$2', ['Invalid channel', submissionId]).catch(()=>{});
      return res.status(400).send('Invalid channel');
    }

    // Convert EmbedBuilder to raw if needed
    const embedObjs = embeds.map(e => e.toJSON());

    try {
      const msg = await channel.send({ content: preface, embeds: embedObjs });
      // Save send result in DB
      if (submissionId) {
        const msgIds = Array.isArray(msg) ? msg.map(m => m.id) : [msg.id];
        await pool.query('UPDATE recruitment_submissions SET sent=true, sent_at=NOW(), message_ids=$1, error_text=NULL WHERE id=$2', [JSON.stringify(msgIds), submissionId]).catch(err => console.warn('Failed updating submission sent status:', err && err.message ? err.message : err));
      }

      return res.json({ ok: true, embeds: embedObjs.length, submissionId });
    } catch (sendErr) {
      console.error('Discord send error for recruitment submission:', sendErr && sendErr.message ? sendErr.message : sendErr);
      if (submissionId) {
        await pool.query('UPDATE recruitment_submissions SET sent=false, error_text=$1 WHERE id=$2', [sendErr.message || String(sendErr), submissionId]).catch(()=>{});
      }
      return res.status(500).json({ error: 'Failed to send message to Discord', details: sendErr && sendErr.message ? sendErr.message : String(sendErr), submissionId });
    }
  } catch (err) {
    console.error('Erreur /forms/recruitment:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
