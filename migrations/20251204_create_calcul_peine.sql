CREATE TABLE IF NOT EXISTS calcul_peine (
    id SERIAL PRIMARY KEY,
    citizen_id INTEGER REFERENCES citoyens(id),
    officer_id VARCHAR(255),
    date TIMESTAMP DEFAULT NOW(),
    details JSONB,
    total_amende INTEGER,
    total_peine VARCHAR(50)
);

ALTER TABLE rapport_arrestation
ADD COLUMN calcul_peine_id INTEGER REFERENCES calcul_peine(id);
