-- Migration: create table citoyens
-- Crée la table citoyens pour recenser les citoyens avec leurs informations personnelles
-- Cette table servira de référence pour les futurs véhicules, armes, et propriétés

CREATE TABLE IF NOT EXISTS citoyens (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(255) NOT NULL,
    prenom VARCHAR(255) NOT NULL,
    date_naissance DATE NOT NULL,
    nationalite VARCHAR(100) NOT NULL,
    genre VARCHAR(50) NOT NULL,
    telephone VARCHAR(20),
    adresse TEXT,
    gang_affilie VARCHAR(255),
    note_interne TEXT,
    emploi VARCHAR(255),
    mandat_actif BOOLEAN NOT NULL DEFAULT FALSE,
    photo TEXT,
    permis_A BOOLEAN NOT NULL DEFAULT FALSE,
    permis_B BOOLEAN NOT NULL DEFAULT FALSE,
    permis_C BOOLEAN NOT NULL DEFAULT FALSE,
    permis_PPA BOOLEAN NOT NULL DEFAULT FALSE,
    permis_BRAVO BOOLEAN NOT NULL DEFAULT FALSE,
    permis_ASD BOOLEAN NOT NULL DEFAULT FALSE,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);


-- Index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_citoyens_nom ON citoyens(nom);
CREATE INDEX IF NOT EXISTS idx_citoyens_prenom ON citoyens(prenom);
CREATE INDEX IF NOT EXISTS idx_citoyens_telephone ON citoyens(telephone);
CREATE INDEX IF NOT EXISTS idx_citoyens_mandat_actif ON citoyens(mandat_actif);

-- Trigger pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_citoyens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_citoyens_updated_at
    BEFORE UPDATE ON citoyens
    FOR EACH ROW
    EXECUTE FUNCTION update_citoyens_updated_at();
