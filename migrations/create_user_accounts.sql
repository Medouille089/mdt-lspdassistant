-- Migration pour créer la table des comptes utilisateurs
-- Cette table lie les comptes Discord aux comptes locaux avec login/mot de passe

CREATE TABLE IF NOT EXISTS user_accounts (
    id SERIAL PRIMARY KEY,
    discord_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_user_accounts_discord_id ON user_accounts(discord_id);
CREATE INDEX IF NOT EXISTS idx_user_accounts_username ON user_accounts(username);
CREATE INDEX IF NOT EXISTS idx_user_accounts_email ON user_accounts(email);
CREATE INDEX IF NOT EXISTS idx_user_accounts_reset_token ON user_accounts(reset_token);

-- Commentaires pour la documentation
COMMENT ON TABLE user_accounts IS 'Table des comptes utilisateurs liés à Discord';
COMMENT ON COLUMN user_accounts.discord_id IS 'ID Discord de l''utilisateur (unique)';
COMMENT ON COLUMN user_accounts.username IS 'Nom d''utilisateur pour la connexion locale';
COMMENT ON COLUMN user_accounts.password_hash IS 'Hash bcrypt du mot de passe';
COMMENT ON COLUMN user_accounts.email IS 'Email optionnel pour la récupération de mot de passe';
COMMENT ON COLUMN user_accounts.reset_token IS 'Token de réinitialisation de mot de passe';
COMMENT ON COLUMN user_accounts.reset_token_expires IS 'Date d''expiration du token de réinitialisation';
COMMENT ON COLUMN user_accounts.is_active IS 'Indique si le compte est actif';
