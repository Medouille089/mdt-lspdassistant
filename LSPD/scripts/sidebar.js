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
    const res = await fetch('/api/user');
    if (!res.ok) throw new Error('Non connecté');
    const user = await res.json();

    // Avatar
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator) % 5}.png`;

    // Taille police dynamique
    let fontSize = '16px';
    const length = user.username.length;
    if (length > 15) fontSize = '13px';
    if (length > 20) fontSize = '11px';

    // Affichage profil
    const container = document.getElementById('userProfile');
    container.innerHTML = `
      <div id="profileBox" style="display: flex; align-items: center; cursor: pointer; gap: 10px;">
        <img src="${avatarUrl}" alt="Avatar" style="width: 40px; height: 40px; border-radius: 50%; border: 1px solid #FFFFFF;">
        <div style="display: flex; flex-direction: column; color: #FFFFFF;">
          <div style="font-weight: 700; font-size: ${fontSize};">${user.username}</div>
          <div style="font-weight: 500; font-size: 0.8rem; color: #CCCCCC;">${user.grade}</div>
        </div>
      </div>
      <div id="profileMenu" style="
        display: block;
        opacity: 0;
        pointer-events: none;
        font-weight: bold;
        cursor: pointer;
        color: #FFFFFF;
        width: max-content;
        position: absolute;
        right: 0;
        z-index: 10;
      ">
      </div>
    `;

    const profileBox = document.getElementById('profileBox');
    const profileMenu = document.getElementById('profileMenu');

    let menuVisible = false;

    profileBox.addEventListener('click', (e) => {
      e.stopPropagation();
      menuVisible = !menuVisible;
      if (menuVisible) {
        profileMenu.style.opacity = '1';
        profileMenu.style.pointerEvents = 'auto';
        profileMenu.style.transform = 'translateY(0)';
      } else {
        profileMenu.style.opacity = '0';
        profileMenu.style.pointerEvents = 'none';
        profileMenu.style.transform = 'translateY(-5px)';
      }
    });

    profileMenu.addEventListener('click', () => {
      window.location.href = '/logout';
    });

    document.addEventListener('click', (e) => {
      if (!profileBox.contains(e.target) && !profileMenu.contains(e.target)) {
        menuVisible = false;
        profileMenu.style.opacity = '0';
        profileMenu.style.pointerEvents = 'none';
        profileMenu.style.transform = 'translateY(-5px)';
      }
    });

    document.querySelectorAll('.onlySupervisor').forEach(el => {
      el.style.display = (user.isSupervisor || user.isSuperAdmin) ? '' : 'none';
    });

    document.querySelectorAll('.onlyCommandStaff').forEach(el => {
      el.style.display = (user.isCommandStaff || user.isSuperAdmin) ? '' : 'none';
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
fetch('/api/user').then(res => res.json()).then(console.log);
