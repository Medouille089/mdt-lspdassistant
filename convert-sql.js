const fs = require('fs');
const path = require('path');

// Fonction pour convertir une requête SQL PostgreSQL vers MySQL
function convertSQLQuery(content) {
    let result = content;

    // 1. Convertir les paramètres $1, $2, etc. vers ?
    // On doit remplacer de $99 vers $1 pour éviter les conflits
    for (let i = 99; i >= 1; i--) {
        const regex = new RegExp(`\\$${i}(?![0-9])`, 'g');
        result = result.replace(regex, '?');
    }

    // 2. Convertir INTERVAL
    result = result.replace(/INTERVAL\s+'(\d+)\s+days?'/gi, 'INTERVAL $1 DAY');
    result = result.replace(/INTERVAL\s+'(\d+)\s+hours?'/gi, 'INTERVAL $1 HOUR');
    result = result.replace(/INTERVAL\s+'(\d+)\s+minutes?'/gi, 'INTERVAL $1 MINUTE');
    result = result.replace(/INTERVAL\s+'(\d+)\s+months?'/gi, 'INTERVAL $1 MONTH');
    result = result.replace(/INTERVAL\s+'(\d+)\s+years?'/gi, 'INTERVAL $1 YEAR');

    // 3. CURRENT_DATE -> CURDATE()
    result = result.replace(/CURRENT_DATE/gi, 'CURDATE()');
    result = result.replace(/CURRENT_TIMESTAMP/gi, 'NOW()');

    // 4. Casts PostgreSQL
    result = result.replace(/(\w+)::date/gi, 'DATE($1)');
    result = result.replace(/::jsonb/gi, '');
    result = result.replace(/::json/gi, '');
    result = result.replace(/::text\[\]/gi, '');
    result = result.replace(/::varchar\[\]/gi, '');

    // 5. ANY() array syntax
    result = result.replace(/=\s*ANY\s*\(\s*\?(::(text|varchar))?\[\]\s*\)/gi, 'IN (?)');

    // 6. ON CONFLICT -> ON DUPLICATE KEY UPDATE
    result = result.replace(/ON\s+CONFLICT\s+\([^)]+\)\s+DO\s+NOTHING/gi, 'ON DUPLICATE KEY UPDATE id = id');
    result = result.replace(/ON\s+CONFLICT\s+\([^)]+\)\s+DO\s+UPDATE\s+SET\s+/gi, 'ON DUPLICATE KEY UPDATE ');
    result = result.replace(/EXCLUDED\.(\w+)/g, 'VALUES($1)');

    // 7. RETURNING - Laisser un commentaire pour traitement manuel
    if (result.match(/RETURNING\s+\*/i)) {
        result = result.replace(/RETURNING\s+\*/gi, '/* RETURNING convertir en SELECT après INSERT/UPDATE/DELETE */');
    }

    // 8. INSERT IGNORE pour ON CONFLICT DO NOTHING simple
    result = result.replace(/INSERT\s+INTO\s+(\w+)\s+\([^)]+\)\s+VALUES\s+\([^)]+\)\s+ON\s+CONFLICT\s+DO\s+NOTHING/gi,
        (match) => match.replace('INSERT INTO', 'INSERT IGNORE INTO').replace(/ON CONFLICT DO NOTHING/i, ''));

    return result;
}

// Convertir tous les fichiers dans routes/
const routesDir = path.join(__dirname, 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

console.log(`🔄 Conversion de ${files.length} fichiers dans routes/...\n`);

let convertedCount = 0;
let filesWithChanges = [];

files.forEach(file => {
    const filePath = path.join(routesDir, file);
    const originalContent = fs.readFileSync(filePath, 'utf8');
    const convertedContent = convertSQLQuery(originalContent);

    if (originalContent !== convertedContent) {
        fs.writeFileSync(filePath, convertedContent, 'utf8');
        convertedCount++;
        filesWithChanges.push(file);
        console.log(`✅ ${file}`);
    } else {
        console.log(`⏭️  ${file} (aucun changement)`);
    }
});

console.log(`\n📊 Résumé :`);
console.log(`   - Fichiers traités : ${files.length}`);
console.log(`   - Fichiers modifiés : ${convertedCount}`);
console.log(`\n📝 Fichiers avec changements :`);
filesWithChanges.forEach(f => console.log(`   - ${f}`));

console.log(`\n⚠️  Note : Les requêtes avec RETURNING ont été commentées.`);
console.log(`   Vous devez les convertir manuellement en utilisant insertId ou SELECT.`);
