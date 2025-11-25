-- Migration : Création/Modification de la table lspd_agent_profiles pour MySQL

-- Vérifier et créer la table si elle n'existe pas
CREATE TABLE IF NOT EXISTS lspd_agent_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  discord_id VARCHAR(255) UNIQUE NOT NULL,
  photo_url TEXT,
  telephone VARCHAR(20),
  numero_casier VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Si la table existe déjà sans AUTO_INCREMENT, modifier la colonne id
ALTER TABLE lspd_agent_profiles MODIFY COLUMN id INT AUTO_INCREMENT;

-- Index sur discord_id pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_agent_profiles_discord_id ON lspd_agent_profiles(discord_id);
