ALTER TABLE configlspd ADD COLUMN logs_documentation VARCHAR;
ALTER TABLE configlspd ADD COLUMN logs_rapport_rookie VARCHAR;
ALTER TABLE configlspd ADD COLUMN logs_sanctions VARCHAR;
ALTER TABLE configlspd ADD COLUMN logs_tickets VARCHAR;

UPDATE configlspd SET logs_documentation = '1426758317522419873';
UPDATE configlspd SET logs_rapport_rookie = '1426758370244956290';
UPDATE configlspd SET logs_sanctions = '1426758412477268059';
UPDATE configlspd SET logs_tickets = '1426758471746850879';