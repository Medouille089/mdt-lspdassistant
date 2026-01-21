// Script inline pour charger instantanément la sidebar depuis le cache
// Ce script doit être placé juste après <div id="sidebar-container"></div>
(function() {
    const container = document.getElementById('sidebar-container');
    if (!container) return;

    // Version du cache - incrémenter pour invalider l'ancien cache lors de changements structurels
    const CACHE_VERSION = 3; // Migration vers Lucide icons

    // Fonction pour appliquer les permissions depuis le cache
    function applyPermissionsFromCache() {
        try {
            const permsStr = localStorage.getItem('userPermissions');
            if (!permsStr) return;

            const perms = JSON.parse(permsStr);
            const MAX_AGE = 24 * 60 * 60 * 1000; // 24h
            if (!perms.timestamp || (Date.now() - perms.timestamp) >= MAX_AGE) return;

            const canSeeSupervisor = perms.isSupervisor || perms.isCommandStaff || perms.isSuperAdmin;
            const canSeeAdmin = perms.isCommandStaff || perms.isSuperAdmin;

            // Appliquer immédiatement sur les éléments
            container.querySelectorAll('.onlySupervisor').forEach(function(el) {
                el.style.display = canSeeSupervisor ? 'block' : 'none';
            });
            container.querySelectorAll('.onlyCommandStaff').forEach(function(el) {
                el.style.display = canSeeAdmin ? 'block' : 'none';
            });

            window.__permissionsPreloaded = true;
        } catch (e) {
            console.warn('Erreur application permissions:', e);
        }
    }

    // Fonction pour afficher le mini profil depuis le cache
    function applyMiniProfileFromCache() {
        try {
            const profileStr = localStorage.getItem('userMiniProfile');
            if (!profileStr) return;

            const profile = JSON.parse(profileStr);
            const MAX_AGE = 24 * 60 * 60 * 1000; // 24h
            if (!profile.timestamp || (Date.now() - profile.timestamp) >= MAX_AGE) return;

            const userProfileEl = container.querySelector('#userProfile');
            if (!userProfileEl) return;

            // Taille police dynamique
            var fontSize = '16px';
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

            window.__profilePreloaded = true;
        } catch (e) {
            console.warn('Erreur application mini profil:', e);
        }
    }

    try {
        const cached = localStorage.getItem('lspd_cache_sidebar-html');
        if (cached) {
            const data = JSON.parse(cached);
            // Vérifier version + expiration
            if (data && data.value && data.version === CACHE_VERSION && Date.now() <= data.expiry) {
                var html = data.value;
                // Si on est dans /trello/, corriger les chemins d'images
                if (window.location.pathname.startsWith('/trello')) {
                    html = html.replace(/src="data\/images\//g, 'src="/data/images/');
                }
                container.innerHTML = html;
                window.__sidebarLoadedFromCache = true;

                // Appliquer les permissions et le profil IMMÉDIATEMENT après injection
                applyPermissionsFromCache();
                applyMiniProfileFromCache();

                // Initialiser les icônes Lucide immédiatement après injection du cache
                if (typeof lucide !== 'undefined' && lucide.createIcons) {
                    lucide.createIcons();
                }
            } else {
                // Cache invalide ou ancienne version
                localStorage.removeItem('lspd_cache_sidebar-html');
            }
        }
    } catch (e) {
        console.warn('Erreur chargement instant sidebar:', e);
    }
})();
