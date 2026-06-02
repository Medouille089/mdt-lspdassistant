const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setrookie')
        .setDescription('Ajouter la liste de rôles pour un rookie')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Utilisateur auquel ajouter les rôles')
                .setRequired(true)
        ),
    async execute(interaction) {
        const { EmbedBuilder } = require('discord.js');
        const { getConfig } = require('../config/config');
        const {
            SETROOKIE_AUTHORIZED_ROLES,
            SETROOKIE_ROLES_TO_ADD,
            SETROOKIE_ROLES_TO_REMOVE,
        } = require('../config/env');
        const user = interaction.options.getUser('user');
        const member = interaction.guild.members.cache.get(user.id);

        // Rôles autorisés à exécuter la commande (configurés via .env)
        const authorizedRoles = SETROOKIE_AUTHORIZED_ROLES;

        const config = getConfig();
        const superAdminRoleId = config.id_superadmin?.toString();

        const hasAuthorizedRole = authorizedRoles.some(roleId =>
            interaction.member.roles.cache.has(roleId)
        ) || (superAdminRoleId && interaction.member.roles.cache.has(superAdminRoleId));

        if (!hasAuthorizedRole) {
            return interaction.reply({ content: '❌ Vous n\'avez pas les permissions nécessaires pour utiliser cette commande.', flags: 64 });
        }

        // Rôles à donner / retirer (configurés via .env)
        const rolesToAdd = SETROOKIE_ROLES_TO_ADD;
        const rolesToRemove = SETROOKIE_ROLES_TO_REMOVE;

        if (!member) {
            return interaction.reply({ content: '❌ Impossible de trouver ce membre sur le serveur.', flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });

        const results = {
            added: [],
            alreadyHas: [],
            removed: [],
            notHad: [],
            failed: []
        };

        for (const roleId of rolesToRemove) {
            try {
                const role = interaction.guild.roles.cache.get(roleId);

                if (!role) {
                    results.failed.push(`Rôle à retirer introuvable (ID: ${roleId})`);
                    continue;
                }

                if (member.roles.cache.has(roleId)) {
                    await member.roles.remove(roleId);
                    results.removed.push(`> <@&${roleId}> (\`${roleId}\`)`);
                } else {
                    results.notHad.push(`> <@&${roleId}> (\`${roleId}\`)`);
                }
            } catch (error) {
                results.failed.push(`Erreur lors du retrait du rôle ID: ${roleId}`);
            }
        }

        for (const roleId of rolesToAdd) {
            try {
                const role = interaction.guild.roles.cache.get(roleId);

                if (!role) {
                    results.failed.push(`Rôle introuvable (ID: ${roleId})`);
                    continue;
                }

                if (member.roles.cache.has(roleId)) {
                    results.alreadyHas.push(`> <@&${roleId}> (\`${roleId}\`)`);
                    continue;
                }

                await member.roles.add(roleId);
                results.added.push(`> <@&${roleId}> (\`${roleId}\`)`);
            } catch (error) {
                results.failed.push(`Erreur avec le rôle ID: ${roleId}`);
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('Attribution des rôles')
            .setDescription(`Attribution des rôles pour <@${user.id}>`)
            .setColor(0x0b1b5a)
            .setFooter({
                text: 'LSPD Assistant',
                iconURL: interaction.client.user.displayAvatarURL({ extension: 'png', size: 256 })
            })
            .setTimestamp();

        if (results.removed.length > 0) {
            embed.addFields({
                name: '🗑️ Rôles retirés',
                value: results.removed.join('\n'),
                inline: false
            });
        }

        if (results.added.length > 0) {
            embed.addFields({
                name: '✅ Rôles ajoutés',
                value: results.added.join('\n'),
                inline: false
            });
        }

        if (results.alreadyHas.length > 0) {
            embed.addFields({
                name: 'ℹ️ Rôles déjà possédés',
                value: results.alreadyHas.join('\n'),
                inline: false
            });
        }

        if (results.notHad.length > 0) {
            embed.addFields({
                name: 'ℹ️ Rôles non possédés',
                value: results.notHad.join('\n'),
                inline: false
            });
        }

        if (results.failed.length > 0) {
            embed.addFields({
                name: '❌ Échecs',
                value: results.failed.join('\n'),
                inline: false
            });
            embed.setColor('#ff0000');
        }

        if (results.added.length === 0 && results.alreadyHas.length === 0 && results.removed.length === 0 && results.failed.length === 0) {
            embed.setDescription('Aucun rôle configuré dans les listes.');
            embed.setColor('#ff9900');
        }

        await interaction.editReply({ embeds: [embed] });

        // Log to logs_config if configured (only if roles were actually added or removed)
        if (results.added.length > 0 || results.removed.length > 0) {
            try {
                const pool = require('../config/db');
                const cfgRes = await pool.query('SELECT logs_config FROM configlspd LIMIT 1');
                const logsChannelId = cfgRes.rows[0] ? cfgRes.rows[0].logs_config : null;
                if (logsChannelId) {
                    const bot = require('../config/bot');
                    const logsChannel = await bot.channels.fetch(logsChannelId).catch(() => null);
                    if (logsChannel?.isTextBased()) {
                        const executorMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
                        const targetMember = await interaction.guild.members.fetch(user.id).catch(() => null);
                        const executorDisplayName = executorMember ? executorMember.displayName : interaction.user.username;
                        const targetDisplayName = targetMember ? targetMember.displayName : user.username;

                        const logEmbed = new EmbedBuilder()
                            .setTitle('Attribution des rôles Rookie')
                            .setColor(0x0b1b5a)
                            .setDescription(`${executorDisplayName} a attribué les rôles Rookie à ${targetDisplayName}`)
                            .addFields({
                                name: "ID's",
                                value: `> <@${interaction.user.id}> (\`${interaction.user.id}\`)\n> <@${user.id}> (\`${user.id}\`)`,
                                inline: false
                            })
                            .setFooter({
                                text: 'LSPD Assistant',
                                iconURL: interaction.client.user.displayAvatarURL({ extension: 'png', size: 256 })
                            })
                            .setTimestamp();
                        await logsChannel.send({ embeds: [logEmbed] });
                    }
                }
            } catch (e) {
                console.error('Erreur log addroles cmd:', e);
            }
        }
    }
};
