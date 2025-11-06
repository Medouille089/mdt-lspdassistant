-- Migration pour ajouter la colonne logs_trello à la table configlspd
-- Date: 2025-11-06
-- Description: Ajout du salon de logs pour les actions Trello

-- Ajouter la colonne logs_trello
ALTER TABLE configlspd 
ADD COLUMN IF NOT EXISTS logs_trello character varying(255);

-- Commentaire pour la documentation
COMMENT ON COLUMN configlspd.logs_trello IS 'ID du salon Discord pour les logs des actions Trello (création, modification, suppression, déplacement de cards/listes)';

-- Insérer l'ID du salon de logs Trello par défaut
UPDATE configlspd 
SET logs_trello = '1435938086650515476'
WHERE logs_trello IS NULL;
