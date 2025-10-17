// Toggle the visibility of a dropdown menu
const toggleDropdown = (dropdown, menu, isOpen) => {
  dropdown.classList.toggle("open", isOpen);
  menu.style.height = isOpen ? `${menu.scrollHeight}px` : 0;
};

// Close all open dropdowns
const closeAllDropdowns = () => {
  document.querySelectorAll(".dropdown-container.open").forEach((openDropdown) => {
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

    closeAllDropdowns();
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

// Collapse sidebar by default on small screens
if (window.innerWidth <= 1024) {
  document.querySelector(".sidebar").classList.add("collapsed");
  document.body.classList.add("collapsed");
}

async function fetchUser() {
  try {
    let user;


    if (window.clientCache && typeof window.clientCache.getOrFetch === 'function') {
      user = await window.clientCache.getOrFetch('user', async () => {
        const res = await fetch('/api/user');
        if (!res.ok) throw new Error('Non connecté');
        return await res.json();
      }, window.CLIENT_CACHE_TTL ? window.CLIENT_CACHE_TTL.USER : 300);
    } else {
      const res = await fetch('/api/user');
      if (!res.ok) throw new Error('Non connecté');
      user = await res.json();
    }

    // Avatar: priorité à la photo personnalisée du profil agent (photo_url), sinon avatar Discord
    let avatarUrl;
    try {
      const profRes = await fetch(`/api/agent-profile/${user.id}`);
      if (profRes.ok) {
        const profile = await profRes.json();
        if (profile && profile.photo_url && String(profile.photo_url).trim() !== '') {
          avatarUrl = profile.photo_url.trim();
        }
      }
    } catch (e) {
      console.warn('Impossible de récupérer le profil agent pour la sidebar:', e);
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

    const navLinkAnchor = container.closest('a.nav-link');
    if (navLinkAnchor) {
      navLinkAnchor.style.cursor = 'pointer';
      navLinkAnchor.addEventListener('click', (e) => {
        e.preventDefault();
  // Utiliser un chemin absolu pour fonctionner depuis n'importe quel sous-dossier (ex: /LSPD/trello/)
  window.location.href = `/infos-agent?userId=${user.id}`;
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

    // Ensuite dans JS :
    document.querySelectorAll('.onlySupervisor').forEach(el => {
      if (user.isSupervisor || user.isCommandStaff || user.isSuperAdmin) {
        el.style.display = 'block'; // ou 'block', selon le layout
      }
    });

    document.querySelectorAll('.onlyCommandStaff').forEach(el => {
      if (user.isCommandStaff || user.isSuperAdmin) {
        el.style.display = 'block'; // ou 'block', selon le layout
      }
    });

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

fetchUser();
