const { Pool } = require("pg");
const { DATABASE_URL } = require("./env");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // Configuration pour éviter les connexions perdues
  max: 20, // Maximum de connexions dans le pool
  idleTimeoutMillis: 30000, // Fermer les connexions inactives après 30s
  connectionTimeoutMillis: 10000, // Timeout pour obtenir une connexion
  keepAlive: true, // Garder les connexions actives
  keepAliveInitialDelayMillis: 10000, // Délai avant le premier keepalive
});

// Gérer les erreurs de connexion au niveau du pool
pool.on('error', (err, client) => {
  console.error('Erreur inattendue sur un client idle du pool PostgreSQL:', err);
  // Ne pas crasher l'application, le pool va gérer la reconnexion
});

// Sauvegarder la méthode query originale
const originalQuery = pool.query.bind(pool);

// Remplacer la méthode query par une version avec retry automatique
pool.query = async function(text, params) {
  const maxRetries = 3;
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await originalQuery(text, params);
    } catch (err) {
      lastError = err;
      
      // Vérifier si c'est une erreur de connexion
      const isConnectionError = 
        err.message?.includes('Connection terminated') ||
        err.message?.includes('ECONNRESET') ||
        err.message?.includes('ETIMEDOUT') ||
        err.message?.includes('ECONNREFUSED') ||
        err.code === 'PROTOCOL_CONNECTION_LOST' ||
        err.code === '57P01'; // PostgreSQL: terminating connection
      
      if (isConnectionError && i < maxRetries - 1) {
        console.log(`⚠️  Erreur de connexion DB (tentative ${i + 1}/${maxRetries}), retry dans ${(i + 1) * 500}ms...`);
        await new Promise(resolve => setTimeout(resolve, (i + 1) * 500));
        continue;
      }
      
      // Si ce n'est pas une erreur de connexion ou dernière tentative, throw
      throw err;
    }
  }
  
  throw lastError;
};

// Fonction helper pour les requêtes avec retry (alias pour compatibilité)
pool.queryWithRetry = pool.query;

module.exports = pool;
