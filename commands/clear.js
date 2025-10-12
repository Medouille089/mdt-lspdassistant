const { SlashCommandBuilder } = require('discord.js');
const { getConfig } = require('../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Supprime un nombre de messages dans le salon')
        .addIntegerOption(option =>
            option.setName('nombre')
                .setDescription('Nombre de messages à supprimer (max 100)')
                .setRequired(true)
        ),

    async execute(interaction) {
        const conf = getConfig();
        const commandStaffId = conf.commandstaff_id?.toString();
        const superAdminId = conf.id_superadmin?.toString();
        const memberRoles = interaction.member.roles.cache;

        // Vérification des permissions
        if (
            (!commandStaffId || !memberRoles.has(commandStaffId)) &&
            (!superAdminId || !memberRoles.has(superAdminId))
        ) {
            return interaction.reply({
                content: "❌ Vous n'avez pas la permission d'utiliser cette commande.",
                flags: 64
            });
        }

        const nombre = interaction.options.getInteger('nombre');
        if (!nombre || nombre < 1 || nombre > 100) {
            return interaction.reply({
                content: "❌ Veuillez spécifier un nombre entre 1 et 100.",
                flags: 64
            });
        }

        try {
            await interaction.channel.bulkDelete(nombre, true);
            await interaction.reply({
                content: `✅ ${nombre} messages supprimés.`,
                flags: 64
            });
        } catch (err) {
            await interaction.reply({
                content: `❌ Erreur lors de la suppression : ${err.message}`,
                flags: 64
            });
        }
    }
};
