// Script inline pour charger instantanément la sidebar depuis le cache
// Ce script doit être placé juste après <div id="sidebar-container"></div>
// Le profil est maintenant inclus directement dans le HTML caché, donc plus besoin de le charger séparément
(function() {
    const container = document.getElementById('sidebar-container');
    if (!container) return;
    
    try {
        const cached = localStorage.getItem('lspd_cache_sidebar-html');
        if (cached) {
            const data = JSON.parse(cached);
            if (data && data.value && Date.now() <= data.expiry) {
                // Charger immédiatement depuis le cache - ZERO latence !
                // Le HTML contient déjà le profil utilisateur (injecté par loadSidebar.js)
                container.innerHTML = data.value;
                
                // Marquer que tout est chargé depuis le cache
                window.__sidebarLoadedFromCache = true;
                window.__profilePreloaded = true;
            }
        }
    } catch (e) {
        console.warn('Erreur chargement instant sidebar:', e);
    }
})();
