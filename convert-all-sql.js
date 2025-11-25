const fs = require('fs');
const path = require('path');

// Fonction pour convertir une requête SQL PostgreSQL vers MySQL
function convertSQLQuery(content) {
    let result = content;
    
    // 1. Convertir les paramètres $1, $2, etc. vers ?
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
    
    // 7. RETURNING - marquer pour traitement manuel
    result = result.replace(/RETURNING\s+\*/gi, '/* MYSQL_TODO: RETURNING * -> use insertId or SELECT */');
    result = result.replace(/RETURNING\s+(\w+)/gi, '/* MYSQL_TODO: RETURNING $1 -> use insertId or SELECT */');
    
    return result;
}

// Dossiers à parcourir
const directories = [
    'routes',
    'utils',
    'config',
    'commands',
    'LSPD/trello/routes',
    'LSPD/trello/utils'
];

console.log('🔄 Conversion globale PostgreSQL → MySQL\n');

let totalFiles = 0;
let totalConverted = 0;
const allChangedFiles = [];

directories.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    
    if (!fs.existsSync(dirPath)) {
        console.log(`⏭️  ${dir}/ (dossier non trouvé)`);
        return;
    }
    
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'));
    
    console.log(`📁 ${dir}/ (${files.length} fichiers)`);
    
    files.forEach(file => {
        totalFiles++;
        const filePath = path.join(dirPath, file);
        const originalContent = fs.readFileSync(filePath, 'utf8');
        const convertedContent = convertSQLQuery(originalContent);
        
        if (originalContent !== convertedContent) {
            fs.writeFileSync(filePath, convertedContent, 'utf8');
            totalConverted++;
            allChangedFiles.push(`${dir}/${file}`);
            console.log(`   ✅ ${file}`);
        } else {
            console.log(`   ⏭️  ${file}`);
        }
    });
    
    console.log('');
});

console.log('═'.repeat(60));
console.log(`📊 RÉSUMÉ GLOBAL`);
console.log('═'.repeat(60));
console.log(`Total fichiers traités : ${totalFiles}`);
console.log(`Fichiers modifiés : ${totalConverted}`);
console.log(`\n📝 Liste complète des fichiers modifiés :`);
allChangedFiles.forEach(f => console.log(`   - ${f}`));

console.log(`\n⚠️  ACTIONS MANUELLES REQUISES :`);
console.log(`   1. Cherchez "MYSQL_TODO" dans le code`);
console.log(`   2. Remplacez result.rows[0] après INSERT par :`);
console.log(`      const selectResult = await pool.query('SELECT * FROM table WHERE id = ?', [result.insertId]);`);
console.log(`   3. Pour UPDATE/DELETE avec RETURNING, faites un SELECT avant/après`);
console.log(`   4. Vérifiez config/sessionStore.js pour la session MySQL`);
console.log(`\n✅ Conversion terminée !`);
