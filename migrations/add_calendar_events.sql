-- Migration pour ajouter la table des événements du calendrier partagé
CREATE TABLE IF NOT EXISTS evenements_calendrier (
    id SERIAL PRIMARY KEY,
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    date_debut TIMESTAMP NOT NULL,
    date_fin TIMESTAMP NOT NULL,
    type_evenement VARCHAR(50) NOT NULL, -- 'reunion', 'formation', 'operation', 'autre'
    couleur VARCHAR(7) DEFAULT '#3498db', -- Code couleur hexadécimal
    auteur VARCHAR(255) NOT NULL,
    participants TEXT[], -- Array de noms de participants
    lieu VARCHAR(255),
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_modification TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_evenements_date ON evenements_calendrier(date_debut, date_fin);
CREATE INDEX IF NOT EXISTS idx_evenements_type ON evenements_calendrier(type_evenement);

-- Ajouter la colonne pour le canal de logs du calendrier
ALTER TABLE configlspd ADD COLUMN IF NOT EXISTS logs_channel_calendrier VARCHAR(255);
