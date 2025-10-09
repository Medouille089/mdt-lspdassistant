const pool = require('../config/db');
const { getBot, getConfig } = require('../config/config');
const { EmbedBuilder } = require('discord.js');

// --- Helper ---
function formatDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR');
}

async function cleanSanctions() {
    try {
        const bot = getBot();
        if (!bot?.isReady()) return;

        const guild = await bot.guilds.fetch(process.env.GUILD_ID);
        const config = getConfig();
        const requiredRoleId = config.required_role_id;

        // Récupération du salon de logs depuis la config
        let logsChannel = null;
        if (config.logs_channel) {
            logsChannel = await bot.channels.fetch(config.logs_channel).catch(() => null);
            if (!logsChannel?.isTextBased()) logsChannel = null;
        }

        // Récupère toutes les sanctions
        const result = await pool.query(`SELECT * FROM lspd_sanctions`);
        const sanctions = result.rows;

        if (!sanctions.length) return ;

        // IDs Discord uniques
        const uniqueIds = [...new Set(sanctions.map(s => s.player_discord_id))];

        // Fetch seulement ces membres
        const membersMap = new Map();
        for (const id of uniqueIds) {
            try {
                const member = await guild.members.fetch(id);
                membersMap.set(id, member);
            } catch {
                membersMap.set(id, null);
            }
        }

        const now = new Date();
        const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
        const deletedSanctions = [];

        for (const sanction of sanctions) {
            const member = membersMap.get(sanction.player_discord_id);
            const memberName = member?.displayName || sanction.player_id;

            const hasRole = member?.roles.cache.has(requiredRoleId) || false;

            if (hasRole) {
                if (sanction.role_removed_at) {
                    await pool.query(
                        `UPDATE lspd_sanctions SET role_removed_at = NULL WHERE id = $1`,
                        [sanction.id]
                    );
                }
            } else {
                if (!sanction.role_removed_at) {
                    await pool.query(
                        `UPDATE lspd_sanctions SET role_removed_at = NOW() WHERE id = $1`,
                        [sanction.id]
                    );
                } else {
                    const removedAt = new Date(sanction.role_removed_at);
                    const diffMs = now - removedAt;

                    if (diffMs >= oneMonthMs) {
                        await pool.query(`DELETE FROM lspd_sanctions WHERE id = $1`, [sanction.id]);
                        deletedSanctions.push(sanction);

                        // Retire tous les rôles de sanction
                        if (member) {
                            const roleRes = await pool.query(`SELECT id_discord FROM lspd_sanctions_roles`);
                            for (const r of roleRes.rows) {
                                const role = member.roles.cache.get(r.id_discord);
                                if (role) await member.roles.remove(role).catch(err => {
                                    console.error(`❌ Erreur retrait rôle ${r.id_discord} à ${memberName}:`, err);
                                });
                            }
                        }
                    }
                }
            }
        }

        // Log après la boucle si suppressions
        if (logsChannel && deletedSanctions.length) {
            const userIds = [...new Set(deletedSanctions.map(s => s.player_discord_id))];
            const idsField = userIds.map(id => `<@${id}> (\`${id}\`)`).join('\n');

            const embedLog = new EmbedBuilder()
                .setColor(0xffa500)
                .setTitle(`Sanctions supprimées automatiquement`)
                .setDescription(`Les sanctions des personnes suivantes ont été supprimées car le rôle <@&${requiredRoleId}> n'était plus présent depuis plus d'1 mois.`)
                .addFields([{ name: "ID's", value: idsField }])
                .setFooter({
                    text: "LSPD Assistant",
                    iconURL: bot?.user?.displayAvatarURL({ extension: 'png', size: 256 })
                })
                .setTimestamp();

            await logsChannel.send({ embeds: [embedLog] });
        }

    } catch (err) {
        console.error('❌ Erreur cleanSanctions:', err);
    }
}

// --- Planification quotidienne à minuit ---
function scheduleDailySanctionCheck() {
    const now = new Date();
    const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0, 0, 0, 0
    );
    const msUntilMidnight = nextMidnight - now;

    setTimeout(() => {
        cleanSanctions();
        setInterval(cleanSanctions, 24 * 60 * 60 * 1000); // tous les jours
    }, msUntilMidnight);

}

scheduleDailySanctionCheck();

module.exports = { cleanSanctions };
