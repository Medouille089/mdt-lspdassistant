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
        const user = interaction.options.getUser('user');
        const member = interaction.guild.members.cache.get(user.id);

        // Role autorisé
        const authorizedRoles = [
            '1096965866324770860',
            '1096965866345746524',
            '1096965866303787090',
        ];

        const hasAuthorizedRole = authorizedRoles.some(roleId =>
            interaction.member.roles.cache.has(roleId)
        );

        if (!hasAuthorizedRole) {
            return interaction.reply({ content: '❌ Vous n\'avez pas les permissions nécessaires pour utiliser cette commande.', flags: 64 });
        }

        //  Roles à donner
        const rolesToAdd = [

            '1096965866303787094', // "Rookie"
            '1096965866303787093', // "Division"
            '1435226948988047381', // "Formations"
            '1430483505468411976', // "Autre"
            '1096965866245066801', // "LSPD"
            '1166058393442721843', // "Sanctions"
        ];

        // Rôles à retirer
        const rolesToRemove = [
            '1099760263844081664', // "Candidat"
        ];

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
                    results.removed.push(role.name);
                } else {
                    results.notHad.push(role.name);
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
                    results.alreadyHas.push(role.name);
                    continue;
                }

                await member.roles.add(roleId);
                results.added.push(role.name);
            } catch (error) {
                results.failed.push(`Erreur avec le rôle ID: ${roleId}`);
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('🎭 Attribution des rôles')
            .setDescription(`Attribution des rôles pour ${user.tag}`)
            .setColor('#00ff00')
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
                name: 'ℹ️ Rôles non possédés (pas retirés)',
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
    }
};
