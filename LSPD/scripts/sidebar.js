// Toggle the visibility of a dropdown menu
const toggleDropdown = (dropdown, menu, isOpen) => {
  dropdown.classList.toggle("open", isOpen);
  menu.style.height = isOpen ? `${menu.scrollHeight}px` : 0;
};

// Close all open dropdowns except the one containing the active page
const closeAllDropdowns = (exceptDropdown = null) => {
  document.querySelectorAll(".dropdown-container.open").forEach((openDropdown) => {
    // Ne pas fermer le dropdown contenant la page active
    if (exceptDropdown && openDropdown === exceptDropdown) {
      return;
    }
    toggleDropdown(openDropdown, openDropdown.querySelector(".dropdown-menu"), false);
  });
};

// Attach click event to all dropdown toggles
document.querySelectorAll(".dropdown-toggle").forEach((dropdownToggle) => {
  dropdownToggle.addEventListener("click", (e) => {
    e.preventDefault();

    const dropdown = dropdownToggle.closest(".dropdown-container");
    const menu = dropdown.querySelector(".dropdown-menu");
    const isOpen = dropdown.classList.contains("open");
    
    // Vérifier si ce dropdown contient un lien actif
    const hasActiveLink = dropdown.querySelector('.nav-link.active');

    // Si on ferme un dropdown qui contient la page active, fermer les autres mais pas celui-ci
    if (isOpen && hasActiveLink) {
      // Ne rien faire, garder le dropdown ouvert
      return;
    }
    
    // Fermer tous les dropdowns sauf celui qui contient la page active
    const activeDropdown = document.querySelector('.dropdown-container:has(.nav-link.active)');
    closeAllDropdowns(activeDropdown);
    
    // Toggle le dropdown cliqué
    toggleDropdown(dropdown, menu, !isOpen);
  });
});

document.querySelectorAll(".sidebar-toggler, .sidebar-menu-button").forEach((button) => {
  button.addEventListener("click", () => {
    closeAllDropdowns();

    const sidebar = document.querySelector(".sidebar");
    const body = document.body;

    sidebar.classList.toggle("collapsed");
    body.classList.toggle("collapsed");
  });
});

// Local storage key for persisted sidebar state
const SIDEBAR_KEY = 'sidebarCollapsed';

// Apply sidebar state from localStorage (if present) or use responsive default
function applySidebarStateFromStorage() {
  const sidebar = document.querySelector('.sidebar');
  const body = document.body;
  if (!sidebar) return;
  const stored = localStorage.getItem(SIDEBAR_KEY);
  if (stored !== null) {
    const collapsed = stored === 'true';
    // If an early inline script already applied the body class, don't toggle it again.
    if (!window.__sidebarStateApplied) {
      sidebar.classList.toggle('collapsed', collapsed);
      body.classList.toggle('collapsed', collapsed);
    } else {
      // Ensure sidebar element and body agree
      sidebar.classList.toggle('collapsed', body.classList.contains('collapsed'));
    }
    // update toggler icon direction if present
    updateTogglerIcon(collapsed);
  } else {
    // No stored preference: collapse by default on small screens
    const shouldCollapse = window.innerWidth <= 1024;
    // If early script applied something, respect it
    if (!window.__sidebarStateApplied) {
      sidebar.classList.toggle('collapsed', shouldCollapse);
      body.classList.toggle('collapsed', shouldCollapse);
    } else {
      sidebar.classList.toggle('collapsed', body.classList.contains('collapsed'));
    }
    updateTogglerIcon(body.classList.contains('collapsed'));
  }
}

function updateTogglerIcon(collapsed) {
  const toggler = document.querySelector('.sidebar-toggler');
  if (!toggler) return;
  const icon = toggler.querySelector('[data-lucide]');
  if (!icon) return;
  // When collapsed, show chevron_right (indicating expand), else chevron_left
  icon.setAttribute('data-lucide', collapsed ? 'chevron-right' : 'chevron-left');
  // Re-render Lucide icons after changing the attribute
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

// Initialize sidebar state on DOMContentLoaded to ensure elements exist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applySidebarStateFromStorage);
} else {
  applySidebarStateFromStorage();
}

