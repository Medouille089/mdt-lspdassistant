-- Table pour stocker l'historique des patrouilles avec rookies
CREATE TABLE IF NOT EXISTS trello_historiquerookie (
    id SERIAL PRIMARY KEY,
    card_id VARCHAR(255) UNIQUE NOT NULL,
    patrol_name VARCHAR(500) NOT NULL,
    list_name VARCHAR(255) NOT NULL,
    list_id VARCHAR(255) NOT NULL,
    badges JSONB NOT NULL,
    rookies JSONB NOT NULL,
    all_members JSONB NOT NULL,
    rookie_count INTEGER NOT NULL,
    total_count INTEGER NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_historiquerookie_card_id ON trello_historiquerookie(card_id);
CREATE INDEX IF NOT EXISTS idx_historiquerookie_timestamp ON trello_historiquerookie(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_historiquerookie_list_id ON trello_historiquerookie(list_id);

-- Commentaires pour documentation
COMMENT ON TABLE trello_historiquerookie IS 'Historique de toutes les patrouilles contenant des rookies';
COMMENT ON COLUMN trello_historiquerookie.card_id IS 'ID unique de la carte de patrouille dans Trello';
COMMENT ON COLUMN trello_historiquerookie.patrol_name IS 'Nom de la patrouille (ex: A | 52 + 23)';
COMMENT ON COLUMN trello_historiquerookie.list_name IS 'Nom de la liste où était la patrouille';
COMMENT ON COLUMN trello_historiquerookie.badges IS 'Array JSON des matricules dans la patrouille';
COMMENT ON COLUMN trello_historiquerookie.rookies IS 'Array JSON des rookies avec leurs infos détaillées';
COMMENT ON COLUMN trello_historiquerookie.all_members IS 'Array JSON de tous les membres de la patrouille';
COMMENT ON COLUMN trello_historiquerookie.rookie_count IS 'Nombre de rookies dans la patrouille';
COMMENT ON COLUMN trello_historiquerookie.total_count IS 'Nombre total d''agents dans la patrouille';
