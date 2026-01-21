// Script inline pour charger instantanément la sidebar depuis le cache
// Ce script doit être placé juste après <div id="sidebar-container"></div>
(function() {
    const container = document.getElementById('sidebar-container');
    if (!container) return;

    // Version du cache - incrémenter pour invalider l'ancien cache lors de changements structurels
    const CACHE_VERSION = 3; // Migration vers Lucide icons

    try {
        const cached = localStorage.getItem('lspd_cache_sidebar-html');
        if (cached) {
            const data = JSON.parse(cached);
            // Vérifier version + expiration
            if (data && data.value && data.version === CACHE_VERSION && Date.now() <= data.expiry) {
                container.innerHTML = data.value;
                window.__sidebarLoadedFromCache = true;
                window.__profilePreloaded = true;
            } else {
                // Cache invalide ou ancienne version
                localStorage.removeItem('lspd_cache_sidebar-html');
            }
        }
    } catch (e) {
        console.warn('Erreur chargement instant sidebar:', e);
    }
})();
