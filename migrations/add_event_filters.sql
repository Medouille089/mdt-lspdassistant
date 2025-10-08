-- Migration: Ajouter les filtres de grades et personnes aux événements du calendrier
-- Date: 2025-10-08
-- Description: Permet de filtrer la visibilité des événements selon les grades et personnes concernées

-- Ajouter les colonnes pour les filtres
ALTER TABLE evenements_calendrier 
ADD COLUMN IF NOT EXISTS grades_concernes TEXT[],
ADD COLUMN IF NOT EXISTS personnes_concernees TEXT[];

-- Créer des index pour améliorer les performances des requêtes de filtrage
CREATE INDEX IF NOT EXISTS idx_evenements_grades ON evenements_calendrier USING GIN (grades_concernes);
CREATE INDEX IF NOT EXISTS idx_evenements_personnes ON evenements_calendrier USING GIN (personnes_concernees);

-- Commentaires sur les colonnes
COMMENT ON COLUMN evenements_calendrier.grades_concernes IS 'IDs des rôles Discord des grades concernés par l''événement. NULL = visible pour tous';
COMMENT ON COLUMN evenements_calendrier.personnes_concernees IS 'IDs Discord des personnes spécifiquement concernées par l''événement. NULL = pas de filtre personnel';
