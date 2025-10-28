const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');
const { getConfig } = require('../config/config');

async function buildFiche(interaction, user, member) {
  const config = getConfig();
  const roles = member.roles.cache;

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

  // --- Retour des infos pour embed ---
  return {
    displayName: member.displayName,
    userTag: user.tag,
    userId: user.id,
    avatarURL: user.displayAvatarURL(),
    gradesText,
    formationsText,
  };
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

      const config = getConfig();
      const requiredRoleId = config.required_role_id?.toString();
      const superAdminRoleId = config.id_superadmin?.toString();

      // Vérification sur le membre qui exécute la commande
      if (!interaction.member.roles.cache.has(requiredRoleId) &&
          !interaction.member.roles.cache.has(superAdminRoleId)) {
        return interaction.reply({ content: "❌ Vous devez être un agent du LSPD pour exécuter la commande.", flags: 64 });
      }

      const fiche = await buildFiche(interaction, user, member);

      // Création de l'embed
      const embed = new EmbedBuilder()
        .setTitle(`Fiche agent : ${fiche.displayName}`)
        .setColor(0xFFFFFF)
        .setThumbnail(fiche.avatarURL)
        .addFields(
          { name: "ID", value: fiche.userId, inline: true },
          { name: "Tag", value: fiche.userTag, inline: true },
          { name: "Grade", value: fiche.gradesText, inline: false },
          { name: "Formations", value: fiche.formationsText, inline: false }
        )
        .setFooter({ text: 'LSPD Assistant', iconURL: interaction.client.user.displayAvatarURL() })
        .setTimestamp();

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

      const config = getConfig();
      const requiredRoleId = config.required_role_id?.toString();
      const superAdminRoleId = config.id_superadmin?.toString();

      // Vérification sur le membre qui exécute la commande
      if (!interaction.member.roles.cache.has(requiredRoleId) &&
          !interaction.member.roles.cache.has(superAdminRoleId)) {
        return interaction.reply({ content: "❌ Vous devez être un agent du LSPD pour exécuter la commande.", flags: 64 });
      }

      const fiche = await buildFiche(interaction, user, member);

      // Création de l'embed
      const embed = new EmbedBuilder()
        .setTitle(`Fiche agent : ${fiche.displayName}`)
        .setColor(0xFFFFFF)
        .setThumbnail(fiche.avatarURL)
        .addFields(
          { name: "ID", value: fiche.userId, inline: true },
          { name: "Tag", value: fiche.userTag, inline: true },
          { name: "Grade", value: fiche.gradesText, inline: false },
          { name: "Formations", value: fiche.formationsText, inline: false }
        )
        .setFooter({ text: 'LSPD Assistant', iconURL: interaction.client.user.displayAvatarURL() })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  }
};
