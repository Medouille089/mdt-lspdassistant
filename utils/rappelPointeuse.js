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

            // Récupérer le membre pour son displayName
            const member = await alertChannel.guild.members.fetch(userId).catch(() => null);
            const displayName = member ? member.displayName : "Utilisateur inconnu";

            const embed = new EmbedBuilder()
                .setColor(0xFFFFFF)
                .setTitle("Dépassement horaire")
                .setDescription(`${displayName} a dépassé l'horaire limite qui est de **${heure}h${minute.toString().padStart(2, '0')}**.`)
                .addFields([
                    { name: "ID's", value: `> <@${userId}> (\`${userId}\`)`, inline: true }
                ])
                .setThumbnail(clientDiscord.user.displayAvatarURL({ extension: 'png', size: 256 }))
                .setFooter({
                    text: "LSPD Assistant",
                    iconURL: clientDiscord.user.displayAvatarURL({ extension: 'png', size: 256 })
                })
                .setTimestamp();

            await alertChannel.send({ embeds: [embed] });
        }
    }
}

function startOvertimeScheduler() {
    setInterval(checkOvertimePunches, 60 * 1000);
}

module.exports = { startOvertimeScheduler };
