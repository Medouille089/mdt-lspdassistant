-- Migration : Ajout de nouvelles colonnes de formations à lspd_formations
ALTER TABLE lspd_formations
ADD COLUMN plongee_role_id VARCHAR(255),
ADD COLUMN parachute_role_id VARCHAR(255),
ADD COLUMN premiers_secours_role_id VARCHAR(255),
ADD COLUMN bomb_squad_role_id VARCHAR(255);

-- Mise à jour de la première ligne avec les nouveaux rôles
UPDATE lspd_formations SET
  plongee_role_id = '1427328045047484487',
  parachute_role_id = '1427328245270970573',
  premiers_secours_role_id = '1427612124057833582',
  bomb_squad_role_id = '1395866356754157568'
WHERE id = 1;
