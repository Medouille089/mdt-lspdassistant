-- Migration: Ajout du champ calibre à weapon_models
ALTER TABLE weapon_models
ADD COLUMN IF NOT EXISTS calibre VARCHAR(64);
