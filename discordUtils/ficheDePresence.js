const { EmbedBuilder } = require("discord.js");
const db = require("../config/db");
const { getConfig } = require("../config/config"); // <-- ajouté

const EMOJIS = {
  present: "🟢",
  retard: "🟠",
  absent: "🔴",
};

// Vérifie si on est en local
const IS_LOCAL = (process.env.IS_LOCAL || "").trim().toLowerCase() === "true";

async function sendFicheDePresence(bot, isReminder = false) {
  if (IS_LOCAL) {
    return;
  }

  try {
    const res = await db.query(
      "SELECT fiche_de_presence_id, fiche_de_presence_hour, fiche_de_presence_rappel FROM configlspd LIMIT 1"
    );

    if (!res.rows.length) {
      console.error("⚠️ Aucune config fiche de présence trouvée en BDD");
      return;
    }

    const { fiche_de_presence_id, fiche_de_presence_hour, fiche_de_presence_rappel } = res.rows[0];

    if (!fiche_de_presence_id) {
      console.error("⚠️ Aucun salon fiche de présence configuré");
      return;
    }

    const heureRaw = isReminder ? fiche_de_presence_rappel : fiche_de_presence_hour;

    if (!heureRaw || !/^\d{2}:\d{2}$/.test(heureRaw)) {
      console.error(`⚠️ Heure ${isReminder ? "rappel" : "principale"} invalide ou non configurée`);
      return;
    }

    const channel = await bot.channels.fetch(fiche_de_presence_id);
    if (!channel?.isTextBased()) {
      console.error("⚠️ Salon fiche de présence introuvable ou non textuel");
      return;
    }

    const descriptionPrincipal =
      `Présence à **20h55** en salle de dispatch du Poste de Police\n\n` +
      `Présent : ${EMOJIS.present}\n` +
      `Retard : ${EMOJIS.retard}\n` +
      `Absent : ${EMOJIS.absent}\n\n` +
      `Absences à justifier si la durée de celles-ci sont de plus de deux jours.\n\n` +
      `Si vous cochez présent, il est obligatoire que vous soyez présent en Salle de Dispatch.\n` +
      `Réaction obligatoire 🔼`;

    const descriptionRappel =
      `**Rappel:** présence en salle de dispatch du Poste de Police.\n\n` +
      `Merci de confirmer votre présence ou absence.\n La réaction est obligatoire!`;

    const embed = new EmbedBuilder()
      .setColor("#0b1b5a")
      .setTitle("Dispatch")
      .setDescription(isReminder ? descriptionRappel : descriptionPrincipal)
      .setFooter({
        text: "LSPD Assistant",
        iconURL: bot.user.displayAvatarURL(),
      })
      .setTimestamp()
      .setThumbnail(bot.user.displayAvatarURL());

    // Récupération du rôle depuis la config
    const { required_role_id } = getConfig();

    // Envoi du message
    const message = await channel.send({ content: `<@&${required_role_id}>`, embeds: [embed] });

    if (!isReminder) {
      await db.query(
        "INSERT INTO lspd_presenceig (message_id) VALUES ($1)",
        [message.id]
      );
      await message.react(EMOJIS.present);
      await message.react(EMOJIS.retard);
      await message.react(EMOJIS.absent);
    }

  } catch (error) {
    console.error("❌ Erreur dans sendFicheDePresence:", error);
  }
}

module.exports = { sendFicheDePresence };
