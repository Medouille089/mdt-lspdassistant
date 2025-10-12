const { EmbedBuilder } = require("discord.js");
const db = require("../config/db");
const { getConfig } = require("../config/config");

module.exports = async function handleTicket(interaction, bot) {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "select_ticket_category") return;

    try {
        await interaction.deferReply({ flags: 64 });

        const catId = interaction.values[0];
        const catRes = await db.query(
            "SELECT * FROM lspd_ticket_categories WHERE id=$1",
            [catId]
        );
        const category = catRes.rows[0];

        if (!category) {
            return interaction.editReply({ content: "❌ Catégorie invalide" });
        }

        const guild = interaction.guild;

        // Utiliser displayName pour le nom initial
        const displayName = interaction.member.displayName || interaction.user.username;
        const safeName =
            `${category.prefix || "ticket"}-${displayName.replace(/\s+/g, "-").toLowerCase().slice(0, 50)}`;

        let channel;
        try {
            channel = await guild.channels.create({
                name: safeName,
                type: 0, // text channel
                parent: category.target_channel_id || null,
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: ["ViewChannel"] },
                    { id: interaction.user.id, allow: ["ViewChannel", "SendMessages"] },
                    ...(category.roles || []).map((rid) => ({
                        id: rid,
                        allow: ["ViewChannel", "SendMessages"],
                    })),
                ],
            });
        } catch (err) {
            // DiscordAPIError for invalid parent_id
            if (err.code === 50035 && err.rawError?.errors?.parent_id) {
                console.error("Erreur DiscordAPI: parent_id (catégorie) invalide lors de la création du ticket.", err);
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ content: "❌ Erreur : la catégorie cible n'existe pas ou n'est pas valide. Veuillez contacter un administrateur." });
                } else {
                    await interaction.reply({ content: "❌ Erreur : la catégorie cible n'existe pas ou n'est pas valide. Veuillez contacter un administrateur.", flags: 64 });
                }
                return;
            } else {
                throw err;
            }
        }

        const nowUTC = new Date().toISOString();
        await db.query(
            "INSERT INTO lspd_tickets(user_id, category_id, channel_id, created_at) VALUES($1,$2,$3,$4)",
            [interaction.user.id, category.id, channel.id, nowUTC]
        );

        const color = category.embed_color
            ? parseInt(category.embed_color.replace("#", ""), 16)
            : 0x00ff00;

        await channel.send({
            content: `<@${interaction.user.id}> ${(category.roles || []).map(r => `<@&${r}>`).join(" ")}`,
            embeds: [
                {
                    title: `${category.emoji || ""} ${category.title}`,
                    description: category.welcome_message || category.description || "Votre ticket a été ouvert.",
                    color,
                    timestamp: new Date(),
                    footer: {
                        text: bot.user.username,
                        icon_url: bot.user.displayAvatarURL(),
                    },
                },
            ],
        });

        // Logs
        const conf = getConfig();
        if (conf.logs_tickets) {
            const logsChannel = await bot.channels.fetch(conf.logs_tickets).catch(() => null);
            if (logsChannel?.isTextBased()) {
                const ticketEmbed = new EmbedBuilder()
                    .setTitle("Ticket créé")
                    .setDescription("Voici les détails du ticket.")
                    .addFields(
                        { name: "Utilisateur", value: `<@${interaction.user.id}>`, inline: true },
                        { name: "Type de ticket", value: category.prefix || "Non défini", inline: true },
                        { name: "Catégorie", value: category.target_channel_id ? `<#${category.target_channel_id}>` : "Aucune", inline: true },
                        { name: "Salon du ticket", value: `<#${channel.id}>`, inline: false },
                        {
                            name: "Date de création",
                            value: `\`${new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date())}\``,
                            inline: true,
                        }
                    )
                    .setFooter({
                        text: "LSMS Assistant",
                        iconURL: interaction.client.user.displayAvatarURL({ extension: "png", size: 256 }),
                    })
                    .setColor(0x0b1b5a)
                    .setTimestamp();

                await logsChannel.send({ embeds: [ticketEmbed] });
            }
        }

        // Fonction pour renommer si un autre membre avec required_role_id écrit en premier
        const filter = (msg) => !msg.author.bot;
        const collector = channel.createMessageCollector({ filter, max: 1, time: 3600000 }); // 1h max


        collector.on("collect", async (msg) => {
            const memberRoles = msg.member.roles.cache.map(r => r.id);
            const requiredRole = conf.required_role_id?.toString(); // force string pour comparer

            // si ce n'est pas le créateur et qu'il a le rôle requis
            if (msg.author.id !== interaction.user.id && requiredRole && memberRoles.includes(requiredRole)) {
                // prend les 2 premiers chiffres de son displayName
                const matriculeMatch = msg.member.displayName.match(/\d{2}/);
                const matricule = matriculeMatch ? matriculeMatch[0] : msg.member.displayName.slice(0, 2).toUpperCase();

                // nom de base du ticket : prefix-displayName
                const baseName = channel.name;

                // renomme en ajoutant le matricule devant
                const newName = `${matricule}-${baseName}`;
                await channel.setName(newName).catch(console.error);
            }
        });

        await interaction.editReply({ content: `✅ Ticket créé : ${channel}` });
    } catch (err) {
        console.error("Erreur lors de l'ouverture du ticket :", err);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ Erreur lors de la création du ticket." });
        } else {
            await interaction.reply({ content: "❌ Erreur lors de la création du ticket.", flags: 64 });
        }
    }
};
