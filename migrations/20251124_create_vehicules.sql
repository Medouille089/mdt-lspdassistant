-- Migration: create table vehicules
-- Crée la table vehicules pour recenser les véhicules avec leurs informations
-- Cette table est liée à la table citoyens pour les propriétaires

CREATE TABLE IF NOT EXISTS vehicules (
    id SERIAL PRIMARY KEY,
    modele VARCHAR(255) NOT NULL,
    plaque VARCHAR(50) NOT NULL UNIQUE,
    couleur VARCHAR(100),
    proprietaire_id INTEGER REFERENCES citoyens(id) ON DELETE SET NULL,
    mandat_actif BOOLEAN NOT NULL DEFAULT FALSE,
    photo TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

-- Index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_vehicules_modele ON vehicules(modele);
CREATE INDEX IF NOT EXISTS idx_vehicules_plaque ON vehicules(plaque);
CREATE INDEX IF NOT EXISTS idx_vehicules_proprietaire_id ON vehicules(proprietaire_id);
CREATE INDEX IF NOT EXISTS idx_vehicules_mandat_actif ON vehicules(mandat_actif);

-- Trigger pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_vehicules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vehicules_updated_at
    BEFORE UPDATE ON vehicules
    FOR EACH ROW
    EXECUTE FUNCTION update_vehicules_updated_at();
