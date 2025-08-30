const { EmbedBuilder } = require("discord.js");
const moment = require("moment-timezone");
const db = require("../config/db");

const EMOJIS = {
  present: "🟢",
  retard: "🟠",
  absent: "🔴",
};

const LSPD_ROLE = 1096965866245066801;

/**
 * Envoie la fiche de présence dans le salon configuré.
 * @param {Client} bot 
 * @param {boolean} isReminder Indique si c'est un rappel (true) ou le message principal (false)
 */
async function sendFicheDePresence(bot, isReminder = false) {
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

    // Choix de l'heure selon type de message
    const heureRaw = isReminder ? fiche_de_presence_rappel : fiche_de_presence_hour;

    if (!heureRaw || !/^\d{2}:\d{2}$/.test(heureRaw)) {
      console.error(`⚠️ Heure ${isReminder ? "rappel" : "principale"} invalide ou non configurée`);
      return;
    }

    // Trouver le channel
    const channel = await bot.channels.fetch(fiche_de_presence_id);
    if (!channel) {
      console.error("⚠️ Salon fiche de présence introuvable");
      return;
    }

    // Description selon rappel ou pas
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

    // Envoyer le message
    const message = await channel.send({ content: `<@&1096965866245066801>`, embeds: [embed] });

    // Ajout du message dans la table


    // Ajouter réactions que pour le message principal uniquement
    if (!isReminder) {
      await db.query(
        "INSERT INTO lspd_presenceig (message_id) VALUES ($1)",
        [await message.id]
      );
      await message.react(EMOJIS.present);
      await message.react(EMOJIS.retard);
      await message.react(EMOJIS.absent);
    }
  } catch (error) {
    console.error("Erreur dans sendFicheDePresence:", error);
  }
}

module.exports = { sendFicheDePresence };
