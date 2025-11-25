-- Migration : Ajouter AUTO_INCREMENT à lspd_pointage.id
ALTER TABLE lspd_pointage MODIFY COLUMN id INT AUTO_INCREMENT PRIMARY KEY;
