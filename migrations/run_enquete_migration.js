const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('🚀 Début de la migration des rapports d\'enquête...');

        const migrationSQL = fs.readFileSync(
            path.join(__dirname, '20250115_create_rapports_enquete.sql'),
            'utf8'
        );

        await client.query(migrationSQL);

        console.log('✅ Migration terminée avec succès !');
        console.log('Tables créées:');
        console.log('  - lspd_rapports_enquete');
        console.log('  - lspd_enquete_agents');
        console.log('  - lspd_enquete_suspects');
        console.log('  - lspd_enquete_rapports');
        console.log('Fonction créée: generate_numero_dossier()');

    } catch (error) {
        console.error('❌ Erreur lors de la migration:', error);
        throw error;
    } finally {
        client.release();
        process.exit(0);
    }
}

runMigration()
    .then(() => {
        console.log('\n✨ Migration complète !');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n💥 Échec de la migration:', err);
        process.exit(1);
    });
