require('dotenv').config(); // Charge les variables d'environnement
const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require("discord.js");
const db = require("../config/db");
const { getConfig, getBot } = require("../config/config");

// Fonction utilitaire locale
async function safeFetchChannel(bot, channelId) {
  try {
    return await bot.channels.fetch(channelId);
  } catch (err) {
    console.error(`❌ Impossible de récupérer le salon ${channelId}:`, err.message);
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("send_fiche_panel")
    .setDescription("Configure le salon, l'heure et le rappel pour la fiche de présence.")
    .addChannelOption((option) =>
      option
        .setName("salon")
        .setDescription("Salon où envoyer la fiche")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("heure")
        .setDescription("Heure principale au format HH:mm (Paris)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("rappel")
        .setDescription("Heure de rappel au format HH:mm (Paris)")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const bot = getBot();
      const conf = getConfig();

      // --- Vérification roles commandstaff_id ou id_superadmin ---
      const commandStaffRoleId = conf.commandstaff_id?.toString();
      const superAdminRoleId = conf.id_superadmin?.toString();
      const memberRoles = interaction.member.roles.cache;

      if (
        (!commandStaffRoleId || !memberRoles.has(commandStaffRoleId)) &&
        (!superAdminRoleId || !memberRoles.has(superAdminRoleId))
      ) {
        return interaction.reply({
          content: "❌ Vous devez être un membre du Command Staff pour exécuter cette commande.",
          flags: 64,
        });
      }

      const salon = interaction.options.getChannel("salon");
      const heure = interaction.options.getString("heure");
      const rappel = interaction.options.getString("rappel");

      const re = /^\d{2}:\d{2}$/;
      if (!re.test(heure) || !re.test(rappel)) {
        return interaction.reply({
          content: "❌ Les heures doivent être au format HH:mm (ex: 17:35).",
          flags: 64,
        });
      }

      if (!salon.isTextBased()) {
        return interaction.reply({
          content: "❌ Veuillez choisir un salon texte valide.",
          flags: 64,
        });
      }

      // Récupération config actuelle depuis la BDD
      const { rows } = await db.query(`
        SELECT fiche_de_presence_id, fiche_de_presence_hour, fiche_de_presence_rappel
        FROM configlspd WHERE id = 1
      `);
      const oldConfig = rows[0];

      // Mise à jour BDD
      await db.query(
        `UPDATE configlspd
         SET fiche_de_presence_id = ?,
             fiche_de_presence_hour = ?,
             fiche_de_presence_rappel = ?
         WHERE id = 1`,
        [salon.id, heure, rappel]
      );

      // Logs si pas en local
      if ((process.env.IS_LOCAL || "").trim().toLowerCase() !== "true") {
        const logsChannel = await safeFetchChannel(bot, conf.logs_channel);
        if (
          logsChannel &&
          (oldConfig.fiche_de_presence_id !== salon.id ||
            oldConfig.fiche_de_presence_hour !== heure ||
            oldConfig.fiche_de_presence_rappel !== rappel)
        ) {
          const embed = new EmbedBuilder()
            .setColor("#FF0000")
            .setTitle("Fiche de présence modifiée")
            .setDescription(`<@${interaction.user.id}> a mis à jour la configuration de la fiche de présence.`)
            .addFields(
              {
                name: "Salon",
                value: `Avant: <#${oldConfig.fiche_de_presence_id}> (\`${oldConfig.fiche_de_presence_id}\`)\nAprès: <#${salon.id}> (\`${salon.id}\`)`,
                inline: false,
              },
              {
                name: "Heure principale",
                value: `Avant: \`${oldConfig.fiche_de_presence_hour}\`\nAprès: \`${heure}\``,
                inline: true,
              },
              {
                name: "Heure de rappel",
                value: `Avant: \`${oldConfig.fiche_de_presence_rappel}\`\nAprès: \`${rappel}\``,
                inline: true,
              },
              {
                name: "ID's",
                value: `> <@${interaction.user.id}> (\`${interaction.user.id}\`)\n> <#${oldConfig.fiche_de_presence_id}> (\`${oldConfig.fiche_de_presence_id}\`)\n> <#${salon.id}> (\`${salon.id}\`)`,
                inline: false,
              }
            )
            .setFooter({
              text: "LSPD Assistant",
              iconURL: bot.user.displayAvatarURL({ extension: "png", size: 256 }),
            })
            .setTimestamp();

          await logsChannel.send({ embeds: [embed] });
        }
      }

      return interaction.reply({
        content: `✅ Configuration enregistrée :\nSalon: ${salon}\nHeure principale: ${heure}\nHeure rappel: ${rappel}`,
        flags: 64,
      });
    } catch (error) {
      console.error("❌ Erreur lors de la mise à jour de la config fiche de présence:", error);
      return interaction.reply({
        content: "❌ Une erreur est survenue lors de la mise à jour de la configuration.",
        flags: 64,
      });
    }
  },
};
