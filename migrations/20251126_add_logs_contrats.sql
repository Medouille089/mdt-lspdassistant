-- Migration: add logs_contrats to configlspd
-- Ajoute la colonne pour l'ID du channel de logs des contrats

ALTER TABLE configlspd ADD COLUMN IF NOT EXISTS logs_contrats VARCHAR(255);
