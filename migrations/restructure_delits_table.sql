-- Migration pour restructurer la table lspd_delit
-- Ajout d'une colonne peine séparée de amende

-- Étape 1: Ajouter la nouvelle colonne 'peine' (temps de peine)
ALTER TABLE lspd_delit ADD COLUMN IF NOT EXISTS peine TEXT;

-- Étape 2: Ajouter une colonne 'commentaire' pour des notes supplémentaires
ALTER TABLE lspd_delit ADD COLUMN IF NOT EXISTS commentaire TEXT;

-- Étape 3: Ajouter une colonne 'id' si elle n'existe pas déjà (clé primaire)
ALTER TABLE lspd_delit ADD COLUMN IF NOT EXISTS id SERIAL PRIMARY KEY;

-- Étape 3: Optionnel - Si vous voulez nettoyer les données existantes
-- Vous pouvez mettre à jour manuellement les enregistrements où amende contient aussi le temps
-- UPDATE lspd_delit SET peine = '00:00' WHERE peine IS NULL;

-- Étape 4: Ajouter des contraintes pour la cohérence
ALTER TABLE lspd_delit ALTER COLUMN chef_accusation SET NOT NULL;
ALTER TABLE lspd_delit ALTER COLUMN type SET NOT NULL;

-- Étape 5: Créer un index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_lspd_delit_type ON lspd_delit(type);
CREATE INDEX IF NOT EXISTS idx_lspd_delit_code_article ON lspd_delit(code_article);

-- Étape 6: Ajouter des timestamps pour tracer les modifications
ALTER TABLE lspd_delit ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE lspd_delit ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Structure finale de la table lspd_delit :
-- id              SERIAL PRIMARY KEY
-- chef_accusation TEXT NOT NULL
-- code_article    TEXT
-- type            TEXT NOT NULL (ex: 'Contravention', 'Delit mineur', 'Delit majeur', 'Crime')
-- amende          TEXT (ex: '100$', '500$', etc.)
-- peine           TEXT (ex: '00:10', '01:30', etc.)
-- commentaire     TEXT (ex: 'Saisie du véhicule', 'Circonstances aggravantes', etc.)
-- created_at      TIMESTAMPTZ
-- updated_at      TIMESTAMPTZ
