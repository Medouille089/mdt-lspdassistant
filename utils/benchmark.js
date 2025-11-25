/**
 * Module de benchmark pour mesurer les performances du code
 * 
 * Utilisation :
 * const { benchmark, getBenchmarks, clearBenchmarks } = require('./utils/benchmark');
 * 
 * benchmark('mon_operation', 1); // Démarrer
 * // ... code à mesurer ...
 * benchmark('mon_operation', 2); // Terminer
 * 
 * console.log(getBenchmarks()); // Afficher les résultats
 */

// Stockage des timestamps
const benchmarks = new Map();

// Stockage des résultats finaux
const results = new Map();

/**
 * Marque un point de benchmark
 * @param {string} id - Identifiant unique du benchmark
 * @param {number} step - 1 pour démarrer, 2 pour terminer
 * @param {object} options - Options supplémentaires (label, metadata)
 */
function benchmark(id, step, options = {}) {
  const timestamp = process.hrtime.bigint();
  
  if (step === 1) {
    // Démarrage du benchmark
    benchmarks.set(id, {
      start: timestamp,
      label: options.label || id,
      metadata: options.metadata || {}
    });
  } else if (step === 2) {
    // Fin du benchmark
    const data = benchmarks.get(id);
    
    if (!data) {
      console.warn(`⚠️ Benchmark "${id}" non démarré (step 1 manquant)`);
      return null;
    }
    
    const duration = Number(timestamp - data.start) / 1_000_000; // Convertir en millisecondes
    
    const result = {
      id,
      label: data.label,
      duration: duration.toFixed(3),
      durationMs: duration,
      timestamp: new Date().toISOString(),
      metadata: data.metadata
    };
    
    // Afficher le résultat
    console.log(`⏱️ [${result.label}] ${result.duration}ms`);
    
    // Stocker le résultat
    if (!results.has(id)) {
      results.set(id, []);
    }
    results.get(id).push(result);
    
    // Nettoyer le benchmark en cours
    benchmarks.delete(id);
    
    return result;
  }
}

/**
 * Wrapper pour mesurer une fonction
 * @param {string} id - Identifiant du benchmark
 * @param {Function} fn - Fonction à mesurer
 * @param {object} options - Options (label, metadata)
 * @returns {Promise|any} Résultat de la fonction
 */
async function measureFunction(id, fn, options = {}) {
  benchmark(id, 1, options);
  try {
    const result = await fn();
    const benchResult = benchmark(id, 2);
    if (benchResult && options.log) {
      console.log(`⏱️ ${benchResult.label}: ${benchResult.duration}ms`);
    }
    return result;
  } catch (error) {
    benchmark(id, 2);
    throw error;
  }
}

/**
 * Middleware Express pour mesurer les requêtes
 * @param {object} options - Options du middleware
 * @returns {Function} Middleware Express
 */
function benchmarkMiddleware(options = {}) {
  const threshold = options.threshold || 1000; // Seuil en ms pour logger
  const logAll = options.logAll || false;
  
  return (req, res, next) => {
    const id = `${req.method}_${req.path}_${Date.now()}`;
    const start = process.hrtime.bigint();
    
    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1_000_000;
      
      if (logAll || duration > threshold) {
        const method = req.method.padEnd(6);
        const status = res.statusCode;
        const statusColor = status < 400 ? '\x1b[32m' : '\x1b[31m';
        console.log(
          `⏱️ ${method} ${req.path} ${statusColor}${status}\x1b[0m - ${duration.toFixed(2)}ms`
        );
      }
      
      // Stocker dans les résultats
      const routeId = `${req.method}_${req.path}`;
      if (!results.has(routeId)) {
        results.set(routeId, []);
      }
      results.get(routeId).push({
        id: routeId,
        label: `${req.method} ${req.path}`,
        duration: duration.toFixed(3),
        durationMs: duration,
        statusCode: status,
        timestamp: new Date().toISOString()
      });
    });
    
    next();
  };
}

/**
 * Récupère tous les résultats de benchmarks
 * @param {string} id - Optionnel: filtrer par ID
 * @returns {object} Résultats
 */
function getBenchmarks(id = null) {
  if (id) {
    return results.get(id) || [];
  }
  
  const allResults = {};
  for (const [key, value] of results.entries()) {
    allResults[key] = value;
  }
  return allResults;
}

/**
 * Récupère les statistiques pour un benchmark donné
 * @param {string} id - ID du benchmark
 * @returns {object} Statistiques (min, max, avg, count)
 */
function getStats(id) {
  const data = results.get(id);
  if (!data || data.length === 0) {
    return null;
  }
  
  const durations = data.map(d => d.durationMs);
  const sum = durations.reduce((a, b) => a + b, 0);
  
  return {
    count: data.length,
    min: Math.min(...durations).toFixed(3),
    max: Math.max(...durations).toFixed(3),
    avg: (sum / data.length).toFixed(3),
    total: sum.toFixed(3),
    last: data[data.length - 1].duration
  };
}

/**
 * Affiche un rapport complet des benchmarks
 */
function printReport() {
  console.log('\n📊 ===== RAPPORT DE PERFORMANCE =====\n');
  
  for (const [id, data] of results.entries()) {
    if (data.length === 0) continue;
    
    const stats = getStats(id);
    console.log(`🔹 ${id}`);
    console.log(`   Exécutions: ${stats.count}`);
    console.log(`   Min: ${stats.min}ms | Max: ${stats.max}ms | Avg: ${stats.avg}ms`);
    console.log('');
  }
  
  console.log('=====================================\n');
}

/**
 * Efface tous les benchmarks
 * @param {string} id - Optionnel: effacer seulement un ID spécifique
 */
function clearBenchmarks(id = null) {
  if (id) {
    results.delete(id);
    benchmarks.delete(id);
  } else {
    results.clear();
    benchmarks.clear();
  }
}

/**
 * Décorateur pour mesurer automatiquement une fonction
 * @param {string} label - Label du benchmark
 * @returns {Function} Décorateur
 */
function timed(label) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    const id = label || `${target.constructor.name}.${propertyKey}`;
    
    descriptor.value = async function(...args) {
      benchmark(id, 1, { label: id });
      try {
        const result = await originalMethod.apply(this, args);
        const benchResult = benchmark(id, 2);
        console.log(`⏱️ ${benchResult.label}: ${benchResult.duration}ms`);
        return result;
      } catch (error) {
        benchmark(id, 2);
        throw error;
      }
    };
    
    return descriptor;
  };
}

module.exports = {
  benchmark,
  measureFunction,
  benchmarkMiddleware,
  getBenchmarks,
  getStats,
  printReport,
  clearBenchmarks,
  timed
};
