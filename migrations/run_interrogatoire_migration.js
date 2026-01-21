const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        console.log('📦 Exécution de la migration: création de la table lspd_rapports_interrogatoire...');
        
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, '20250115_create_rapports_interrogatoire.sql'),
            'utf8'
        );

        await pool.query(migrationSQL);
        
        console.log('✅ Migration terminée avec succès !');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur lors de la migration:', error);
        process.exit(1);
    }
}

runMigration();
