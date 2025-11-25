/**
 * Script helper pour la migration PostgreSQL -> MySQL
 * Ce script contient des fonctions utilitaires pour convertir les requêtes
 */

// Convertir les paramètres $1, $2, etc. en ?
function convertParams(sql) {
    let result = sql;
    const matches = sql.match(/\$\d+/g);
    if (!matches) return sql;

    // Trier par ordre décroissant pour remplacer $10 avant $1
    const sortedMatches = [...new Set(matches)].sort((a, b) => {
        const numA = parseInt(a.slice(1));
        const numB = parseInt(b.slice(1));
        return numB - numA;
    });

    for (const match of sortedMatches) {
        result = result.replace(new RegExp('\\' + match + '\\b', 'g'), '?');
    }

    return result;
}

// Convertir INTERVAL PostgreSQL vers MySQL
function convertInterval(sql) {
    // INTERVAL '30 days' -> INTERVAL 30 DAY
    let result = sql.replace(/INTERVAL\s+'(\d+)\s+days?'/gi, 'INTERVAL $1 DAY');
    result = result.replace(/INTERVAL\s+'(\d+)\s+hours?'/gi, 'INTERVAL $1 HOUR');
    result = result.replace(/INTERVAL\s+'(\d+)\s+minutes?'/gi, 'INTERVAL $1 MINUTE');
    result = result.replace(/INTERVAL\s+'(\d+)\s+months?'/gi, 'INTERVAL $1 MONTH');
    result = result.replace(/INTERVAL\s+'(\d+)\s+years?'/gi, 'INTERVAL $1 YEAR');

    // NOW() - INTERVAL -> NOW() - INTERVAL (OK)
    // CURRENT_DATE -> CURDATE()
    result = result.replace(/CURRENT_DATE/gi, 'CURDATE()');
    result = result.replace(/CURRENT_TIMESTAMP/gi, 'NOW()');

    return result;
}

// Convertir ::date, ::jsonb, etc.
function convertCasts(sql) {
    let result = sql;
    // ::date -> (utiliser DATE() ou CAST)
    result = result.replace(/(\w+)::date/gi, 'DATE($1)');
    result = result.replace(/(\w+)::jsonb/gi, '$1');
    result = result.replace(/(\w+)::varchar\[\]/gi, '$1');
    result = result.replace(/(\w+)::text\[\]/gi, '$1');
    result = result.replace(/::jsonb/gi, '');

    return result;
}

// Convertir ANY($1::text[]) en IN (?)
function convertAny(sql) {
    let result = sql;
    // ANY($1::text[]) -> IN (?)
    result = result.replace(/= ANY\(\$\d+::(text|varchar)\[\]\)/gi, 'IN (?)');
    result = result.replace(/IN\s+\(SELECT unnest\(\$\d+::\w+\[\]\)\)/gi, 'IN (?)');

    return result;
}

// Convertir ON CONFLICT
function convertOnConflict(sql) {
    let result = sql;

    // ON CONFLICT (col) DO UPDATE SET ... -> ON DUPLICATE KEY UPDATE ...
    result = result.replace(
        /ON CONFLICT\s*\([^)]+\)\s+DO UPDATE SET\s+([^W]+)\s*=\s*EXCLUDED\.([^,\s]+)/gi,
        'ON DUPLICATE KEY UPDATE $1 = VALUES($2)'
    );

    // ON CONFLICT (col) DO NOTHING -> ON DUPLICATE KEY UPDATE id = id
    result = result.replace(
        /ON CONFLICT\s*\([^)]+\)\s+DO NOTHING/gi,
        'ON DUPLICATE KEY UPDATE id = id'
    );

    // ON CONFLICT DO UPDATE with EXCLUDED -> VALUES()
    result = result.replace(/EXCLUDED\.(\w+)/g, 'VALUES($1)');

    return result;
}

// Wrapper complet
function postgresqlToMysql(sql) {
    let result = sql;
    result = convertInterval(result);
    result = convertCasts(result);
    result = convertAny(result);
    result = convertParams(result);
    result = convertOnConflict(result);

    return result;
}

module.exports = {
    convertParams,
    convertInterval,
    convertCasts,
    convertAny,
    convertOnConflict,
    postgresqlToMysql
};
