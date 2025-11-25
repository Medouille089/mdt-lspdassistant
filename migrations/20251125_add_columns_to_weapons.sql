-- Migration: Ajout des colonnes calibre, etat, notes à la table weapons
ALTER TABLE weapons
ADD COLUMN IF NOT EXISTS calibre VARCHAR(64),
ADD COLUMN IF NOT EXISTS notes TEXT;
