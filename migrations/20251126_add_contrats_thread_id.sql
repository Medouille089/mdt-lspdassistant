-- Migration: add contrats_thread_id to configlspd
-- Ajoute la colonne pour l'ID du channel/forum des contrats

ALTER TABLE configlspd ADD COLUMN IF NOT EXISTS contrats_thread_id VARCHAR(255);
