const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../config/db');
const { getConfig } = require('../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('revoke_user')
        .setDescription('Retire un utilisateur de la liste des utilisateurs autorisés à exécuter /blacklist')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Utilisateur à retirer')
                .setRequired(true)
        ),

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

            const targetUser = interaction.options.getUser('user');
            const discordId = targetUser.id;

            // Vérifier si l'utilisateur existe
            const checkRes = await pool.query(
                'SELECT discord_id, note FROM allowed_users WHERE discord_id = $1',
                [discordId]
            );

            if (checkRes.rows.length === 0) {
                return interaction.reply({
                    content: "❌ Cet utilisateur n'est pas dans la liste des utilisateurs autorisés.",
                    flags: 64
                });
            }

            const note = checkRes.rows[0].note;

            // Retirer l'utilisateur
            await pool.query(
                'DELETE FROM allowed_users WHERE discord_id = $1',
                [discordId]
            );

            const embed = new EmbedBuilder()
                .setTitle('✅ Utilisateur autorisé retiré')
                .setDescription(`<@${discordId}> a été retiré de la liste des utilisateurs autorisés.`)
                .addFields(
                    { name: 'ID Discord', value: `\`${discordId}\``, inline: true },
                    { name: 'Note', value: `\`${note || 'Aucune'}\``, inline: true },
                    { name: 'Retiré par', value: `<@${interaction.user.id}>`, inline: false }
                )
                .setColor(0xFF0000)
                .setTimestamp();

            // Log to logs_config if configured
            try {
                const cfgRes = await pool.query('SELECT logs_config FROM configlspd LIMIT 1');
                const logsChannelId = cfgRes.rows[0] ? cfgRes.rows[0].logs_config : null;
                if (logsChannelId) {
                    const bot = require('../config/bot');
                    const logsChannel = await bot.channels.fetch(logsChannelId).catch(() => null);
                    if (logsChannel?.isTextBased()) {
                        // Récupérer les displayName
                        const guild = interaction.guild;
                        const executor = interaction.user;
                        const executorDisplayName = interaction.member?.displayName || executor.username;
                        
                        // Essayer de récupérer le membre pour avoir le displayName
                        const targetMember = await guild.members.fetch(discordId).catch(() => null);
                        const targetDisplayName = targetMember ? targetMember.displayName : 'Utilisateur inconnu';

                        const logEmbed = new EmbedBuilder()
                            .setTitle('Utilisateur autorisé retiré')
                            .setDescription(`${executorDisplayName} a retiré ${targetDisplayName} de la liste des allowed users`)
                            .addFields(
                                { name: "ID's", value: `<@${executor.id}> (\`${executor.id}\`)\n<@${discordId}> (\`${discordId}\`)`, inline: false }
                            )
                            .setColor(0xFF0000)
                            .setTimestamp()
                            .setFooter({ 
                                text: 'LSPD Assistant', 
                                iconURL: bot.user.displayAvatarURL() 
                            });
                        await logsChannel.send({ embeds: [logEmbed] });
                    }
                }
            } catch (e) { console.error('Erreur log revoke_user cmd:', e); }

            return interaction.reply({ embeds: [embed], flags: 64 });

        } catch (err) {
            console.error('Erreur commande revoke_user:', err);
            return interaction.reply({
                content: '❌ Une erreur est survenue lors du retrait de l\'utilisateur.',
                flags: 64
            });
        }
    }
};
