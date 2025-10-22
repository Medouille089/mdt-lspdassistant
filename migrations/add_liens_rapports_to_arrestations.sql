ALTER TABLE lspd_arrestations
ALTER COLUMN rapports_lies TYPE JSON USING rapports_lies::json;