const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const moment = require('moment-timezone');
const db = require('../config/db');
const { getConfig } = require('../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rappel')
    .setDescription('Créer un rappel (timezone: Europe/Paris)')
    .setDMPermission(true)
    // Discord exige que toutes les options required=true soient avant les optionnelles
    .addStringOption(opt => opt
      .setName('heure')
      .setDescription('Heure au format HH:mm (obligatoire)')
      .setRequired(true))
    .addStringOption(opt => opt
      .setName('date')
      .setDescription('Date au format JJ/MM/AAAA (optionnel si rappel aujourd\'hui)')
      .setRequired(false))
    .addStringOption(opt => opt
      .setName('raison')
      .setDescription('Raison du rappel')
      .setRequired(false)),

  async execute(interaction) {
    try {
    const dateStr = interaction.options.getString('date');
    const heureStr = interaction.options.getString('heure');
    const reason = interaction.options.getString('raison');
    const isDM = !interaction.guildId; // commande utilisée en MP

      // Validation heure
      if (!/^\d{2}:\d{2}$/.test(heureStr)) {
        return interaction.reply({ content: '❌ Heure invalide. Format attendu: HH:mm', flags: 64 });
      }

      const [h, m] = heureStr.split(':').map(Number);
      if (h > 23 || m > 59) {
        return interaction.reply({ content: '❌ Heure hors plage valide.', flags: 64 });
      }

      // Si pas de date → aujourd'hui en Europe/Paris. Si l\'heure est déjà passée, on prend demain.
      let targetMoment;
      if (dateStr) {
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
          return interaction.reply({ content: '❌ Date invalide. Format attendu: JJ/MM/AAAA', flags: 64 });
        }
        const [day, month, year] = dateStr.split('/').map(Number);
        targetMoment = moment.tz({ year, month: month - 1, day, hour: h, minute: m, second: 0 }, 'Europe/Paris');
      } else {
        targetMoment = moment.tz('Europe/Paris').hour(h).minute(m).second(0).millisecond(0);
        if (targetMoment.isBefore(moment.tz('Europe/Paris'))) {
          targetMoment.add(1, 'day');
        }
      }

      if (!targetMoment.isValid()) {
        return interaction.reply({ content: '❌ Impossible de parser la date/heure donnée.', flags: 64 });
      }

      // Refus si plus de 30 jours (limite simple pour éviter abus)
      const maxMoment = moment.tz('Europe/Paris').add(30, 'days');
      if (targetMoment.isAfter(maxMoment)) {
        return interaction.reply({ content: '❌ Rappel trop éloigné (limite 30 jours).', flags: 64 });
      }

      // Convertir en UTC pour stockage
      const remindAtUtc = targetMoment.clone().utc().format();

      const insertRes = await db.query(
        `INSERT INTO lspd_reminders (user_id, channel_id, remind_at, reason, dm_only)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [interaction.user.id, interaction.channel?.id || 'dm', remindAtUtc, reason, isDM]
      );
      const reminderId = insertRes.rows[0].id;

      const botUser = interaction.client.user;
      const fields = [
        { name: 'Date', value: targetMoment.format('DD/MM/YYYY'), inline: true },
        { name: 'Heure', value: targetMoment.format('HH:mm'), inline: true }
      ];
      if (reason && reason.trim().length) {
        fields.push({ name: 'Raison', value: reason });
      }

      const embed = new EmbedBuilder()
        .setTitle('Rappel enregistré')
        .setColor('#0b1b5a')
        .addFields(fields)
        .setFooter({ text: 'LSPD Assistant', iconURL: botUser.displayAvatarURL({ extension: 'png', size: 256 }) })
        .setTimestamp();

      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const cancelRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`reminder_cancel:${reminderId}`)
          .setLabel('Annuler le rappel')
          .setStyle(ButtonStyle.Danger)
      );

      if (isDM) {
        await interaction.reply({ embeds: [embed], components: [cancelRow] });
      } else {
        await interaction.reply({ embeds: [embed], flags: 64 });
        try {
          await interaction.user.send({ embeds: [embed], components: [cancelRow] });
        } catch (_) { /* ignore */ }
      }

      // Envoi du log dans logs_calendrier
      try {
        const conf = await getConfig();
        if (conf.logs_calendrier) {
          const logsChannel = await interaction.client.channels.fetch(conf.logs_calendrier);
          if (logsChannel?.isTextBased()) {
            const displayName = interaction.member?.displayName || interaction.user.displayName || interaction.user.username;
            
            let locationText = isDM 
              ? 'en MP' 
              : `dans le salon <#${interaction.channel.id}>`;

            const logEmbed = new EmbedBuilder()
              .setTitle('Nouveau rappel')
              .setColor('#0b1b5a')
              .setDescription(`${displayName} a ajouté un nouveau rappel ${locationText}`)
              .addFields(
                { name: 'Date', value: `> \`${targetMoment.format('DD/MM/YYYY')}\``, inline: true },
                { name: 'Heure', value: `> \`${targetMoment.format('HH:mm')}\``, inline: true }
              )
              .setFooter({ text: 'LSPD Assistant', iconURL: botUser.displayAvatarURL({ extension: 'png', size: 256 }) })
              .setTimestamp();

            if (reason && reason.trim().length) {
              logEmbed.addFields({ name: 'Raison', value: `> ${reason}`, inline: false });
            }

            // Ajout des ID's
            if (isDM) {
              logEmbed.addFields({ 
                name: 'ID\'s', 
                value: `> <@${interaction.user.id}> (\`${interaction.user.id}\`)`, 
                inline: false 
              });
            } else {
              logEmbed.addFields({ 
                name: 'ID\'s', 
                value: `> <@${interaction.user.id}> (\`${interaction.user.id}\`)\n> <#${interaction.channel.id}> (\`${interaction.channel.id}\`)`, 
                inline: false 
              });
            }

            await logsChannel.send({ embeds: [logEmbed] });
          }
        }
      } catch (logErr) {
        console.error('Erreur envoi log rappel:', logErr);
        // On ne fait pas échouer la commande si le log échoue
      }

      return;
    } catch (err) {
      console.error('Erreur création rappel:', err);
      return interaction.reply({ content: '❌ Erreur interne lors de la création du rappel.', flags: 64 });
    }
  }
};
