-- Table pour stocker les logs du Trello
CREATE TABLE IF NOT EXISTS trello_logs (
    id SERIAL PRIMARY KEY,
    log_type VARCHAR(50) NOT NULL, -- 'CREATE_CARD', 'CREATE_LIST', 'UPDATE_CARD', 'UPDATE_LIST', 'DELETE_CARD', 'DELETE_LIST', 'MOVE_CARD', 'RESET'
    user_id VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    action_description TEXT NOT NULL,
    details JSONB, -- Contient toutes les infos détaillées (nom, liste, changements, etc.)
    created_at TIMESTAMP DEFAULT NOW(),
    color VARCHAR(10) DEFAULT '0x0b1b5a' -- Couleur de l'embed (hex)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_trello_logs_created_at ON trello_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trello_logs_type ON trello_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_trello_logs_user ON trello_logs(user_id);

-- Commentaires
COMMENT ON TABLE trello_logs IS 'Logs des actions effectuées sur le Trello';
COMMENT ON COLUMN trello_logs.log_type IS 'Type d''action : CREATE_CARD, CREATE_LIST, UPDATE_CARD, UPDATE_LIST, DELETE_CARD, DELETE_LIST, MOVE_CARD, RESET';
COMMENT ON COLUMN trello_logs.details IS 'Détails JSON : {cardName, listName, changes: [{field, oldValue, newValue}], etc.}';
COMMENT ON COLUMN trello_logs.color IS 'Couleur pour l''affichage (format hex comme 0xFF0000 pour rouge)';
