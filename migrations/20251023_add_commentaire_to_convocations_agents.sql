-- Migration pour ajouter la colonne commentaire à lspd_convocations_agents
ALTER TABLE lspd_convocations_agents ADD COLUMN commentaire TEXT;