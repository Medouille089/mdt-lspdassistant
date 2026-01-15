-- Migration pour les rapports d'enquête
-- Création de la table principale des rapports d'enquête

CREATE TABLE IF NOT EXISTS lspd_rapports_enquete (
    id SERIAL PRIMARY KEY,
    numero_dossier VARCHAR(50) UNIQUE NOT NULL,
    superviseur_id INTEGER,
    superviseur_nom VARCHAR(100),
    superviseur_prenom VARCHAR(100),
    superviseur_matricule VARCHAR(50),
    sujet TEXT NOT NULL,
    motifs TEXT NOT NULL,
    infos_complementaires TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100)
);

-- Table de liaison pour les agents assignés à l'enquête
CREATE TABLE IF NOT EXISTS lspd_enquete_agents (
    id SERIAL PRIMARY KEY,
    enquete_id INTEGER NOT NULL,
    agent_id INTEGER,
    agent_nom VARCHAR(100),
    agent_prenom VARCHAR(100),
    agent_matricule VARCHAR(50),
    CONSTRAINT fk_enquete_agents FOREIGN KEY (enquete_id) REFERENCES lspd_rapports_enquete(id) ON DELETE CASCADE
);

-- Table de liaison pour les citoyens suspects
CREATE TABLE IF NOT EXISTS lspd_enquete_suspects (
    id SERIAL PRIMARY KEY,
    enquete_id INTEGER NOT NULL,
    citoyen_id INTEGER,
    citoyen_nom VARCHAR(100),
    citoyen_prenom VARCHAR(100),
    CONSTRAINT fk_enquete_suspects FOREIGN KEY (enquete_id) REFERENCES lspd_rapports_enquete(id) ON DELETE CASCADE,
    CONSTRAINT fk_citoyen_suspect FOREIGN KEY (citoyen_id) REFERENCES citoyens(id) ON DELETE SET NULL
);

-- Table de liaison pour les rapports liés
CREATE TABLE IF NOT EXISTS lspd_enquete_rapports (
    id SERIAL PRIMARY KEY,
    enquete_id INTEGER NOT NULL,
    rapport_type VARCHAR(50) NOT NULL, -- 'arrestation', 'interrogatoire', 'incident', etc.
    rapport_id INTEGER NOT NULL,
    rapport_titre TEXT,
    rapport_date DATE,
    CONSTRAINT fk_enquete_rapports FOREIGN KEY (enquete_id) REFERENCES lspd_rapports_enquete(id) ON DELETE CASCADE
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_enquete_numero ON lspd_rapports_enquete(numero_dossier);
CREATE INDEX IF NOT EXISTS idx_enquete_superviseur ON lspd_rapports_enquete(superviseur_id);
CREATE INDEX IF NOT EXISTS idx_enquete_agents_enquete ON lspd_enquete_agents(enquete_id);
CREATE INDEX IF NOT EXISTS idx_enquete_suspects_enquete ON lspd_enquete_suspects(enquete_id);
CREATE INDEX IF NOT EXISTS idx_enquete_rapports_enquete ON lspd_enquete_rapports(enquete_id);
CREATE INDEX IF NOT EXISTS idx_enquete_rapports_type ON lspd_enquete_rapports(rapport_type, rapport_id);

-- Fonction pour générer un numéro de dossier unique (format: ENQ-YYYY-XXXX)
CREATE OR REPLACE FUNCTION generate_numero_dossier()
RETURNS TEXT AS $$
DECLARE
    year_part TEXT;
    counter INTEGER;
    new_numero TEXT;
BEGIN
    year_part := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    SELECT COUNT(*) + 1 INTO counter
    FROM lspd_rapports_enquete
    WHERE numero_dossier LIKE 'ENQ-' || year_part || '-%';
    
    new_numero := 'ENQ-' || year_part || '-' || LPAD(counter::TEXT, 4, '0');
    
    RETURN new_numero;
END;
$$ LANGUAGE plpgsql;
