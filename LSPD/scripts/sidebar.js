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
  const icon = toggler.querySelector('.material-symbols-rounded');
  if (!icon) return;
  // When collapsed, show chevron_right (indicating expand), else chevron_left
  icon.textContent = collapsed ? 'chevron_right' : 'chevron_left';
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

async function fetchUser() {
  try {
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
    const container = document.getElementById('userProfile');
    
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
            <span class=\"profile-username\" style=\"font-weight:700;font-size:${fontSize};color:#FFFFFF;transition:color .18s;\">${user.username}</span>
            <span class=\"profile-grade\" style=\"font-weight:500;font-size:0.8rem;color:#CCCCCC;transition:color .18s;\">${user.grade}</span>
          </span>
        </span>`;
    }

    const navLinkAnchor = container.closest('a.nav-link');
    if (navLinkAnchor && !navLinkAnchor.hasAttribute('data-listeners-attached')) {
      // Initialiser les event listeners
      initProfileListeners();
    }

    // Ensuite gérer les permissions pour afficher les boutons
    // Vérifier d'abord si déjà affichés par instant-sidebar.js
    const supervisorBtn = document.querySelector('.onlySupervisor');
    const adminBtn = document.querySelector('.onlyCommandStaff');
    const alreadyDisplayed = window.__profileLoadedFromCache && 
                             ((supervisorBtn && supervisorBtn.style.display === 'block') || 
                              (adminBtn && adminBtn.style.display === 'block'));
    
    if (!alreadyDisplayed) {
      // Afficher les boutons selon les permissions
      document.querySelectorAll('.onlySupervisor').forEach(el => {
        if (user.isSupervisor || user.isCommandStaff || user.isSuperAdmin) {
          el.style.display = 'block';
        }
      });

      document.querySelectorAll('.onlyCommandStaff').forEach(el => {
        if (user.isCommandStaff || user.isSuperAdmin) {
          el.style.display = 'block';
        }
      });
    }
    
    // Mettre les permissions en cache pour les réutiliser rapidement
    if (window.clientCache) {
      window.clientCache.set('user-permissions', {
        isSupervisor: user.isSupervisor,
        isCommandStaff: user.isCommandStaff,
        isSuperAdmin: user.isSuperAdmin
      }, 1800); // 30 minutes
    }

  } catch (error) {
    console.error('An error occurred while processing the user profile:', error);

    const container = document.getElementById('userProfile');
    if (container) container.style.display = 'none';

    document.querySelectorAll('.onlySupervisor').forEach(el => {
      el.style.display = 'none';
    });

    document.querySelectorAll('.onlyCommandStaff').forEach(el => {
      el.style.display = 'none';
    });

    // Optionally, show a user-friendly message
    const errorBanner = document.getElementById('errorBanner');
    if (errorBanner) {
      errorBanner.textContent = 'An unexpected error occurred.';
      errorBanner.style.display = 'block';
    }
  }
}

// Pré-charger les permissions depuis le cache si disponibles pour afficher immédiatement
function preloadFromCache() {
  if (!window.clientCache) return;
  
  // Si déjà chargé par instant-sidebar.js, ne rien faire pour les permissions
  if (!window.__profileLoadedFromCache) {
    const cachedPermissions = window.clientCache.get('user-permissions');
    if (cachedPermissions) {
      // Afficher immédiatement les boutons selon les permissions en cache
      document.querySelectorAll('.onlySupervisor').forEach(el => {
        if (cachedPermissions.isSupervisor || cachedPermissions.isCommandStaff || cachedPermissions.isSuperAdmin) {
          el.style.display = 'block';
        }
      });

      document.querySelectorAll('.onlyCommandStaff').forEach(el => {
        if (cachedPermissions.isCommandStaff || cachedPermissions.isSuperAdmin) {
          el.style.display = 'block';
        }
      });
    }
  }
  
  // Initialiser les event listeners du profil s'il est déjà affiché
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

      const BLUE = '#0b1b5a';
      navLinkAnchor.addEventListener('mouseenter', () => {
        const usernameEl = navLinkAnchor.querySelector('.profile-username');
        const gradeEl = navLinkAnchor.querySelector('.profile-grade');
        const avatarEl = navLinkAnchor.querySelector('.profile-avatar');
        if (usernameEl) usernameEl.style.color = BLUE;
        if (gradeEl) gradeEl.style.color = BLUE;
        if (avatarEl) avatarEl.style.borderColor = BLUE;
      });
      navLinkAnchor.addEventListener('mouseleave', () => {
        const usernameEl = navLinkAnchor.querySelector('.profile-username');
        const gradeEl = navLinkAnchor.querySelector('.profile-grade');
        const avatarEl = navLinkAnchor.querySelector('.profile-avatar');
        if (usernameEl) usernameEl.style.color = '#FFFFFF';
        if (gradeEl) gradeEl.style.color = '#CCCCCC';
        if (avatarEl) avatarEl.style.borderColor = '#FFFFFF';
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
