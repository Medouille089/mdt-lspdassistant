-- Migration: create table weapons
-- Stocke les armes enregistrées (modèle référencé + données dérivées, numéro de série, propriétaire)

CREATE TABLE IF NOT EXISTS weapons (
    id SERIAL PRIMARY KEY,
    model_id INTEGER REFERENCES weapon_models(id) ON DELETE SET NULL,
    model_name VARCHAR(255) NOT NULL,
    model_image_url TEXT,
    serial_number VARCHAR(255) NOT NULL,
    owner_id INTEGER REFERENCES citoyens(id) ON DELETE SET NULL,
    owner_name VARCHAR(511),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_weapons_serial ON weapons(serial_number);
CREATE INDEX IF NOT EXISTS idx_weapons_owner ON weapons(owner_id);

CREATE OR REPLACE FUNCTION update_weapons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_weapons_updated_at
    BEFORE UPDATE ON weapons
    FOR EACH ROW
    EXECUTE FUNCTION update_weapons_updated_at();
