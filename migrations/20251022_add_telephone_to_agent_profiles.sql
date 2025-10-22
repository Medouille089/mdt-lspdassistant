-- Migration : Ajout du champ téléphone à lspd_agent_profiles
ALTER TABLE lspd_agent_profiles ADD COLUMN telephone VARCHAR(20);