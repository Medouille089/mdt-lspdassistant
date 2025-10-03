-- Table des catégories de FAQ
CREATE TABLE IF NOT EXISTS lspd_faq_categories (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(60) NOT NULL,
    ordre INT DEFAULT 0
);

-- Table des entrées de FAQ
CREATE TABLE IF NOT EXISTS lspd_faq_entries (
    id SERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES lspd_faq_categories(id) ON DELETE CASCADE,
    titre VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    image TEXT,
    ordre INT DEFAULT 0,
    date_ajout TIMESTAMP DEFAULT NOW(),
    auteur_id VARCHAR(32)
);
