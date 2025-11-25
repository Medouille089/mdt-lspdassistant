const fs = require('fs');
const path = require('path');

// Fichiers et leurs corrections RETURNING spécifiques
const fixes = {
    'routes/convocation.js': [
        {
            search: /VALUES \([^\)]+\)\s*RETURNING id/,
            replace: (match, file) => {
                // INSERT avec RETURNING id -> utiliser insertId
                return match.replace('RETURNING id', '').trim();
            },
            postFix: (content) => {
                // Ajouter const convocationId = result.insertId après l'INSERT
                return content.replace(
                    /const result = await pool\.query\(\s*`[^`]*INSERT INTO lspd_convocations[^`]+`[^;]+;/g,
                    (match) => match + '\n        const convocationId = result.insertId;'
                );
            }
        }
    ],
    'routes/vehicules.js': [
        {
            search: /\/\* RETURNING convertir en SELECT après INSERT\/UPDATE\/DELETE \*\//g,
            replace: () => ''
        }
    ],
    'routes/weapons.js': [
        {
            search: /\/\* RETURNING convertir en SELECT après INSERT\/UPDATE\/DELETE \*\//g,
            replace: () => ''
        }
    ],
    'routes/sanctions.js': [
        {
            search: /\/\* RETURNING convertir en SELECT après INSERT\/UPDATE\/DELETE \*\//g,
            replace: () => ''
        }
    ],
    'routes/ticketPanel.js': [
        {
            search: /\/\* RETURNING convertir en SELECT après INSERT\/UPDATE\/DELETE \*\//g,
            replace: () => ''
        }
    ],
    'routes/pointeuse.js': [
        {
            search: /\/\* RETURNING convertir en SELECT après INSERT\/UPDATE\/DELETE \*\//g,
            replace: () => ''
        }
    ],
    'routes/calendar.js': [
        {
            search: /\/\* RETURNING convertir en SELECT après INSERT\/UPDATE\/DELETE \*\//g,
            replace: () => ''
        }
    ],
    'routes/recruitment.js': [
        {
            search: /RETURNING id/g,
            replace: () => ''
        }
    ]
};

console.log('🔧 Correction des RETURNING restants...\n');

Object.entries(fixes).forEach(([filePath, corrections]) => {
    const fullPath = path.join(__dirname, filePath);

    if (!fs.existsSync(fullPath)) {
        console.log(`⏭️  ${filePath} (fichier non trouvé)`);
        return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let modified = false;

    corrections.forEach(fix => {
        const before = content;
        if (typeof fix.replace === 'function') {
            content = content.replace(fix.search, (match) => fix.replace(match, filePath));
        } else {
            content = content.replace(fix.search, fix.replace);
        }

        if (fix.postFix) {
            content = fix.postFix(content);
        }

        if (before !== content) {
            modified = true;
        }
    });

    if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`✅ ${filePath}`);
    } else {
        console.log(`⏭️  ${filePath} (aucune modification)`);
    }
});

// Correction spéciale pour les fichiers avec result.rows[0] qui doivent utiliser insertId
const filesToCheckInsertId = [
    'routes/vehicules.js',
    'routes/weapons.js',
    'routes/sanctions.js',
    'routes/ticketPanel.js',
    'routes/pointeuse.js',
    'routes/calendar.js',
    'routes/recruitment.js'
];

console.log('\n📝 Ajout de gestions insertId et SELECT...\n');

filesToCheckInsertId.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (!fs.existsSync(fullPath)) return;

    let content = fs.readFileSync(fullPath, 'utf8');
    const before = content;

    // Remplacer result.rows[0] par un pattern avec insertId après INSERT
    // Pattern: const x = result.rows[0]; après INSERT -> const selectResult = await pool.query('SELECT...', [result.insertId]);
    // C'est trop complexe, on laisse les développeurs le faire manuellement

    console.log(`ℹ️  ${file} - Vérifiez manuellement les insertId et SELECT`);
});

console.log('\n✅ Correction des RETURNING terminée !');
console.log('⚠️  IMPORTANT : Vérifiez manuellement chaque fichier pour :\n');
console.log('   - Les INSERT qui utilisent result.rows[0] -> utiliser result.insertId');
console.log('   - Les UPDATE/DELETE qui utilisent result.rows[0] -> faire un SELECT avant/après');
