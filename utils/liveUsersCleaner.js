const pool = require('../config/db');

function cleanOldUsers() {
  pool.query(`
    DELETE FROM lspd_live_users
    WHERE last_seen < NOW() - INTERVAL '5 minutes'
  `).then(() => {
  }).catch(err => {
    console.error('[LiveUsersCleaner] Erreur nettoyage:', err);
  });
}

// Exécute toutes les 5 minutes
setInterval(cleanOldUsers, 5 * 60 * 1000);
