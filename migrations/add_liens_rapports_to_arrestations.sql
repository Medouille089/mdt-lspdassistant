ALTER TABLE lspd_arrestations
ALTER COLUMN rapports_lies TYPE JSON USING rapports_lies::json;
-- Passe la colonne rapports_lies en JSON simple (comme accusations)