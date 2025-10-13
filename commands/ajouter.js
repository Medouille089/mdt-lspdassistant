const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ajouter')
        .setDescription('Ajouter un utilisateur ou un rôle au ticket')
        .addUserOption(option => option.setName('user').setDescription('Utilisateur à ajouter'))
        .addRoleOption(option => option.setName('role').setDescription('Rôle à ajouter')),
    async execute(interaction) {
    const { EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
        const user = interaction.options.getUser('user');
        const role = interaction.options.getRole('role');
        const channel = interaction.channel;
        const { getConfig } = require('../config/config');
        const config = getConfig();
        const requiredRoleId = config.required_role_id?.toString();
        const superAdminRoleId = config.id_superadmin?.toString();
        if (!interaction.member.roles.cache.has(requiredRoleId) && (!superAdminRoleId || !interaction.member.roles.cache.has(superAdminRoleId))) {
            return interaction.reply({ content: '❌ Seul un agent du LSPD peut utiliser cette commande.', flags: 64, ephemeral: true });
        }

        // Vérifie que la commande est exécutée dans un ticket (salon textuel avec permissions personnalisées)
        const db = require('../config/db');
        // Vérification en base : le salon doit être dans lspd_tickets
        if (!channel || channel.type !== ChannelType.GuildText) {
            return interaction.reply({ content: 'Cette commande doit être utilisée dans un ticket.', flags: 64 });
        }
        const ticketRes = await db.query('SELECT user_id FROM lspd_tickets WHERE channel_id=$1', [channel.id]);
        if (!ticketRes.rows[0]) {
            return interaction.reply({ content: 'Ce salon n\'est pas un ticket valide.', flags: 64 });
        }

        // Ajout user ou rôle
        let alreadyHasAccessUser = false;
        let alreadyHasAccessRole = false;
        if (!user && !role) {
            return interaction.reply({ content: 'Veuillez spécifier un utilisateur ou un rôle.', flags: 64 });
        }
        if (user) {
            const overwriteUser = channel.permissionOverwrites.cache.get(user.id);
            if (overwriteUser && overwriteUser.allow.has(PermissionsBitField.Flags.ViewChannel)) {
                alreadyHasAccessUser = true;
            }
        }
        if (role) {
            const overwriteRole = channel.permissionOverwrites.cache.get(role.id);
            if (overwriteRole && overwriteRole.allow.has(PermissionsBitField.Flags.ViewChannel)) {
                alreadyHasAccessRole = true;
            }
        }
        if (alreadyHasAccessUser && alreadyHasAccessRole) {
            return interaction.reply({ content: `Cet utilisateur et ce rôle ont déjà accès au ticket.`, flags: 64 });
        }
        if (alreadyHasAccessUser) {
            return interaction.reply({ content: `Cet utilisateur a déjà accès au ticket.`, flags: 64 });
        }
        if (alreadyHasAccessRole) {
            return interaction.reply({ content: `Ce rôle a déjà accès au ticket.`, flags: 64 });
        }
        // Ajoute les permissions
        if (user) {
            await channel.permissionOverwrites.edit(user.id, {
                ViewChannel: true,
                SendMessages: true
            });
        }
        if (role) {
            await channel.permissionOverwrites.edit(role.id, {
                ViewChannel: true,
                SendMessages: true
            });
        }
        // Embed de confirmation
        let desc = '';
        if (user && role) {
            desc = `<@${user.id}> et <@&${role.id}> ont été ajoutés au ticket par <@${interaction.user.id}>.`;
        } else if (user) {
            desc = `<@${user.id}> a été ajouté au ticket par <@${interaction.user.id}>.`;
        } else if (role) {
            desc = `<@&${role.id}> a été ajouté au ticket par <@${interaction.user.id}>.`;
        }
        const embed = new EmbedBuilder()
            .setColor(0x0b1b5a)
            .setDescription(desc)
            .setFooter({ text: 'LSPD Assistant', iconURL: interaction.client.user.displayAvatarURL({ extension: 'png', size: 256 }) })
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        // LOG dans le salon conf.logs_tickets
        const conf = config;
        if (conf.logs_tickets) {
            const logsChannel = await interaction.client.channels.fetch(conf.logs_tickets).catch(() => null);
            if (logsChannel?.isTextBased()) {
                let logDesc = '';
                let idsField = '';
                if (user && role) {
                    logDesc = `<@${user.id}> et <@&${role.id}> ont été ajoutés au ticket <#${interaction.channel.id}> par <@${interaction.user.id}>.`;
                    idsField = `> <@${user.id}> \`(${user.id})\`\n> <@&${role.id}> \`(${role.id})\`\n> <#${interaction.channel.id}> \`(${interaction.channel.id})\`\n> <@${interaction.user.id}> \`(${interaction.user.id})\``;
                } else if (user) {
                    logDesc = `<@${user.id}> a été ajouté au ticket <#${interaction.channel.id}> par <@${interaction.user.id}>.`;
                    idsField = `> <@${user.id}> \`(${user.id})\`\n> <#${interaction.channel.id}> \`(${interaction.channel.id})\`\n> <@${interaction.user.id}> \`(${interaction.user.id})\``;
                } else if (role) {
                    logDesc = `<@&${role.id}> a été ajouté au ticket <#${interaction.channel.id}> par <@${interaction.user.id}>.`;
                    idsField = `> <@&${role.id}> \`(${role.id})\`\n> <#${interaction.channel.id}> \`(${interaction.channel.id})\`\n> <@${interaction.user.id}> \`(${interaction.user.id})\``;
                }
                const logEmbed = new EmbedBuilder()
                    .setColor(0x0b1b5a)
                    .setTitle('Ajout au ticket')
                    .setDescription(logDesc)
                    .addFields({ name: "ID's", value: idsField, inline: false })
                    .setFooter({ text: 'LSPD Assistant', iconURL: interaction.client.user.displayAvatarURL({ extension: 'png', size: 256 }) })
                    .setTimestamp();
                await logsChannel.send({ embeds: [logEmbed] });
            }
        }
    }
};