// Enhance toggle buttons to persist state
document.querySelectorAll('.sidebar-toggler, .sidebar-menu-button').forEach((button) => {
  // click handler already defined above; attach a small listener to persist after toggle
  button.addEventListener('click', () => {
    const sidebar = document.querySelector('.sidebar');
    const collapsed = sidebar ? sidebar.classList.contains('collapsed') : false;
    try {
      localStorage.setItem(SIDEBAR_KEY, String(collapsed));
    } catch (e) {
      // ignore storage errors (e.g., privacy mode)
      console.warn('Unable to persist sidebar state:', e);
    }
    updateTogglerIcon(collapsed);
  });

  // allow keyboard activation (space/enter)
  button.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      button.click();
    }
  });
});

// Fonction pour sauvegarder les permissions dans le cache
function savePermissionsToCache(user) {
  try {
    const perms = {
      isSupervisor: user.isSupervisor || false,
      isCommandStaff: user.isCommandStaff || false,
      isSuperAdmin: user.isSuperAdmin || false,
      timestamp: Date.now()
    };
    localStorage.setItem('userPermissions', JSON.stringify(perms));
  } catch (e) {
    console.warn('Unable to cache permissions:', e);
  }
}

// Fonction pour sauvegarder le profil mini dans le cache
function saveMiniProfileToCache(userId, username, grade, avatarUrl) {
  try {
    const profile = {
      userId: userId,
      username: username,
      grade: grade,
      avatarUrl: avatarUrl,
      timestamp: Date.now()
    };
    localStorage.setItem('userMiniProfile', JSON.stringify(profile));
  } catch (e) {
    console.warn('Unable to cache mini profile:', e);
  }
}

// Fonction pour appliquer les permissions (avec mise à jour du cache si différent)
function applyPermissions(user) {
  const canSeeSupervisor = user.isSupervisor || user.isCommandStaff || user.isSuperAdmin;
  const canSeeAdmin = user.isCommandStaff || user.isSuperAdmin;

  // Mettre à jour le style global (utilisé par le cache inline dans le head)
  const defaultStyle = document.getElementById('default-permissions');
  if (defaultStyle) {
    let css = '';
    css += '.onlySupervisor { display: ' + (canSeeSupervisor ? 'block' : 'none') + '; }';
    css += '.onlyCommandStaff { display: ' + (canSeeAdmin ? 'block' : 'none') + '; }';
    defaultStyle.textContent = css;
  } else {
    // Fallback: appliquer directement sur les éléments
    document.querySelectorAll('.onlySupervisor').forEach(el => {
      el.style.display = canSeeSupervisor ? 'block' : 'none';
    });
    document.querySelectorAll('.onlyCommandStaff').forEach(el => {
      el.style.display = canSeeAdmin ? 'block' : 'none';
    });
  }

  // Sauvegarder dans le cache pour le prochain chargement
  savePermissionsToCache(user);
}

