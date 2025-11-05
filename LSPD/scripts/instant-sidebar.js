// Script inline pour charger instantanément la sidebar depuis le cache
// Ce script doit être placé juste après <div id="sidebar-container"></div>
(function() {
    const container = document.getElementById('sidebar-container');
    if (!container) return;
    
    try {
        const cached = localStorage.getItem('lspd_cache_sidebar-html');
        if (cached) {
            const data = JSON.parse(cached);
            if (data && data.value && Date.now() <= data.expiry) {
                // Charger immédiatement depuis le cache - ZERO latence !
                container.innerHTML = data.value;
                
                // Marquer que la sidebar est déjà chargée depuis le cache
                window.__sidebarLoadedFromCache = true;
                
                // Charger immédiatement les permissions et le profil depuis le cache
                // Utiliser un micro-délai pour que le DOM soit prêt après l'injection
                setTimeout(loadUserDataFromCache, 0);
            }
        }
    } catch (e) {
        console.warn('Erreur chargement instant sidebar:', e);
    }
    
    function loadUserDataFromCache() {
        // 1. Charger les permissions pour afficher les boutons Superviseur/Admin
        try {
            const permsCache = localStorage.getItem('lspd_cache_user-permissions');
            if (permsCache) {
                const permsData = JSON.parse(permsCache);
                if (permsData && permsData.value && Date.now() <= permsData.expiry) {
                    const perms = permsData.value;
                    
                    // Afficher les boutons selon les permissions
                    if (perms.isSupervisor || perms.isCommandStaff || perms.isSuperAdmin) {
                        document.querySelectorAll('.onlySupervisor').forEach(function(el) {
                            el.style.display = 'block';
                        });
                    }
                    if (perms.isCommandStaff || perms.isSuperAdmin) {
                        document.querySelectorAll('.onlyCommandStaff').forEach(function(el) {
                            el.style.display = 'block';
                        });
                    }
                }
            }
        } catch (e) {
            console.warn('Erreur permissions cache:', e);
        }
        
        // 2. Charger le profil utilisateur (avatar, nom, grade)
        try {
            const userCache = localStorage.getItem('lspd_cache_user');
            if (userCache) {
                const userData = JSON.parse(userCache);
                if (userData && userData.value && Date.now() <= userData.expiry) {
                    const user = userData.value;
                    
                    // Chercher l'avatar dans le cache du profil agent
                    let avatarUrl;
                    const profileCache = localStorage.getItem('lspd_cache_agent-profile-' + user.id);
                    if (profileCache) {
                        try {
                            const profileData = JSON.parse(profileCache);
                            if (profileData && profileData.value && Date.now() <= profileData.expiry) {
                                const profile = profileData.value;
                                if (profile.photo_url && String(profile.photo_url).trim() !== '') {
                                    avatarUrl = profile.photo_url.trim();
                                }
                            }
                        } catch (e) {}
                    }
                    
                    // Fallback sur l'avatar Discord
                    if (!avatarUrl) {
                        avatarUrl = user.avatar
                            ? 'https://cdn.discordapp.com/avatars/' + user.id + '/' + user.avatar + '.png?size=64'
                            : 'https://cdn.discordapp.com/embed/avatars/' + (parseInt(user.discriminator) % 5) + '.png';
                    }
                    
                    // Calculer la taille de police
                    var fontSize = '16px';
                    var length = user.username.length;
                    if (length > 15) fontSize = '13px';
                    if (length > 20) fontSize = '11px';
                    
                    // Afficher le profil immédiatement
                    const profileContainer = document.getElementById('userProfile');
                    if (profileContainer) {
                        profileContainer.innerHTML = '<span class="profile-inline" style="display:flex;align-items:center;gap:10px;">' +
                            '<img class="profile-avatar" src="' + avatarUrl + '" alt="Avatar" data-user-id="' + user.id + '" style="width:40px;height:40px;border-radius:50%;border:1px solid #FFFFFF;transition:border-color .18s;flex-shrink:0;object-fit:cover;">' +
                            '<span class="profile-texts" style="display:flex;flex-direction:column;line-height:1.15;">' +
                            '<span class="profile-username" style="font-weight:700;font-size:' + fontSize + ';color:#FFFFFF;transition:color .18s;">' + user.username + '</span>' +
                            '<span class="profile-grade" style="font-weight:500;font-size:0.8rem;color:#CCCCCC;transition:color .18s;">' + user.grade + '</span>' +
                            '</span></span>';
                        
                        // Marquer que le profil est pré-chargé
                        window.__profileLoadedFromCache = true;
                    }
                }
            }
        } catch (e) {
            console.warn('Erreur profil cache:', e);
        }
    }
})();
