const API_URL = '/api/vehicules';
const ITEMS_PER_PAGE = 20;

const searchInput = document.getElementById('searchInput');
const mandatFilter = document.getElementById('mandatFilter');
const tableBody = document.querySelector('#vehiculeTable tbody');
const paginationDiv = document.getElementById('pagination');
const addVehiculeBtn = document.getElementById('addVehiculeBtn');
const totalVehiculesEl = document.getElementById('totalVehicules');
const totalMandatsEl = document.getElementById('totalMandats');

let allVehicules = [];
let filteredVehicules = [];
let currentPage = 1;
let contextVehicule = null;

function enrichContextMenu() {
    if (typeof MENU_ITEMS !== 'undefined' && contextVehicule) {
        const oldVehiculeIndex = MENU_ITEMS.findIndex(item => item.id === 'vehicule-copy-plaque');
        if (oldVehiculeIndex !== -1) {
            MENU_ITEMS.splice(oldVehiculeIndex, 3);
        }

        const currentVehicule = contextVehicule;

        MENU_ITEMS.unshift(
            {
                id: 'vehicule-copy-plaque',
                label: 'Copier la plaque',
                action: () => {
                    navigator.clipboard.writeText(currentVehicule.plaque).then(() => {
                        showNotification('Plaque copiée !', 'success');
                    }).catch(() => {
                        showNotification('Erreur lors de la copie', 'error');
                    });
                }
            },
            {
                id: 'vehicule-copy-link',
                label: 'Copier le lien',
                action: () => {
                    const vehiculeUrl = `${window.location.origin}/view-vehicule.html?id=${currentVehicule.id}`;
                    navigator.clipboard.writeText(vehiculeUrl).then(() => {
                        showNotification('Lien copié !', 'success');
                    }).catch(() => {
                        showNotification('Erreur lors de la copie', 'error');
                    });
                }
            },
            { separator: true }
        );
    }
}

function cleanContextMenu() {
    if (typeof MENU_ITEMS !== 'undefined') {
        const oldVehiculeIndex = MENU_ITEMS.findIndex(item => item.id === 'vehicule-copy-plaque');
        if (oldVehiculeIndex !== -1) {
            MENU_ITEMS.splice(oldVehiculeIndex, 3);
        }
    }
    contextVehicule = null;
}

async function loadVehicules() {
    const loader = document.getElementById('loaderOverlay');
    loader.style.display = 'flex';
    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error('Erreur chargement');
        const data = await res.json();
        allVehicules = data.vehicules || [];
        updateStats();
        applyFilters();
    } catch (e) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#f66;">Erreur de chargement.</td></tr>`;
        console.error(e);
        showNotification('Erreur lors du chargement des véhicules', 'error');
    } finally {
        loader.style.display = 'none';
    }
}

function updateStats() {
    totalVehiculesEl.textContent = allVehicules.length;
    const mandatsActifs = allVehicules.filter(v => v.mandat_actif).length;
    totalMandatsEl.textContent = mandatsActifs;
}

function applyFilters() {
    const search = searchInput.value.trim().toLowerCase();
    const mandatValue = mandatFilter.value;

    filteredVehicules = allVehicules.filter(item => {
        const textMatch = (
            item.modele.toLowerCase().includes(search) ||
            item.plaque.toLowerCase().includes(search)
        );

        let mandatMatch = true;
        if (mandatValue === 'true') {
            mandatMatch = item.mandat_actif === true;
        } else if (mandatValue === 'false') {
            mandatMatch = item.mandat_actif === false;
        }

        return textMatch && mandatMatch;
    });

    currentPage = 1;
    renderTable();
    renderPagination();
}

