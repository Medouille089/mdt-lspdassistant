const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../config/db');
const { getBot } = require('../config/config');
const moment = require('moment-timezone');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fermer')
    .setDescription('Ferme un ticket'),

  async execute(interaction) {
    const bot = getBot();
    const guild = bot.guilds.cache.get(interaction.guildId);

    const configRes = await db.query('SELECT required_role_id, logs_channel FROM configlspd LIMIT 1');
    if (!configRes.rows[0]) {
      return interaction.reply({ content: "❌ Configuration non définie.", ephemeral: true });
    }

    const { required_role_id, logs_channel } = configRes.rows[0];

    if (!interaction.member.roles.cache.has(required_role_id)) {
      return interaction.reply({ content: "❌ Vous n'avez pas la permission de fermer ce ticket.", ephemeral: true });
    }

    const ticketChannel = interaction.channel;

    const logsChannel = guild.channels.cache.get(logs_channel);
    if (!logsChannel) {
      return interaction.reply({ content: "❌ Le salon de logs n'existe pas.", ephemeral: true });
    }

    const messages = await ticketChannel.messages.fetch({ limit: 100 });
    const transcript = messages
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      .map(m => `${moment(m.createdAt).tz('Europe/Paris').format('YYYY-MM-DD HH:mm')} - ${m.author.tag}: ${m.content}`)
      .join('\n');

    const transcriptBuffer = Buffer.from(transcript, 'utf-8');

    const embed = {
      title: `Ticket fermé`,
      description: `Le ticket de ${interaction.user.tag} a été fermé.`,
      color: 0xff0000,
      thumbnail: { url: bot.user.displayAvatarURL() },
      footer: { text: bot.user.username, icon_url: bot.user.displayAvatarURL() },
      timestamp: new Date(),
    };

    await logsChannel.send({
      embeds: [embed],
      files: [{ attachment: transcriptBuffer, name: `ticket-${ticketChannel.id}.md` }]
    });

    await ticketChannel.delete('Ticket fermé');

    console.log(`Ticket ${ticketChannel.name} fermé par ${interaction.user.tag}`);
  },
};
