const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Voir fiche utilisateur')
        .setType(ApplicationCommandType.User),
    async execute(interaction) {
        const user = interaction.targetUser;
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) {
            return interaction.reply({
                content: "Utilisateur introuvable.",
                flags: 64,
            });
        }

        const formationsRoles = [
            { id: "1177771527815577690" },
            { id: "1177771674423279686" },
            { id: "1096965866266050623" },
            { id: "1096965866266050624" },
            { id: "1130535962414428325" },
            { id: "1298387776516915281" },
            { id: "1358148340566724609" },
            { id: "1124056236594311258" }
        ];
        const gradeRoles = [
            "1166106799250882600",
            "456789012345678901"
        ];

        const roles = member.roles.cache
            .filter(role => role.id !== interaction.guild.id)
            .sort((a, b) => b.position - a.position);

        const formationsText = formationsRoles.map(fRole => {
            const hasRole = roles.some(role => role.id === fRole.id);
            const emoji = hasRole ? '✅' : '❌';
            const guildRole = interaction.guild.roles.cache.get(fRole.id);
            const displayName = guildRole ? guildRole.name : fRole.name;
            return `${emoji} ${displayName}`;
        }).join('\n');

        const userGrades = roles.filter(role => gradeRoles.includes(role.id));
        const gradesText = userGrades.size > 0
            ? userGrades.map(role => `${role}`).join('\n')
            : "Aucun grade";

        const botUser = interaction.client.user;

        const embed = new EmbedBuilder()
            .setTitle(`Fiche utilisateur : ${user.username}`)
            .setColor(0x0b1b5a)
            .setThumbnail(user.displayAvatarURL())
            .addFields(
                { name: 'ID', value: user.id, inline: true },
                { name: 'Tag', value: user.tag, inline: true },
                { name: 'Créé le', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: 'Grade', value: gradesText, inline: false },
                { name: 'Formations', value: formationsText, inline: false },
            )
            .setFooter({
                text: 'LSPD Assistant',
                iconURL: botUser.displayAvatarURL(),
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
