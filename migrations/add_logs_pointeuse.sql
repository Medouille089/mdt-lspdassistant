ALTER TABLE configlspd ADD COLUMN logs_pointeuse VARCHAR;

-- Insère l'ID du salon pour la colonne logs_pointeuse
UPDATE configlspd SET logs_pointeuse = '1426730229614903326';