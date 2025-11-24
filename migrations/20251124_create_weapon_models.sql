-- Migration: create table weapon_models
-- Catalogue des modèles d'armes (nom + url image)

CREATE TABLE IF NOT EXISTS weapon_models (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(255) NOT NULL UNIQUE,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_weapon_models_name ON weapon_models(model_name);

CREATE OR REPLACE FUNCTION update_weapon_models_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_weapon_models_updated_at
    BEFORE UPDATE ON weapon_models
    FOR EACH ROW
    EXECUTE FUNCTION update_weapon_models_updated_at();