async function fetchUser() {
  try {
    // Vérifier si le profil est réellement affiché (pas juste le flag)
    const container = document.getElementById('userProfile');
    const profileAlreadyDisplayed = container && container.querySelector('.profile-avatar');

    // Si le profil est déjà pré-chargé ET réellement affiché, on initialise juste les listeners
    // mais on doit quand même charger les permissions depuis l'API
    if (window.__profilePreloaded && profileAlreadyDisplayed) {
      initProfileListeners();
      // Continuer pour charger les permissions (ne pas return)
    }

    let user;
    
    // TTL augmenté à 30 minutes pour garder les données en cache pendant toute la session
    const USER_CACHE_TTL = 1800; // 30 minutes au lieu de 5

    if (window.clientCache && typeof window.clientCache.getOrFetch === 'function') {
      user = await window.clientCache.getOrFetch('user', async () => {
        const res = await fetch('/api/user');
        if (!res.ok) throw new Error('Non connecté');
        return await res.json();
      }, USER_CACHE_TTL);
    } else {
      const res = await fetch('/api/user');
      if (!res.ok) throw new Error('Non connecté');
      user = await res.json();
    }

    // Avatar: priorité à la photo personnalisée du profil agent (photo_url), sinon avatar Discord
    let avatarUrl;
    
    // Vérifier le cache pour la photo d'abord
    const cachedProfile = window.clientCache ? window.clientCache.get(`agent-profile-${user.id}`) : null;
    
    if (cachedProfile && cachedProfile.photo_url && String(cachedProfile.photo_url).trim() !== '') {
      avatarUrl = cachedProfile.photo_url.trim();
    } else {
      // Si pas en cache, fetch et mettre en cache
      try {
        const profRes = await fetch(`/api/agent-profile/${user.id}`);
        if (profRes.ok) {
          const profile = await profRes.json();
          
          // Mettre le profil en cache pour 30 minutes
          if (window.clientCache) {
            window.clientCache.set(`agent-profile-${user.id}`, profile, USER_CACHE_TTL);
          }
          
          if (profile && profile.photo_url && String(profile.photo_url).trim() !== '') {
            avatarUrl = profile.photo_url.trim();
          }
        }
      } catch (e) {
        console.warn('Impossible de récupérer le profil agent pour la sidebar:', e);
      }
    }
    
    if (!avatarUrl) {
      avatarUrl = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator) % 5}.png`;
    }

    // Taille police dynamique
    let fontSize = '16px';
    const length = user.username.length;
    if (length > 15) fontSize = '13px';
    if (length > 20) fontSize = '11px';

    // Affichage profil
    // container est déjà défini en haut de la fonction (ligne 135)
    
    // Vérifier si le profil est déjà affiché par instant-sidebar.js
    const existingAvatar = container.querySelector('.profile-avatar');
    const isAlreadyDisplayed = existingAvatar && existingAvatar.getAttribute('data-user-id') === String(user.id);
    
    // Ne mettre à jour que si pas déjà affiché ou si différent
    if (!isAlreadyDisplayed) {
      // Le conteneur parent est déjà dans <a class="nav-link"><span id="userProfile"></span></a>
      // On insère seulement le contenu, le hover se fera sur l'ancre .nav-link (zone complète)
      container.innerHTML = `
        <span class="profile-inline" style="display:flex;align-items:center;gap:10px;">
    <img class=\"profile-avatar\" src=\"${avatarUrl}\" alt=\"Avatar\" data-user-id=\"${user.id}\" style=\"width:40px;height:40px;border-radius:50%;border:1px solid #FFFFFF;transition:border-color .18s;flex-shrink:0;object-fit:cover;\">
          <span class=\"profile-texts\" style=\"display:flex;flex-direction:column;line-height:1.15;\">
            <span class=\"profile-username\" style=\"font-weight:700;font-size:${fontSize};transition:color .18s;\">${user.username}</span>
            <span class=\"profile-grade\" style=\"font-weight:500;font-size:0.8rem;transition:color .18s;\">${user.grade}</span>
          </span>
        </span>`;
    }

    // Sauvegarder le mini profil dans le cache pour affichage instantané
    saveMiniProfileToCache(user.id, user.username, user.grade, avatarUrl);

    // Configurer le lien du profil
    const profileLink = document.getElementById('profileLink') || container.closest('a.nav-link');
    if (profileLink && !profileLink.hasAttribute('data-profile-initialized')) {
      profileLink.id = 'profileLink';
      profileLink.setAttribute('data-profile-initialized', 'true');
      profileLink.style.cursor = 'pointer';
      profileLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = `/infos-agent?userId=${user.id}`;
      });
    }

    // Appliquer les permissions depuis l'API et mettre à jour le cache
    applyPermissions(user);

  } catch (error) {
    console.error('An error occurred while processing the user profile:', error);

    const container = document.getElementById('userProfile');
    if (container) container.style.display = 'none';

    // Invalider le cache et cacher les boutons admin
    try {
      localStorage.removeItem('userPermissions');
    } catch (e) {
      // ignore storage errors
    }

    // Mettre à jour le style global pour cacher les boutons
    const defaultStyle = document.getElementById('default-permissions');
    if (defaultStyle) {
      defaultStyle.textContent = '.onlySupervisor { display: none; } .onlyCommandStaff { display: none; }';
    } else {
      document.querySelectorAll('.onlySupervisor').forEach(el => {
        el.style.display = 'none';
      });
      document.querySelectorAll('.onlyCommandStaff').forEach(el => {
        el.style.display = 'none';
      });
    }

    // Optionally, show a user-friendly message
    const errorBanner = document.getElementById('errorBanner');
    if (errorBanner) {
      errorBanner.textContent = 'An unexpected error occurred.';
      errorBanner.style.display = 'block';
    }
  }
}

// Initialiser les event listeners du profil si déjà affiché
function preloadFromCache() {
  initProfileListeners();
}

// Fonction pour initialiser les event listeners du profil utilisateur
function initProfileListeners() {
  const container = document.getElementById('userProfile');
  if (!container) return;
  
  const navLinkAnchor = container.closest('a.nav-link');
  if (navLinkAnchor && !navLinkAnchor.hasAttribute('data-listeners-attached')) {
    navLinkAnchor.style.cursor = 'pointer';
    navLinkAnchor.setAttribute('data-listeners-attached', 'true');
    
    const avatarEl = container.querySelector('.profile-avatar');
    const userId = avatarEl ? avatarEl.getAttribute('data-user-id') : null;
    
    if (userId) {
      navLinkAnchor.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = `/infos-agent?userId=${userId}`;
      });

      // Hover effect: légère opacité au lieu de changer la couleur du texte
      navLinkAnchor.addEventListener('mouseenter', () => {
        navLinkAnchor.style.opacity = '0.8';
      });
      navLinkAnchor.addEventListener('mouseleave', () => {
        navLinkAnchor.style.opacity = '1';
      });
    }
  }
}

// Charger immédiatement depuis le cache avant même que fetchUser() se termine
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', preloadFromCache);
} else {
  preloadFromCache();
}

fetchUser();

// ========== Active Page Detection & Highlighting ==========
/**
 * Détecte et met en surbrillance la page active dans la sidebar
 * - Applique la classe 'active' au lien correspondant à l'URL actuelle
 * - Déplie automatiquement le dropdown parent si nécessaire
 * - Garde le menu déplié pour toutes les pages du même groupe
 */
function setActivePage() {
  let currentPath = window.location.pathname;
  
  // Cas spécial : /protected doit activer le Dashboard
  if (currentPath === '/protected') {
    currentPath = '/dashboard';
  }
  
  // Trouver tous les liens de navigation (sauf les dropdown-title)
  const allLinks = document.querySelectorAll('.sidebar-nav .nav-link:not(.dropdown-title):not(.dropdown-toggle)');
  
  let activeLink = null;
  let activeDropdown = null;
  let bestMatchLength = 0;
  
  // Chercher le lien correspondant à la page actuelle
  allLinks.forEach(link => {
    const href = link.getAttribute('href');
    
    if (!href) return;
    
    // Vérifier si le href correspond exactement au path actuel
    if (href === currentPath) {
      activeLink = link;
      bestMatchLength = currentPath.length;
      
      // Vérifier si ce lien est dans un dropdown
      const parentDropdown = link.closest('.dropdown-container');
      if (parentDropdown) {
        activeDropdown = parentDropdown;
      }
    }
    // Vérifier si c'est un match partiel (pour les sections avec sous-pages)
    // Par exemple: /trello/index devrait matcher avec /trello/
    else if (currentPath.startsWith(href) && href.length > 1 && href.length > bestMatchLength) {
      // On garde seulement le meilleur match (le plus long)
      activeLink = link;
      bestMatchLength = href.length;
      
      const parentDropdown = link.closest('.dropdown-container');
      if (parentDropdown) {
        activeDropdown = parentDropdown;
      }
    }
  });
  
  // Appliquer la classe active au lien trouvé
  if (activeLink) {
    activeLink.classList.add('active');
    
    // Si le lien est dans un dropdown, ouvrir le dropdown
    if (activeDropdown) {
      const menu = activeDropdown.querySelector('.dropdown-menu');
      // Ouvrir le dropdown sans fermer les autres (pour la navigation initiale)
      toggleDropdown(activeDropdown, menu, true);
    }
  }
  
  // Marquer aussi le dropdown-toggle comme actif si une de ses sous-pages est active
  if (activeDropdown) {
    const dropdownToggle = activeDropdown.querySelector('.dropdown-toggle');
    if (dropdownToggle) {
      dropdownToggle.classList.add('active');
    }
  }
}

// Exécuter la détection de page active au chargement
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setActivePage);
} else {
  setActivePage();
}
