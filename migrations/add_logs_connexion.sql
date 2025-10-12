ALTER TABLE configlspd ADD COLUMN logs_connexion VARCHAR;

-- Insère l'ID du salon pour la colonne logs_connexion
UPDATE configlspd SET logs_connexion = '1426731999703339028';