-- Migration pour créer la table des rapports d'interrogatoire
CREATE TABLE IF NOT EXISTS lspd_rapports_interrogatoire (
    id SERIAL PRIMARY KEY,
    date_interrogatoire DATE NOT NULL,
    heure_interrogatoire TIME NOT NULL,
    officier_redacteur VARCHAR(255) NOT NULL,
    grade_redacteur VARCHAR(255),
    citoyen_id INTEGER REFERENCES citoyens(id),
    citoyen_nom VARCHAR(255),
    citoyen_prenom VARCHAR(255),
    citoyen_date_naissance DATE,
    droits_cites BOOLEAN DEFAULT false,
    recit TEXT NOT NULL,
    infos_complementaires TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour améliorer les performances de recherche
CREATE INDEX IF NOT EXISTS idx_rapports_interrogatoire_date ON lspd_rapports_interrogatoire(date_interrogatoire);
CREATE INDEX IF NOT EXISTS idx_rapports_interrogatoire_citoyen ON lspd_rapports_interrogatoire(citoyen_id);
CREATE INDEX IF NOT EXISTS idx_rapports_interrogatoire_officier ON lspd_rapports_interrogatoire(officier_redacteur);
