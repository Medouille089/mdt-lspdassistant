const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../config/db');
const { getBot } = require('../config/config');
const moment = require('moment-timezone');

async function createTranscriptMarkdown(channel) {
    const guild = channel.guild;

    // Récupérer le ticket depuis la BDD
    const ticketRes = await db.query('SELECT * FROM lspd_tickets WHERE channel_id=?', [channel.id]);
    const ticket = ticketRes.rows[0];
    if (!ticket) return Buffer.from('Aucune information sur ce ticket.', 'utf-8');

    // Récupérer le créateur du ticket
    let creator;
    try {
        const member = await guild.members.fetch(ticket.user_id);
        creator = `${member.user.username}#${member.user.discriminator} (@${member.displayName})`;
    } catch {
        creator = `Utilisateur introuvable (ID: ${ticket.user_id})`;
    }

    // Récupérer tous les messages du channel
    let allMessages = [];
    let lastId = null;
    while (true) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;
        const messages = await channel.messages.fetch(options);
        if (messages.size === 0) break;
        allMessages = allMessages.concat(Array.from(messages.values()));
        lastId = messages.last().id;
    }

    // Trier les messages du plus ancien au plus récent
    allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    // Conversion de la date BDD en heure de Paris
    const createdAtRaw = ticket.created_at || new Date().toISOString();
    const dateParis = moment.tz(createdAtRaw, "Europe/Paris").format("DD/MM/YYYY HH:mm");

    // Récupérer tous les participants
    const userIdsSet = new Set(allMessages.map(msg => msg.author.id));
    const participants = [];
    for (const userId of userIdsSet) {
        try {
            const member = await guild.members.fetch(userId);
            participants.push(`${member.displayName} - (${member.user.username}) - ${member.id}`);
        } catch {
            const msg = allMessages.find(m => m.author.id === userId);
            if (msg) participants.push(`${msg.author.username}#${msg.author.discriminator}`);
            else participants.push(`Utilisateur introuvable (ID: ${userId})`);
        }
    }
    let firstMessageDate;
    if (allMessages.length > 0) {
        firstMessageDate = moment.utc(allMessages[0].createdTimestamp).tz("Europe/Paris").format("DD/MM/YYYY HH:mm");
    } else {
        firstMessageDate = moment().tz("Europe/Paris").format("DD/MM/YYYY HH:mm");
    }

    const header = `
==========================
   TRANSCRIPT DU TICKET
      LSPD Assistant
   By Medouille & Porka
==========================

Serveur : ${guild.name}
Salon : #${channel.name}
Créé par : ${creator}
Date d'ouverture : ${firstMessageDate}

Participants : ${participants.join(', ')}

==========================
`;

    // Fonction utilitaire pour remplacer les mentions
    function replaceMentions(content) {
        if (!content) return '*[Message vide]*';

        content = content.replace(/<@!?(\d+)>/g, (_, userId) => {
            const member = guild.members.cache.get(userId);
            return member ? `@${member.displayName}` : '@Utilisateur inconnu';
        });

        content = content.replace(/<@&(\d+)>/g, (_, roleId) => {
            const role = guild.roles.cache.get(roleId);
            return role ? `@${role.name}` : '@Role inconnu';
        });

        content = content.replace(/<#(\d+)>/g, (_, chanId) => {
            const chan = guild.channels.cache.get(chanId);
            return chan ? `#${chan.name}` : '#salon-inconnu';
        });

        return content;
    }

    // Transformer les messages en texte lisible
    const transcriptLines = allMessages.map(msg => {
        const date = moment.utc(msg.createdTimestamp).tz("Europe/Paris").format("DD/MM/YYYY HH:mm:ss");
        const author = guild.members.cache.get(msg.author.id)?.displayName || `${msg.author.username}#${msg.author.discriminator}`;
        const content = replaceMentions(msg.content);
        return `**[${date}] ${author} :**\n${content}\n`;
    });

    return Buffer.from(header + '\n' + transcriptLines.join('\n---\n\n'), 'utf-8');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fermer')
        .setDescription('Ferme un ticket')
        .setDMPermission(false),

    async execute(interaction) {
        const bot = getBot();
        const guild = bot.guilds.cache.get(interaction.guildId);

        await interaction.deferReply({ flags: 64 });

        const configRes = await db.query('SELECT required_role_id, id_superadmin, logs_tickets FROM configlspd LIMIT 1');
        if (!configRes.rows[0])
            return interaction.editReply({ content: "❌ Configuration non définie.", flags: 64 });

        const { required_role_id, id_superadmin, logs_tickets } = configRes.rows[0];

        if (!interaction.member.roles.cache.has(required_role_id) &&
            !interaction.member.roles.cache.has(id_superadmin)) {
            return interaction.editReply({ content: "❌ Seul un agent du LSPD peut fermer le ticket.", flags: 64 });
        }

        const ticketChannel = interaction.channel;
        const logsChannel = guild.channels.cache.get(logs_tickets);
        if (!logsChannel)
            return interaction.editReply({ content: "❌ Le salon de logs n'existe pas.", flags: 64 });

        try {
            const ticketRes = await db.query('SELECT user_id FROM lspd_tickets WHERE channel_id=?', [ticketChannel.id]);
            const ticketData = ticketRes.rows[0];
            if (!ticketData) {
                return interaction.editReply({ content: "❌ Ce salon n'est pas un ticket valide.", flags: 64 });
            }

            const ticketOwner = ticketData ? await guild.members.fetch(ticketData.user_id).catch(() => null) : null;

            const transcriptBuffer = await createTranscriptMarkdown(ticketChannel);

            const logEmbed = new EmbedBuilder()
                .setTitle('Ticket Fermé')
                .setColor(0x0b1b5a)
                .addFields(
                    { name: 'Salon', value: `#${ticketChannel.name}`, inline: true },
                    { name: 'Fermé par', value: `<@${interaction.user.id}>`, inline: true },
                    {
                        name: 'Date de fermeture',
                        value: `\`${moment().tz("Europe/Paris").format("DD/MM/YYYY HH:mm")}\``,
                        inline: true
                    }
                )
                .setFooter({
                    text: 'LSPD Assistant',
                    iconURL: interaction.client.user.displayAvatarURL({ extension: 'png', size: 256 })
                })
                .setTimestamp(new Date());

            await logsChannel.send({
                embeds: [logEmbed],
                files: [{ attachment: transcriptBuffer, name: `ticket-${ticketChannel.id}.md` }]
            });

            if (ticketOwner) {
                await ticketOwner.send({
                    embeds: [logEmbed],
                    files: [{ attachment: transcriptBuffer, name: `ticket-${ticketChannel.id}.md` }]
                }).catch(() => console.warn(`Impossible d'envoyer le DM à ${ticketOwner.user.tag}`));
            }

            await interaction.editReply({
                content: "⏳ Fermeture du ticket...",
                flags: 64
            });

            await db.query(
                'INSERT INTO lspd_count_tickets(user_id, closedby_id, channel_id) VALUES(?, ?, ?)',
                [ticketData.user_id, interaction.user.id, ticketChannel.id]
            );

            await db.query('DELETE FROM lspd_tickets WHERE channel_id=?', [ticketChannel.id]);

            if (ticketChannel.deletable) {
                await ticketChannel.delete('Ticket fermé');
            }

        } catch (err) {
            console.error("Erreur lors de la fermeture du ticket :", err);
            if (!interaction.replied) {
                await interaction.editReply({ content: "❌ Une erreur est survenue lors de la fermeture du ticket.", flags: 64 });
            }
        }
    },
};
