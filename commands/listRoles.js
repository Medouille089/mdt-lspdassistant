const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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
            const role = interaction.options.getRole('role');
            if (!role) return interaction.reply({ content: "Rôle introuvable.", ephemeral: true });

            // Fetch tous les membres pour que le cache soit complet
            await interaction.guild.members.fetch();

            const membersWithRole = role.members.map(member => `<@${member.id}>`);

            if (membersWithRole.length === 0) {
                return interaction.reply({ content: `Aucun membre n’a le rôle ${role}.`, ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('Membre ayant le rôle')
                .setDescription(`${role} **- ${membersWithRole.length}**\n\n${membersWithRole.join('\n')}`)
                .setColor(0x0b1b5a)
                .setTimestamp()
                .setFooter({
                    text: 'LSPD Assistant',
                    iconURL: interaction.client.user.displayAvatarURL(),
                });

            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            console.error("Erreur dans la commande list_role :", err);
            await interaction.reply({ content: "❌ Une erreur est survenue.", ephemeral: true });
        }
    },
};
