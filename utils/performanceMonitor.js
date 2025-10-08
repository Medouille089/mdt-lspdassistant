const { cache } = require('./config/cache');

setInterval(() => {
    const stats = cache.getStats();
    console.log('\n📊 === CACHE STATS ===');
    console.log(`🔑 Total keys: ${stats.size}`);
    console.log(`📦 Keys list: ${stats.keys.slice(0, 10).join(', ')}${stats.size > 10 ? '...' : ''}`);

    const prefixStats = {};
    stats.keys.forEach(key => {
        const prefix = key.split(':')[0];
        prefixStats[prefix] = (prefixStats[prefix] || 0) + 1;
    });

    console.log('📈 Par catégorie:');
    Object.entries(prefixStats).forEach(([prefix, count]) => {
        console.log(`   ${prefix}: ${count} entrées`);
    });
    console.log('===================\n');
}, 5 * 60 * 1000);


const responseTimeTracker = new Map();

function trackResponseTime(routeName) {
    return (req, res, next) => {
        const startTime = Date.now();

        res.on('finish', () => {
            const duration = Date.now() - startTime;

            if (!responseTimeTracker.has(routeName)) {
                responseTimeTracker.set(routeName, {
                    total: 0,
                    count: 0,
                    min: Infinity,
                    max: 0
                });
            }

            const stats = responseTimeTracker.get(routeName);
            stats.total += duration;
            stats.count++;
            stats.min = Math.min(stats.min, duration);
            stats.max = Math.max(stats.max, duration);

            if (duration > 500) {
                console.warn(`⚠️ Requête lente: ${routeName} - ${duration}ms`);
            }
        });

        next();
    };
}


setInterval(() => {
    if (responseTimeTracker.size === 0) return;

    console.log('\n⏱️ === RESPONSE TIME STATS ===');
    responseTimeTracker.forEach((stats, routeName) => {
        const avg = Math.round(stats.total / stats.count);
        console.log(`📍 ${routeName}:`);
        console.log(`   Moyenne: ${avg}ms | Min: ${stats.min}ms | Max: ${stats.max}ms | Calls: ${stats.count}`);
    });
    console.log('============================\n');

    responseTimeTracker.clear();
}, 10 * 60 * 1000);

module.exports = {
    trackResponseTime
};
