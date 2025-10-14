const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const pool = require('../config/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Ajoute un utilisateur à la blacklist')
    .addUserOption(opt => opt.setName('user').setDescription('Utilisateur à blacklist').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Raison (optionnel)').setRequired(false)),

  async execute(interaction) {
    try {
      const config = require('../config/config').getConfig();
      const commandstaff = config.commandstaff_id ? String(config.commandstaff_id).trim() : null;
      const supervisor = config.supervisor_role_id ? String(config.supervisor_role_id).trim() : null;
      const memberRoles = interaction.member.roles.cache.map(r => r.id);

      // Vérifier permissions (commandstaff ou supervisor)
      const allowed = (commandstaff && memberRoles.includes(commandstaff)) || (supervisor && memberRoles.includes(supervisor));
      if (!allowed) return interaction.reply({ content: 'Permission refusée.', flags: 64 });

      const target = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || null;

      // Vérifier si déjà blacklist
      const res = await pool.query('SELECT discord_id FROM lspd_blacklist WHERE discord_id = $1', [target.id]);
      if (res.rows.length) {
        return interaction.reply({ content: 'Utilisateur déjà blacklist.', flags: 64 });
      }

      await pool.query('INSERT INTO lspd_blacklist (discord_id, created_by, reason) VALUES ($1, $2, $3)', [target.id, interaction.user.id, reason]);

      // Essayer d'ajouter le rôle Discord blacklist_role_id si configuré
      try {
        const cfg = await pool.query('SELECT blacklist_role_id FROM configlspd LIMIT 1');
        const roleId = cfg.rows[0] ? cfg.rows[0].blacklist_role_id : null;
        if (roleId) {
          const bot = require('../config/bot');
          const guild = await bot.guilds.fetch(process.env.GUILD_ID);
          const member = await guild.members.fetch(target.id).catch(() => null);
          if (member) {
            await member.roles.add(String(roleId).trim(), `Blacklisted by ${interaction.user.id}`).catch(err => console.warn('Cannot add blacklist role:', err && err.message));
          }
        }
      } catch (e) { console.error('Erreur ajout role discord blacklist:', e); }

      // Log to logs_config if configured
      try {
        const cfgRes = await pool.query('SELECT logs_config FROM configlspd LIMIT 1');
        const logsChannelId = cfgRes.rows[0] ? cfgRes.rows[0].logs_config : null;
        if (logsChannelId) {
          const bot = require('../config/bot');
          const logsChannel = await bot.channels.fetch(logsChannelId).catch(() => null);
          if (logsChannel?.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle('⚠️ Nouveau blacklist')
              .setColor(0xFF0000)
              .setDescription(`<@${interaction.user.id}> à blacklisté <@${target.id}>`)
              .addFields({ name: "ID's", value: `> <@${interaction.user.id}>\n> (\`${interaction.user.id}\`)\n> <@${target.id}> (\`${target.id}\`)\n> <@${blacklist_role_id}>\n> (\`${blacklist_role_id}\`)`, inline: false })
              .setTimestamp();
            await logsChannel.send({ embeds: [embed] });
          }
        }
      } catch (e) { console.error('Erreur log blacklist cmd:', e); }

      // Invalidate sessions server-side
      try { require('../config/sessionStore').destroySessionsForDiscordId(target.id); } catch (e) {}

      return interaction.reply({ content: `<@${target.id}> à été blacklisté avec succès.`, flags: 64 });
    } catch (err) {
      console.error('Erreur commande blacklist:', err);
      return interaction.reply({ content: 'Erreur interne.', flags: 64 });
    }
  }
};
