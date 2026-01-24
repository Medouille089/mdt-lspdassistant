const pool = require('./config/db');

/**
 * Script pour appliquer la migration de refonte des rapports d'incident
 * Usage: node apply-migration.js
 */

async function executeSql(description, sql) {
    console.log(`\n📝 ${description}...`);
    try {
        await pool.query(sql);
        console.log(`   ✅ Succès`);
        return true;
    } catch (err) {
        if (err.code === '42P07' || err.code === '42710' || err.code === '42701') {
            console.log(`   ⚠️  Déjà existant (ignoré)`);
            return true;
        } else {
            console.log(`   ❌ Erreur: ${err.message}`);
            return false;
        }
    }
}

async function applyMigration() {
    console.log('🔄 Début de l\'application de la migration...\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        // Étape 1: Ajouter colonne id si elle n'existe pas
        await executeSql(
            'Ajout colonne id dans incidents',
            'ALTER TABLE incidents ADD COLUMN IF NOT EXISTS id SERIAL'
        );

        // Étape 2: Ajouter colonne officier_redacteur_id
        await executeSql(
            'Ajout colonne officier_redacteur_id',
            'ALTER TABLE incidents ADD COLUMN IF NOT EXISTS officier_redacteur_id VARCHAR(20)'
        );

        // Étape 3: Créer index sur officier_redacteur_id
        await executeSql(
            'Création index idx_incidents_redacteur_id',
            'CREATE INDEX IF NOT EXISTS idx_incidents_redacteur_id ON incidents(officier_redacteur_id)'
        );

        // Étape 4: Créer table incident_agents
        await executeSql(
            'Création table incident_agents',
            `CREATE TABLE IF NOT EXISTS incident_agents (
        id SERIAL PRIMARY KEY,
        incident_id INTEGER NOT NULL,
        agent_discord_id VARCHAR(20) NOT NULL,
        agent_nom VARCHAR(100),
        agent_prenom VARCHAR(100),
        agent_matricule VARCHAR(10),
        role VARCHAR(20) DEFAULT 'implique',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
        );

        // Étape 5: Créer index sur incident_id
        await executeSql(
            'Création index idx_incident_agents_incident',
            'CREATE INDEX IF NOT EXISTS idx_incident_agents_incident ON incident_agents(incident_id)'
        );

        // Étape 6: Créer index sur agent_discord_id
        await executeSql(
            'Création index idx_incident_agents_discord',
            'CREATE INDEX IF NOT EXISTS idx_incident_agents_discord ON incident_agents(agent_discord_id)'
        );

        // Étape 7: Créer index sur role
        await executeSql(
            'Création index idx_incident_agents_role',
            'CREATE INDEX IF NOT EXISTS idx_incident_agents_role ON incident_agents(role)'
        );

        // Vérification finale
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n🔍 Vérification des modifications...\n');

        const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'incidents' 
      AND column_name = 'officier_redacteur_id'
    `);

        if (checkColumn.rows.length > 0) {
            console.log('✅ Colonne "officier_redacteur_id" créée dans incidents');
        }

        const checkTable = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'incident_agents'
    `);

        if (checkTable.rows.length > 0) {
            console.log('✅ Table "incident_agents" créée');

            const columns = await pool.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.columns 
        WHERE table_name = 'incident_agents'
      `);
            console.log(`   └─ ${columns.rows[0].count} colonnes`);
        }

        console.log('\n✅ Migration appliquée avec succès !');
        console.log('🎉 Vous pouvez maintenant utiliser le nouveau système\n');

    } catch (error) {
        console.error('\n❌ Erreur critique:\n', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

applyMigration();
