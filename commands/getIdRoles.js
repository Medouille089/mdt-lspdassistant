const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('get_id_roles')
    .setDescription('Affiche tous les rôles avec leur ID'),
  async execute(interaction) {
    const roles = interaction.guild.roles.cache
      .filter(role => role.name !== '@everyone')
      .sort((a, b) => b.position - a.position);

    const roleList = roles.map(role => `${role} \`(${role.id})\``).join('\n');

    if (roleList.length > 4096) {
      return interaction.reply({
        content: "La liste dépasse 4096 caractères, impossible d’afficher tous les rôles dans un embed.",
        ephemeral: true,
      });
    }

    const botUser = interaction.client.user;

    const embed = new EmbedBuilder()
      .setTitle("Liste des rôles")
      .setDescription(roleList || "Aucun rôle trouvé.")
      .setColor(0x0b1b5a)
      .setFooter({
        text: 'LSPD Assistant',
        iconURL: botUser.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
