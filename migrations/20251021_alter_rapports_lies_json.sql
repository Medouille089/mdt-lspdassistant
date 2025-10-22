ALTER TABLE lspd_arrestations
ALTER COLUMN rapports_lies TYPE json USING rapports_lies::json;