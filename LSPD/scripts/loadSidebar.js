// scripts/loadSidebar.js
document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('sidebar-container');

    // Fonction pour initialiser les icônes Lucide
    function initLucideIcons() {
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }

    // Fonction pour appliquer les permissions depuis le cache
    function applyPermissionsFromCache() {
        if (!container) return;
        try {
            const permsStr = localStorage.getItem('userPermissions');
            if (!permsStr) return;

            const perms = JSON.parse(permsStr);
            const MAX_AGE = 24 * 60 * 60 * 1000; // 24h
            if (!perms.timestamp || (Date.now() - perms.timestamp) >= MAX_AGE) return;

            const canSeeSupervisor = perms.isSupervisor || perms.isCommandStaff || perms.isSuperAdmin;
            const canSeeAdmin = perms.isCommandStaff || perms.isSuperAdmin;

            container.querySelectorAll('.onlySupervisor').forEach(function(el) {
                el.style.display = canSeeSupervisor ? 'block' : 'none';
            });
            container.querySelectorAll('.onlyCommandStaff').forEach(function(el) {
                el.style.display = canSeeAdmin ? 'block' : 'none';
            });
        } catch (e) {
            console.warn('Erreur application permissions:', e);
        }
    }

    // Fonction pour afficher le mini profil depuis le cache
    function applyMiniProfileFromCache() {
        if (!container) return;
        try {
            const profileStr = localStorage.getItem('userMiniProfile');
            if (!profileStr) return;

            const profile = JSON.parse(profileStr);
            const MAX_AGE = 24 * 60 * 60 * 1000; // 24h
            if (!profile.timestamp || (Date.now() - profile.timestamp) >= MAX_AGE) return;

            const userProfileEl = container.querySelector('#userProfile');
            if (!userProfileEl) return;

            // Taille police dynamique
            let fontSize = '16px';
            if (profile.username.length > 15) fontSize = '13px';
            if (profile.username.length > 20) fontSize = '11px';

            userProfileEl.innerHTML =
                '<span class="profile-inline" style="display:flex;align-items:center;gap:10px;">' +
                '<img class="profile-avatar" src="' + profile.avatarUrl + '" alt="Avatar" data-user-id="' + profile.userId + '" style="width:40px;height:40px;border-radius:50%;border:1px solid #FFFFFF;transition:border-color .18s;flex-shrink:0;object-fit:cover;">' +
                '<span class="profile-texts" style="display:flex;flex-direction:column;line-height:1.15;">' +
                '<span class="profile-username" style="font-weight:700;font-size:' + fontSize + ';transition:color .18s;">' + profile.username + '</span>' +
                '<span class="profile-grade" style="font-weight:500;font-size:0.8rem;transition:color .18s;">' + profile.grade + '</span>' +
                '</span>' +
                '</span>';
        } catch (e) {
            console.warn('Erreur application mini profil:', e);
        }
    }

    if (container) {
        try {
            // Clé de cache pour la sidebar HTML
            const SIDEBAR_HTML_CACHE_KEY = 'lspd_cache_sidebar-html';
            const SIDEBAR_TYPE_CACHE_KEY = 'lspd_cache_sidebar-type';
            const CACHE_TTL = 1800; // 30 minutes
            const CACHE_VERSION = 3; // Incrémenté pour invalider l'ancien cache (migration Lucide)

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
                        if (data && data.value && data.version === CACHE_VERSION && Date.now() <= data.expiry) {
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
                // Initialiser les icônes Lucide après chargement depuis le cache
                initLucideIcons();
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
                    // Appliquer les permissions et profil immédiatement après injection
                    applyPermissionsFromCache();
                    applyMiniProfileFromCache();
                }
                
                // Mettre en cache avec version
                try {
                    localStorage.setItem(SIDEBAR_HTML_CACHE_KEY, JSON.stringify({
                        value: html,
                        expiry: Date.now() + (CACHE_TTL * 1000),
                        created: Date.now(),
                        version: CACHE_VERSION
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
                // Initialiser les icônes Lucide après mise à jour
                initLucideIcons();
            }

        } catch (err) {
            console.error("Erreur chargement sidebar :", err);
            // Fallback sur la sidebar par défaut
            const fallbackResponse = await fetch('/sidebar');
            const fallbackHtml = await fallbackResponse.text();
            container.innerHTML = fallbackHtml;
            // Appliquer les permissions et profil immédiatement après injection
            applyPermissionsFromCache();
            applyMiniProfileFromCache();

            const script = document.createElement('script');
            script.src = 'scripts/sidebar.js';
            document.body.appendChild(script);
            document.body.classList.remove('sidebar-loading');
            document.dispatchEvent(new Event('sidebar:ready'));
            // Initialiser les icônes Lucide après fallback
            initLucideIcons();
        }
    }
});
