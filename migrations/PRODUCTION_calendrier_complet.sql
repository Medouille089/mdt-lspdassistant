-- ============================================================================
-- MIGRATION COMPLÈTE : SYSTÈME DE CALENDRIER PARTAGÉ LSPD
-- Date: 2025-10-08
-- Description: Création de la table des événements avec filtrage par grades et personnes
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CRÉATION DE LA TABLE PRINCIPALE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evenements_calendrier (
    id SERIAL PRIMARY KEY,
    titre VARCHAR(255) NOT NULL,
    description TEXT,
    date_debut TIMESTAMP NOT NULL,
    date_fin TIMESTAMP NOT NULL,
    type_evenement VARCHAR(50) NOT NULL, -- 'reunion', 'formation', 'operation', 'autre'
    couleur VARCHAR(7) DEFAULT '#3498db', -- Code couleur hexadécimal
    auteur VARCHAR(255) NOT NULL,
    participants TEXT[], -- Array de noms de participants (historique, peu utilisé)
    lieu VARCHAR(255),
    grades_concernes TEXT[], -- IDs des rôles Discord concernés (NULL = visible pour tous)
    personnes_concernees TEXT[], -- IDs Discord des personnes concernées (NULL = pas de filtre)
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_modification TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 2. CRÉATION DES INDEX POUR PERFORMANCES
-- ----------------------------------------------------------------------------

-- Index pour les recherches par date
CREATE INDEX IF NOT EXISTS idx_evenements_date 
ON evenements_calendrier(date_debut, date_fin);

-- Index pour les filtres par type
CREATE INDEX IF NOT EXISTS idx_evenements_type 
ON evenements_calendrier(type_evenement);

-- Index GIN pour les recherches dans les tableaux de grades
CREATE INDEX IF NOT EXISTS idx_evenements_grades 
ON evenements_calendrier USING GIN (grades_concernes);

-- Index GIN pour les recherches dans les tableaux de personnes
CREATE INDEX IF NOT EXISTS idx_evenements_personnes 
ON evenements_calendrier USING GIN (personnes_concernees);

-- ----------------------------------------------------------------------------
-- 3. AJOUT DE LA CONFIGURATION DISCORD LOGS
-- ----------------------------------------------------------------------------

-- Ajouter la colonne pour le canal de logs du calendrier dans la config
ALTER TABLE configlspd 
ADD COLUMN IF NOT EXISTS logs_channel_calendrier VARCHAR(255);

-- ----------------------------------------------------------------------------
-- 4. COMMENTAIRES SUR LES COLONNES (DOCUMENTATION)
-- ----------------------------------------------------------------------------

COMMENT ON TABLE evenements_calendrier IS 'Table des événements du calendrier partagé LSPD';

COMMENT ON COLUMN evenements_calendrier.id IS 'Identifiant unique de l''événement';
COMMENT ON COLUMN evenements_calendrier.titre IS 'Titre de l''événement';
COMMENT ON COLUMN evenements_calendrier.description IS 'Description détaillée de l''événement';
COMMENT ON COLUMN evenements_calendrier.date_debut IS 'Date et heure de début de l''événement';
COMMENT ON COLUMN evenements_calendrier.date_fin IS 'Date et heure de fin de l''événement';
COMMENT ON COLUMN evenements_calendrier.type_evenement IS 'Type: reunion, formation, operation, autre';
COMMENT ON COLUMN evenements_calendrier.couleur IS 'Couleur hexadécimale pour l''affichage (#3498db par défaut)';
COMMENT ON COLUMN evenements_calendrier.auteur IS 'Nom de la personne ayant créé l''événement';
COMMENT ON COLUMN evenements_calendrier.participants IS 'Liste des participants (legacy, peu utilisé)';
COMMENT ON COLUMN evenements_calendrier.lieu IS 'Lieu de l''événement';
COMMENT ON COLUMN evenements_calendrier.grades_concernes IS 'IDs des rôles Discord des grades concernés. NULL = visible pour tous';
COMMENT ON COLUMN evenements_calendrier.personnes_concernees IS 'IDs Discord des personnes spécifiquement concernées. NULL = pas de filtre personnel';
COMMENT ON COLUMN evenements_calendrier.date_creation IS 'Date de création de l''événement';
COMMENT ON COLUMN evenements_calendrier.date_modification IS 'Date de dernière modification';

-- ----------------------------------------------------------------------------
-- 5. VÉRIFICATION ET AFFICHAGE
-- ----------------------------------------------------------------------------

-- Afficher la structure de la table créée
\d evenements_calendrier

-- Afficher le nombre d'événements existants
SELECT COUNT(*) as total_evenements FROM evenements_calendrier;

-- Vérifier que la colonne logs a été ajoutée à configlspd
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'configlspd' 
AND column_name = 'logs_channel_calendrier';

-- ----------------------------------------------------------------------------
-- 6. CONFIGURATION INITIALE (OPTIONNEL)
-- ----------------------------------------------------------------------------

-- Mettre à jour le canal de logs (remplacer 'VOTRE_CHANNEL_ID' par l'ID Discord réel)
-- UPDATE configlspd SET logs_channel_calendrier = 'VOTRE_CHANNEL_ID' WHERE id = 1;

-- ----------------------------------------------------------------------------
-- NOTES D'UTILISATION
-- ----------------------------------------------------------------------------

/*
LOGIQUE DE FILTRAGE:
- grades_concernes = NULL ET personnes_concernees = NULL → Visible pour TOUS
- grades_concernes CONTIENT role_id → Visible pour ce grade
- personnes_concernees CONTIENT user_id → Visible pour cette personne
- Si les deux sont définis → Visible si utilisateur dans grades OU dans personnes

EXEMPLES:
1. Événement public:
   INSERT INTO evenements_calendrier (titre, date_debut, date_fin, type_evenement, auteur)
   VALUES ('Briefing général', '2025-10-15 20:00', '2025-10-15 21:00', 'reunion', 'Chef LSPD');

2. Événement pour les Sergents et plus:
   INSERT INTO evenements_calendrier (titre, date_debut, date_fin, type_evenement, auteur, grades_concernes)
   VALUES ('Réunion commandement', '2025-10-16 20:00', '2025-10-16 21:00', 'reunion', 'Chef LSPD', 
           ARRAY['role_id_sergent', 'role_id_lieutenant', 'role_id_capitaine']);

3. Événement pour des personnes spécifiques:
   INSERT INTO evenements_calendrier (titre, date_debut, date_fin, type_evenement, auteur, personnes_concernees)
   VALUES ('Formation rookie', '2025-10-17 19:00', '2025-10-17 20:00', 'formation', 'FTO John',
           ARRAY['discord_user_id_1', 'discord_user_id_2']);
*/

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================
