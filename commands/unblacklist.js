const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../config/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unblacklist')
    .setDescription('Retire un utilisateur de la blacklist')
    .addUserOption(opt => opt.setName('user').setDescription('Utilisateur à un-blacklist').setRequired(true)),

  async execute(interaction) {
    try {
      const config = require('../config/config').getConfig();
      const commandstaff = config.commandstaff_id ? String(config.commandstaff_id).trim() : null;
      const supervisor = config.supervisor_role_id ? String(config.supervisor_role_id).trim() : null;
      const memberRoles = interaction.member.roles.cache.map(r => r.id);

      const allowed = (commandstaff && memberRoles.includes(commandstaff)) || (supervisor && memberRoles.includes(supervisor));
      if (!allowed) return interaction.reply({ content: 'Permission refusée.', flags: 64 });

      const target = interaction.options.getUser('user');

      const res = await pool.query('SELECT discord_id FROM lspd_blacklist WHERE discord_id = $1', [target.id]);
      if (!res.rows.length) {
        return interaction.reply({ content: 'Utilisateur non présent dans la blacklist.', flags: 64 });
      }

      await pool.query('DELETE FROM lspd_blacklist WHERE discord_id = $1', [target.id]);

      // Essayer de retirer le rôle Discord blacklist_role_id si configuré
      try {
        const cfg = await pool.query('SELECT blacklist_role_id FROM configlspd LIMIT 1');
        const roleId = cfg.rows[0] ? cfg.rows[0].blacklist_role_id : null;
        if (roleId) {
          const bot = require('../config/bot');
          const guild = await bot.guilds.fetch(process.env.GUILD_ID);
          const member = await guild.members.fetch(target.id).catch(() => null);
          if (member) {
            await member.roles.remove(String(roleId).trim(), `Un-blacklisted by ${interaction.user.id}`).catch(err => console.warn('Cannot remove blacklist role:', err && err.message));
          }
        }
      } catch (e) { console.error('Erreur retrait role discord blacklist:', e); }

      // Log to logs_config if configured
      try {
        const cfgRes = await pool.query('SELECT logs_config FROM configlspd LIMIT 1');
        const logsChannelId = cfgRes.rows[0] ? cfgRes.rows[0].logs_config : null;
        if (logsChannelId) {
          const bot = require('../config/bot');
          const logsChannel = await bot.channels.fetch(logsChannelId).catch(() => null);
          if (logsChannel?.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle('⚠️ Utilisateur un-blacklist')
              .setColor(0x00FF00)
              .setDescription(`<@${interaction.user.id}> a un-blacklisté <@${target.id}>`)
              .addFields({ name: "ID's", value: `> <@${interaction.user.id}>\n> (\`${interaction.user.id}\`)\n> <@${target.id}> (\`${target.id}\`)\n> <@${blacklist_role_id}>\n> (\`${blacklist_role_id}\`)`, inline: false })
              .setTimestamp();
            await logsChannel.send({ embeds: [embed] });
          }
        }
      } catch (e) { console.error('Erreur log unblacklist cmd:', e); }

      return interaction.reply({ content: `<@${target.id}> à été retiré de la blacklist.`, flags: 64 });
    } catch (err) {
      console.error('Erreur commande unblacklist:', err);
      return interaction.reply({ content: 'Erreur interne.', flags: 64 });
    }
  }
};
