-- Migration pour refactoriser la structure des rapports d'incident
-- Ajouter le support des IDs Discord pour les agents rédacteurs et impliqués

-- Ajouter colonne pour l'ID Discord de l'agent rédacteur
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS officier_redacteur_id VARCHAR(20);

-- Ajouter colonne id pour la foreign key si elle n'existe pas dans incidents
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS id SERIAL;

-- Créer un index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_incidents_redacteur_id ON incidents(officier_redacteur_id);

-- Créer table de liaison pour les agents impliqués dans un incident
CREATE TABLE IF NOT EXISTS incident_agents (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER NOT NULL,
    agent_discord_id VARCHAR(20) NOT NULL,
    agent_nom VARCHAR(100),
    agent_prenom VARCHAR(100),
    agent_matricule VARCHAR(10),
    role VARCHAR(20) DEFAULT 'implique',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_incident_agents_incident ON incident_agents(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_agents_discord ON incident_agents(agent_discord_id);
CREATE INDEX IF NOT EXISTS idx_incident_agents_role ON incident_agents(role);

-- Commentaires pour documentation
COMMENT ON TABLE incident_agents IS 'Table de liaison pour les agents impliqués dans les incidents';
COMMENT ON COLUMN incident_agents.role IS 'Role de l''agent: redacteur ou implique';
COMMENT ON COLUMN incidents.officier_redacteur_id IS 'ID Discord de l''agent rédacteur';
