// scripts/loadSidebar.js
document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('sidebar-container');

    if (container) {
        try {
            // Clé de cache pour la sidebar HTML
            const SIDEBAR_HTML_CACHE_KEY = 'lspd_cache_sidebar-html';
            const SIDEBAR_TYPE_CACHE_KEY = 'lspd_cache_sidebar-type';
            const CACHE_TTL = 1800; // 30 minutes
            
            // Fonction pour charger depuis le cache
            function loadFromCache() {
                // Si déjà chargé par instant-sidebar.js, ne rien faire
                if (window.__sidebarLoadedFromCache) {
                    return true;
                }
                
                try {
                    const cached = localStorage.getItem(SIDEBAR_HTML_CACHE_KEY);
                    if (cached) {
                        const data = JSON.parse(cached);
                        if (data && data.value && Date.now() <= data.expiry) {
                            container.innerHTML = data.value;
                            return true;
                        }
                    }
                } catch (e) {
                    console.warn('Erreur lecture cache sidebar:', e);
                }
                return false;
            }
            
            // Charger immédiatement depuis le cache si disponible
            const loadedFromCache = loadFromCache();
            
            // Charger le script sidebar.js immédiatement (même avec le cache)
            if (loadedFromCache) {
                const script = document.createElement('script');
                script.src = 'scripts/sidebar.js';
                document.body.appendChild(script);
                document.body.classList.remove('sidebar-loading');
                document.dispatchEvent(new Event('sidebar:ready'));
            }
            
            // En arrière-plan, vérifier si on doit mettre à jour
            // Récupérer les infos utilisateur pour déterminer le type de sidebar
            const userResponse = await fetch('/api/user');
            const userInfo = await userResponse.json();

            // Choisir la sidebar appropriée
            const sidebarFile = userInfo.isDOJ && !userInfo.isLSPD ? '/sidebar-doj' : '/sidebar';
            
            // Vérifier si le type de sidebar a changé
            const cachedType = localStorage.getItem(SIDEBAR_TYPE_CACHE_KEY);
            const needsUpdate = !loadedFromCache || cachedType !== sidebarFile;
            
            if (needsUpdate) {
                const sidebarResponse = await fetch(sidebarFile);
                const html = await sidebarResponse.text();

                // Mettre à jour seulement si différent
                if (container.innerHTML !== html) {
                    container.innerHTML = html;
                }
                
                // Mettre en cache
                try {
                    localStorage.setItem(SIDEBAR_HTML_CACHE_KEY, JSON.stringify({
                        value: html,
                        expiry: Date.now() + (CACHE_TTL * 1000),
                        created: Date.now()
                    }));
                    localStorage.setItem(SIDEBAR_TYPE_CACHE_KEY, sidebarFile);
                } catch (e) {
                    console.warn('Impossible de cacher la sidebar:', e);
                }

                // Charger les fonctionnalités JS du sidebar si pas déjà fait
                if (!loadedFromCache) {
                    const script = document.createElement('script');
                    script.src = 'scripts/sidebar.js';
                    document.body.appendChild(script);
                    document.body.classList.remove('sidebar-loading');
                    document.dispatchEvent(new Event('sidebar:ready'));
                }
            }

        } catch (err) {
            console.error("Erreur chargement sidebar :", err);
            // Fallback sur la sidebar par défaut
            const fallbackResponse = await fetch('/sidebar');
            const fallbackHtml = await fallbackResponse.text();
            container.innerHTML = fallbackHtml;

            const script = document.createElement('script');
            script.src = 'scripts/sidebar.js';
            document.body.appendChild(script);
            document.body.classList.remove('sidebar-loading');
            document.dispatchEvent(new Event('sidebar:ready'));
        }
    }
});
