const { Pool } = require('pg');
require('dotenv').config();

const pool = require('../config/db');

async function migrate() {
    try {
        await pool.query(`
            ALTER TABLE lspd_grades 
            ADD COLUMN IF NOT EXISTS division_enquete_role_id TEXT;
        `);
        console.log('Column division_enquete_role_id added to lspd_grades');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        // En pool on ne ferme peut-être pas tout de suite, mais ici c'est un script standalone
        process.exit(0);
    }
}

migrate();
