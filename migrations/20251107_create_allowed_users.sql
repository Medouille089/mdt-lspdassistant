-- Migration pour créer la table allowed_users
-- Cette table permet de donner un bypass complet aux utilisateurs listés
-- pour exécuter la commande /blacklist sans vérification de rôles

CREATE TABLE IF NOT EXISTS allowed_users (
    id SERIAL PRIMARY KEY,
    discord_id VARCHAR(255) NOT NULL UNIQUE,
    added_by VARCHAR(255),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    note TEXT
);

-- Index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_allowed_users_discord_id ON allowed_users(discord_id);

-- Commentaires sur la table et les colonnes
COMMENT ON TABLE allowed_users IS 'Liste des utilisateurs Discord autorisés à exécuter /blacklist sans vérification de rôles';
COMMENT ON COLUMN allowed_users.discord_id IS 'ID Discord de l''utilisateur autorisé';
COMMENT ON COLUMN allowed_users.added_by IS 'ID Discord de l''utilisateur qui a ajouté cet utilisateur à la liste';
COMMENT ON COLUMN allowed_users.added_at IS 'Date et heure d''ajout';
COMMENT ON COLUMN allowed_users.note IS 'Note optionnelle sur l''utilisateur autorisé';