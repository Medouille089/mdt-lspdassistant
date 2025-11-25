const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../config/db');
const { getConfig } = require('../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('allow_user')
        .setDescription('Ajoute un utilisateur à la liste des utilisateurs autorisés à exécuter /blacklist')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Utilisateur à autoriser')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('note')
                .setDescription('Note sur l\'utilisateur (ex: nom, raison)')
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
            const note = interaction.options.getString('note');

            // Vérifier si l'utilisateur existe déjà
            const checkRes = await pool.query(
                'SELECT discord_id FROM allowed_users WHERE discord_id = ?',
                [discordId]
            );

            if (checkRes.rows.length > 0) {
                return interaction.reply({
                    content: "❌ Cet utilisateur est déjà dans la liste des utilisateurs autorisés.",
                    flags: 64
                });
            }

            // Ajouter l'utilisateur
            await pool.query(
                'INSERT INTO allowed_users (discord_id, added_by, note) VALUES (?, ?, ?)',
                [discordId, interaction.user.id, note]
            );

            const embed = new EmbedBuilder()
                .setTitle('✅ Utilisateur autorisé ajouté')
                .setDescription(`<@${discordId}> a été ajouté à la liste des utilisateurs autorisés.`)
                .addFields(
                    { name: 'ID Discord', value: `\`${discordId}\``, inline: true },
                    { name: 'Note', value: `\`${note}\``, inline: true },
                    { name: 'Ajouté par', value: `<@${interaction.user.id}>`, inline: false }
                )
                .setColor(0x00FF00)
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
                            .setTitle('Nouvel utilisateur autorisé')
                            .setDescription(`${executorDisplayName} a autorisé ${targetDisplayName} dans la liste des allowed users`)
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
            } catch (e) { console.error('Erreur log allow_user cmd:', e); }

            return interaction.reply({ embeds: [embed], flags: 64 });

        } catch (err) {
            console.error('Erreur commande allow_user:', err);
            return interaction.reply({
                content: '❌ Une erreur est survenue lors de l\'ajout de l\'utilisateur.',
                flags: 64
            });
        }
    }
};
