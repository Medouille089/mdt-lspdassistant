const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getConfig } = require('../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list_role')
        .setDescription('Liste et ping tous les membres ayant le rôle mentionné')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Le rôle à lister')
                .setRequired(true)
        ),

    async execute(interaction) {
        try {
            const conf = getConfig();
            const requiredRoleId = conf.required_role_id?.toString();
            const superAdminRoleId = conf.id_superadmin?.toString();
            const memberRoles = interaction.member.roles.cache;

            // Vérification que l'utilisateur a required_role_id ou id_superadmin
            if (
                (!requiredRoleId || !memberRoles.has(requiredRoleId)) &&
                (!superAdminRoleId || !memberRoles.has(superAdminRoleId))
            ) {
                return interaction.reply({
                    content: "❌ Vous devez être un agent du LSPD pour exécuter la commande.",
                    flags: 64
                });
            }

            const role = interaction.options.getRole('role');
            if (!role) return interaction.reply({ content: "Rôle introuvable.", flags: 64 });

            // Fetch tous les membres pour que le cache soit complet
            await interaction.guild.members.fetch();

            // Filtrer les bots et map les membres pour avoir <@id> | displayName
            const membersWithRole = role.members
                .filter(member => !member.user.bot)
                .map(member => `<@${member.id}> [\`${member.displayName}\`]`);

            if (membersWithRole.length === 0) {
                return interaction.reply({ content: `Aucun membre humain n’a le rôle ${role}.`, flags: 64 });
            }

            const embed = new EmbedBuilder()
                .setTitle('Membres ayant le rôle')
                .setDescription(`${role} **- ${membersWithRole.length}**\n\n${membersWithRole.join('\n')}`)
                .setColor(0xFFFFFF)
                .setTimestamp()
                .setFooter({
                    text: 'LSPD Assistant',
                    iconURL: interaction.client.user.displayAvatarURL(),
                });

            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            console.error("Erreur dans la commande list_role :", err);
            await interaction.reply({ content: "❌ Une erreur est survenue.", flags: 64 });
        }
    },
};
