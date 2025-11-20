-- Migration: create table recruitment_submissions (full)
-- Crée la table recruitment_submissions avec une colonne par champ de formulaire

CREATE TABLE IF NOT EXISTS recruitment_submissions (
    id SERIAL PRIMARY KEY,
    discord_id VARCHAR(255),
    username VARCHAR(255),
    channel_id VARCHAR(255),
    -- Individual form fields
    fullname TEXT,
    dob TEXT,
    nationality TEXT,
    quality1 TEXT,
    quality2 TEXT,
    quality3 TEXT,
    defect1 TEXT,
    defect2 TEXT,
    defect3 TEXT,
    same_without_uniform TEXT,
    motivations TEXT,
    availabilities TEXT,
    desired_rank TEXT,
    good_police TEXT,
    missions TEXT,
    good_station TEXT,
    rank_order TEXT,
    main_weapon TEXT,
    etat_major TEXT,
    radio_codes TEXT,
    inferiority TEXT,
    entry_plans TEXT,
    division_choice TEXT,
    supervision_role TEXT,
    avis TEXT,
    -- Raw payload and metadata
    payload JSONB NOT NULL,
    banner_url TEXT,
    preface TEXT,
    sent BOOLEAN DEFAULT FALSE,
    error_text TEXT,
    message_ids JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recruitment_submissions_discord_id ON recruitment_submissions(discord_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_submissions_channel_id ON recruitment_submissions(channel_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_submissions_fullname ON recruitment_submissions(fullname);

COMMENT ON TABLE recruitment_submissions IS 'Table complète des candidatures (une colonne par champ et payload JSON complet)';
COMMENT ON COLUMN recruitment_submissions.payload IS 'Payload JSON complet de la soumission';
COMMENT ON COLUMN recruitment_submissions.message_ids IS 'IDs des messages Discord envoyés (JSON array)';
