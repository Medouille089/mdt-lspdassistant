-- Migration: Add versioning support to trello_historiquerookie
-- This allows keeping history of patrol modifications instead of overwriting

-- Add version number column
ALTER TABLE trello_historiquerookie 
ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;

-- Add superseded_at timestamp (when this version was replaced by a new one)
ALTER TABLE trello_historiquerookie 
ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMP;

-- Add superseded_by_id to reference the new version
ALTER TABLE trello_historiquerookie 
ADD COLUMN IF NOT EXISTS superseded_by_id INT REFERENCES trello_historiquerookie(id);

-- Add index for faster lookups by card_id
CREATE INDEX IF NOT EXISTS idx_historiquerookie_card_id ON trello_historiquerookie(card_id);

-- Add index for active (non-superseded) entries
CREATE INDEX IF NOT EXISTS idx_historiquerookie_active ON trello_historiquerookie(card_id) WHERE superseded_at IS NULL;
