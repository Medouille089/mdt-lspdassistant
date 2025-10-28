const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('get_id_roles')
    .setDescription('Affiche tous les rôles avec leur ID'),
  async execute(interaction) {
    const roles = interaction.guild.roles.cache
      .filter(role => role.name !== '@everyone')
      .sort((a, b) => b.position - a.position);

    const lines = roles.map(role => `${role} \`(${role.id})\``);

    if (!lines.length) {
      return interaction.reply({ content: 'Aucun rôle trouvé.', flags: 64 });
    }

    const botUser = interaction.client.user;

    // Discord embed description hard limit = 4096 chars
    const MAX = 4096;
    const chunks = [];
    let current = [];
    let currentLen = 0;
    for (const l of lines) {
      const addLen = l.length + 1; // +1 for newline
      if (currentLen + addLen > MAX) {
        chunks.push(current.join('\n'));
        current = [l];
        currentLen = l.length + 1;
      } else {
        current.push(l);
        currentLen += addLen;
      }
    }
    if (current.length) chunks.push(current.join('\n'));

    const total = chunks.length;
    const embeds = chunks.map((desc, idx) => new EmbedBuilder()
      .setTitle(`Liste des rôles (${idx + 1}/${total})`)
      .setDescription(desc)
      .setColor(0xFFFFFF)
      .setFooter({ text: 'LSPD Assistant', iconURL: botUser.displayAvatarURL() })
      .setTimestamp()
    );

    // On envoie la première avec reply, les suivantes avec followUp
    await interaction.reply({ embeds: [embeds[0]] });
    for (let i = 1; i < embeds.length; i++) {
      await interaction.followUp({ embeds: [embeds[i]] });
    }
  },
};
