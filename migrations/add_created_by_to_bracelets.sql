-- Ajoute la colonne created_by pour stocker l'ID Discord du créateur du bracelet
ALTER TABLE bracelets ADD COLUMN created_by VARCHAR(32);
