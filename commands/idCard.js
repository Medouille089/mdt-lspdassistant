const { 
  ContextMenuCommandBuilder, 
  ApplicationCommandType, 
  SlashCommandBuilder, 
  EmbedBuilder 
} = require('discord.js');
const { getConfig } = require('../config/config');

async function buildFiche(interaction, user, member) {
  const config = getConfig();

  const roles = member.roles.cache
    .filter(role => role.id !== interaction.guild.id)
    .sort((a, b) => b.position - a.position);

  // --- Vérification du rôle required_role_id ---
  const requiredRoleId = config.required_role_id;
  if (!roles.has(requiredRoleId)) {
    const botUser = interaction.client.user;
    return new EmbedBuilder()
      .setTitle(`Fiche agent : ${member.displayName}`)
      .setColor(0xff0000)
      .setDescription("❌ Cet utilisateur n'est pas un agent du LSPD")
      .setFooter({
        text: 'LSPD Assistant',
        iconURL: botUser.displayAvatarURL(),
      })
      .setTimestamp();
  }

  // --- Formations ---
  const formationsText = config.lspd_formations
    .filter(([col, roleId]) => col.endsWith("_role_id") && roleId)
    .map(([_, roleId]) => {
      const guildRole = interaction.guild.roles.cache.get(roleId);
      if (!guildRole) return `❌ Rôle introuvable (${roleId})`;
      const hasRole = roles.has(roleId);
      const emoji = hasRole ? "✅" : "❌";
      return `${emoji} ${guildRole.name}`;
    })
    .join("\n");

  // --- Grades ---
  const userGrades = config.lspd_grades
    .filter(([col, roleId]) => col.endsWith("_role_id") && roleId)
    .filter(([_, roleId]) => roles.has(roleId));

  const gradesText = userGrades.length > 0
    ? userGrades
        .map(([_, roleId]) => {
          const guildRole = interaction.guild.roles.cache.get(roleId);
          return guildRole ? guildRole.name : `Rôle introuvable (${roleId})`;
        })
        .join("\n")
    : "Aucun grade";

  // --- Embed ---
  const botUser = interaction.client.user;
  return new EmbedBuilder()
    .setTitle(`Fiche agent : ${member.displayName}`)
    .setColor(0x0b1b5a)
    .setThumbnail(user.displayAvatarURL())
    .addFields(
      { name: "ID", value: user.id, inline: true },
      { name: "Tag", value: user.tag, inline: true },
      { name: "Créé le", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: "Grade", value: gradesText, inline: false },
      { name: "Formations", value: formationsText, inline: false },
    )
    .setFooter({
      text: 'LSPD Assistant',
      iconURL: botUser.displayAvatarURL(),
    })
    .setTimestamp();
}

module.exports = {
  // --- Commande clic droit ---
  ficheAgentContextMenu: {
    data: new ContextMenuCommandBuilder()
      .setName('Fiche agent')
      .setType(ApplicationCommandType.User),
    async execute(interaction) {
      const user = interaction.targetUser;
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.reply({ content: "Utilisateur introuvable.", flags: 64 });

      const embed = await buildFiche(interaction, user, member);
      await interaction.reply({ embeds: [embed] });
    }
  },

  // --- Commande slash ---
  ficheAgentSlash: {
    data: new SlashCommandBuilder()
      .setName('fiche_agent')
      .setDescription("Affiche la fiche d'un agent du LSPD")
      .addUserOption(option =>
        option.setName('agent')
          .setDescription('Sélectionnez l’agent')
          .setRequired(true)
      ),
    async execute(interaction) {
      const user = interaction.options.getUser('agent');
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.reply({ content: "Utilisateur introuvable.", flags: 64 });

      const embed = await buildFiche(interaction, user, member);
      await interaction.reply({ embeds: [embed] });
    }
  }
};
