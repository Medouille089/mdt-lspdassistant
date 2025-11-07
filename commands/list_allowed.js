const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../config/db');
const { getConfig } = require('../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list_allowed')
        .setDescription('Liste tous les utilisateurs autorisés à exécuter /blacklist'),

    async execute(interaction) {
        try {
            // Vérifier que l'utilisateur est superadmin
            const conf = getConfig();
            const superAdminRoleId = conf.id_superadmin?.toString();
            const memberRoles = interaction.member.roles.cache;

            if (!superAdminRoleId || !memberRoles.has(superAdminRoleId)) {
                return interaction.reply({
                    content: "❌ Seuls les superadmins peuvent exécuter cette commande.",
                    flags: 64
                });
            }

            // Récupérer tous les utilisateurs autorisés
            const result = await pool.query(
                'SELECT discord_id, note, added_by, added_at FROM allowed_users ORDER BY added_at DESC'
            );

            if (result.rows.length === 0) {
                return interaction.reply({
                    content: "📋 Aucun utilisateur autorisé dans la liste.",
                    flags: 64
                });
            }

            // Formater la liste comme dans listRoles : <@id> [`note`]
            const usersList = result.rows.map(row => {
                const note = row.note || 'Aucune note';
                return `<@${row.discord_id}> [\`${note}\`]`;
            });

            const bot = require('../config/bot');
            const embed = new EmbedBuilder()
                .setTitle('Allowed users')
                .setDescription(`**Total: ${result.rows.length}**\n\n${usersList.join('\n')}`)
                .setColor(0x0b1b5a)
                .setTimestamp()
                .setFooter({ 
                    text: 'LSPD Assistant', 
                    iconURL: bot.user.displayAvatarURL() 
                });

            return interaction.reply({ embeds: [embed] });

        } catch (err) {
            console.error('Erreur commande list_allowed:', err);
            return interaction.reply({
                content: '❌ Une erreur est survenue lors de la récupération de la liste.',
                flags: 64
            });
        }
    }
};
