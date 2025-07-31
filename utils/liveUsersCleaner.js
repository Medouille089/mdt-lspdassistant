const pool = require('../config/db');

function cleanOldUsers() {
  pool.query(`
    DELETE FROM lspd_live_users
    WHERE last_seen < NOW() - INTERVAL '3 minutes'
  `).then(() => {
    console.log('[LiveUsersCleaner] Nettoyage des utilisateurs inactifs.');
  }).catch(err => {
    console.error('[LiveUsersCleaner] Erreur nettoyage:', err);
  });
}

setInterval(cleanOldUsers, 60 * 1000);
