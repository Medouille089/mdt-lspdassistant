-- Migration: create table contrats
-- Stocke les contrats LSPD avec les entreprises

CREATE TABLE IF NOT EXISTS contrats (
    id SERIAL PRIMARY KEY,
    numero_contrat VARCHAR(50) NOT NULL UNIQUE,
    nom_entreprise VARCHAR(255) NOT NULL,
    representant_entreprise VARCHAR(255),
    contact_entreprise VARCHAR(255),
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    duree_mois INTEGER NOT NULL,
    objet_contrat TEXT NOT NULL,
    clauses JSONB NOT NULL DEFAULT '[]'::jsonb,
    statut VARCHAR(50) DEFAULT 'actif',
    officier_responsable VARCHAR(255) NOT NULL,
    grade_officier VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_contrats_numero ON contrats(numero_contrat);
CREATE INDEX IF NOT EXISTS idx_contrats_entreprise ON contrats(nom_entreprise);
CREATE INDEX IF NOT EXISTS idx_contrats_statut ON contrats(statut);
CREATE INDEX IF NOT EXISTS idx_contrats_dates ON contrats(date_debut, date_fin);

CREATE OR REPLACE FUNCTION update_contrats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_contrats_updated_at
    BEFORE UPDATE ON contrats
    FOR EACH ROW
    EXECUTE FUNCTION update_contrats_updated_at();
