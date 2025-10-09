/**
 * Script pour créer la table trello_historiquerookie
 * 
 * Usage: node migrations/run_rookie_patrols_migration.js
 */

const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        console.log('🚀 Début de la migration trello_historiquerookie...\n');

        // Lire le fichier SQL
        const sqlFilePath = path.join(__dirname, 'create_rookie_patrols_table.sql');
        const sql = fs.readFileSync(sqlFilePath, 'utf8');

        console.log('📄 Fichier SQL chargé');
        console.log('─'.repeat(60));

        // Exécuter le script SQL
        await pool.query(sql);

        console.log('✅ Table trello_historiquerookie créée avec succès !');
        console.log('─'.repeat(60));

        // Vérifier que la table a bien été créée
        const checkTable = await pool.query(`
            SELECT table_name, column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = 'trello_historiquerookie'
            ORDER BY ordinal_position;
        `);

        if (checkTable.rows.length > 0) {
            console.log('\n📋 Structure de la table :');
            console.log('─'.repeat(60));
            checkTable.rows.forEach(col => {
                console.log(`  • ${col.column_name.padEnd(20)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
            });
        }

        // Vérifier les index
        const checkIndexes = await pool.query(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'trello_historiquerookie';
        `);

        if (checkIndexes.rows.length > 0) {
            console.log('\n🔍 Index créés :');
            console.log('─'.repeat(60));
            checkIndexes.rows.forEach(idx => {
                console.log(`  • ${idx.indexname}`);
            });
        }

        console.log('\n✨ Migration terminée avec succès !');
        console.log('─'.repeat(60));
        
        process.exit(0);

    } catch (error) {
        console.error('❌ Erreur lors de la migration :', error.message);
        console.error('\nDétails de l\'erreur :');
        console.error(error);
        process.exit(1);
    }
}

// Exécuter la migration
runMigration();
