const mysql = require("mysql2/promise");
const { DATABASE_URL } = require("./env");

// Parse MySQL connection URL (mysql://user:pass@host:port/database)
const parseConnectionString = (url) => {
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) {
    throw new Error('Invalid MySQL connection string format');
  }
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4]),
    database: match[5]
  };
};

const config = parseConnectionString(DATABASE_URL);

const pool = mysql.createPool({
  ...config,
  waitForConnections: true,
  connectionLimit: 20, // Maximum de connexions dans le pool
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // Délai avant le premier keepalive
  connectTimeout: 10000, // Timeout pour obtenir une connexion
});

// Gérer les erreurs de connexion au niveau du pool
pool.on('error', (err) => {
  console.error('Erreur inattendue sur un client idle du pool MySQL:', err);
  // Ne pas crasher l'application, le pool va gérer la reconnexion
});

// Sauvegarder la méthode query originale
const originalQuery = pool.query.bind(pool);

// Wrapper pour compatibilité avec l'ancien code PostgreSQL
// MySQL2 retourne [rows, fields] au lieu de { rows, ... }
pool.query = async function(sql, params) {
  const maxRetries = 3;
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const [rows, fields] = await originalQuery(sql, params);
      // Retourner un objet compatible avec l'ancien code PostgreSQL
      return { rows, fields };
    } catch (err) {
      lastError = err;
      
      // Vérifier si c'est une erreur de connexion
      const isConnectionError = 
        err.message?.includes('Connection terminated') ||
        err.message?.includes('ECONNRESET') ||
        err.message?.includes('ETIMEDOUT') ||
        err.message?.includes('ECONNREFUSED') ||
        err.code === 'PROTOCOL_CONNECTION_LOST' ||
        err.errno === 2013 || // Lost connection to MySQL server
        err.errno === 2006; // MySQL server has gone away
      
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
