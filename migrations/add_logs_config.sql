ALTER TABLE configlspd ADD COLUMN logs_config VARCHAR;

-- Insère l'ID du salon pour la colonne logs_config
UPDATE configlspd SET logs_config = '1426731973757370468';