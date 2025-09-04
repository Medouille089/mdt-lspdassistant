const { DateTime } = require("luxon");
const { EmbedBuilder } = require("discord.js");
const pool = require("../config/db");
const { getBot } = require("../config/config");

async function checkOvertimePunches() {
    const clientDiscord = getBot();

    // Récupérer la config dans la BDD (une ligne)
    const configRes = await pool.query(`
        SELECT pointeuse_alert, heure_pointeuse_alerte
        FROM configlspd
        LIMIT 1
    `);

    // Met à jour la colonne pointeuse_alerte dans la table configlspd
    // Exemple : await pool.query(`UPDATE configlspd SET pointeuse_alerte = $1`, [nouvelleValeur]);

    if (!configRes.rows.length) return;

    const { pointeuse_alert: alertChannelId, heure_pointeuse_alerte: heureAlerte } = configRes.rows[0];
    if (!alertChannelId || !heureAlerte) return;

    const alertChannel = await clientDiscord.channels.fetch(alertChannelId);
    if (!alertChannel?.isTextBased()) return;

    const nowParis = DateTime.now().setZone("Europe/Paris");
    const [heure, minute] = heureAlerte.split(":").map(Number);

    // Vérifier si l'heure actuelle correspond à l'heure d'alerte
    if (nowParis.hour === heure && nowParis.minute === minute) {
        const result = await pool.query(`
            SELECT id_discord, start_time
            FROM lspd_pointage
            WHERE end_time IS NULL
        `);

        for (const row of result.rows) {
            const userId = row.id_discord;

            const embed = new EmbedBuilder()
                .setColor(0x0b1b5a)
                .setTitle("Dépassement horaire")
                .setDescription(`Vous avez dépassé l'horaire limite qui est de **${heure}h${minute.toString().padStart(2, '0')}**.\nMerci de couper votre pointeuse.`)
                .setThumbnail(clientDiscord.user.displayAvatarURL({ extension: 'png', size: 256 }))
                .setFooter({
                    text: "LSPD Assistant",
                    iconURL: clientDiscord.user.displayAvatarURL({ extension: 'png', size: 256 })
                })
                .setTimestamp();

            await alertChannel.send({ content: `<@${userId}>`, embeds: [embed] });
        }
    }
}

function startOvertimeScheduler() {
    setInterval(checkOvertimePunches, 60 * 1000);
}

module.exports = { startOvertimeScheduler };