function renderTable() {
    tableBody.innerHTML = '';

    if (filteredVehicules.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Aucun véhicule trouvé.</td></tr>`;
        return;
    }

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = filteredVehicules.slice(start, end);

    pageItems.forEach(item => {
        const tr = document.createElement('tr');

        // Create photo cell with fallback handling
        const photoCell = document.createElement('td');
        photoCell.className = 'photo-cell';

        if (item.photo) {
            const img = document.createElement('img');
            img.src = item.photo;
            img.alt = item.modele;
            img.onerror = function() {
                // Replace broken image with default vehicle icon
                this.style.display = 'none';
                photoCell.classList.add('no-photo');
                photoCell.innerHTML = '<span class="default-vehicle-icon">🚗</span>';
            };
            photoCell.appendChild(img);
        } else {
            photoCell.classList.add('no-photo');
            photoCell.innerHTML = '<span class="default-vehicle-icon">🚗</span>';
        }

        const proprietaireDisplay = item.proprietaire_nom
            ? `${item.proprietaire_nom} ${item.proprietaire_prenom}`
            : '-';

        const mandatBadge = item.mandat_actif
            ? '<span class="badge-mandat actif">OUI</span>'
            : '<span class="badge-mandat inactif">NON</span>';

        tr.appendChild(photoCell);

        const modeleTd = document.createElement('td');
        modeleTd.textContent = item.modele;
        tr.appendChild(modeleTd);

        const plaqueTd = document.createElement('td');
        plaqueTd.innerHTML = `<span class="plaque-cell">${item.plaque}</span>`;
        tr.appendChild(plaqueTd);

        const couleurTd = document.createElement('td');
        couleurTd.textContent = item.couleur || '-';
        tr.appendChild(couleurTd);

        const proprietaireTd = document.createElement('td');
        proprietaireTd.textContent = proprietaireDisplay;
        tr.appendChild(proprietaireTd);

        const mandatTd = document.createElement('td');
        mandatTd.innerHTML = mandatBadge;
        tr.appendChild(mandatTd);

        tr.addEventListener('click', () => {
            window.location.href = `/view-vehicule.html?id=${item.id}`;
        });

        tr.dataset.vehiculeId = item.id;
        tr.dataset.vehiculePlaque = item.plaque;

        tableBody.appendChild(tr);
    });
}

document.addEventListener('contextmenu', (e) => {
    const tr = e.target.closest('tr');
    if (tr && tr.dataset.vehiculeId) {
        const vehicule = allVehicules.find(v => v.id == tr.dataset.vehiculeId);
        if (vehicule) {
            contextVehicule = vehicule;
            enrichContextMenu();
        }
    } else {
        cleanContextMenu();
    }
}, true);

if (tableBody) {
    tableBody.parentElement.addEventListener('mouseleave', () => {
        cleanContextMenu();
    });
}

function renderPagination() {
    paginationDiv.innerHTML = '';

    const totalPages = Math.ceil(filteredVehicules.length / ITEMS_PER_PAGE);
    if (totalPages <= 1) return;

    // Create wrapper for modern design
    const wrapper = document.createElement('div');
    wrapper.className = 'pagination-wrapper';

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-nav';
    prevBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
    prevBtn.disabled = currentPage === 1;
    prevBtn.title = 'Page précédente';
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
            renderPagination();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    wrapper.appendChild(prevBtn);

    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    // First page + ellipsis
    if (startPage > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.textContent = '1';
        firstBtn.addEventListener('click', () => {
            currentPage = 1;
            renderTable();
            renderPagination();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        wrapper.appendChild(firstBtn);

        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.className = 'page-ellipsis';
            dots.textContent = '...';
            wrapper.appendChild(dots);
        }
    }

    // Page buttons
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        if (i === currentPage) {
            btn.classList.add('active');
        }
        btn.addEventListener('click', () => {
            currentPage = i;
            renderTable();
            renderPagination();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        wrapper.appendChild(btn);
    }

    // Last page + ellipsis
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.className = 'page-ellipsis';
            dots.textContent = '...';
            wrapper.appendChild(dots);
        }

        const lastBtn = document.createElement('button');
        lastBtn.textContent = totalPages;
        lastBtn.addEventListener('click', () => {
            currentPage = totalPages;
            renderTable();
            renderPagination();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        wrapper.appendChild(lastBtn);
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-nav';
    nextBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.title = 'Page suivante';
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
            renderPagination();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    wrapper.appendChild(nextBtn);

    paginationDiv.appendChild(wrapper);

    // Page info
    const start = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const end = Math.min(currentPage * ITEMS_PER_PAGE, filteredVehicules.length);
    const info = document.createElement('span');
    info.className = 'pagination-info';
    info.textContent = `${start}-${end} sur ${filteredVehicules.length}`;
    paginationDiv.appendChild(info);
}

searchInput.addEventListener('input', applyFilters);
mandatFilter.addEventListener('change', applyFilters);
addVehiculeBtn.addEventListener('click', () => {
    window.location.href = '/vehicule.html';
});

loadVehicules();
