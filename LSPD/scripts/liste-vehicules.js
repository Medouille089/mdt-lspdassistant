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

        const photoCell = item.photo
            ? `<td class="photo-cell"><img src="${item.photo}" alt="${item.modele}"></td>`
            : `<td class="photo-cell no-photo">🚗</td>`;

        const proprietaireDisplay = item.proprietaire_nom
            ? `${item.proprietaire_nom} ${item.proprietaire_prenom}`
            : '-';

        const mandatBadge = item.mandat_actif
            ? '<span class="badge-mandat actif">OUI</span>'
            : '<span class="badge-mandat inactif">NON</span>';

        tr.innerHTML = `
            ${photoCell}
            <td>${item.modele}</td>
            <td><span class="plaque-cell">${item.plaque}</span></td>
            <td>${item.couleur || '-'}</td>
            <td>${proprietaireDisplay}</td>
            <td>${mandatBadge}</td>
        `;

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

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '‹';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
            renderPagination();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    paginationDiv.appendChild(prevBtn);

    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);

    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    if (startPage > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.textContent = '1';
        firstBtn.addEventListener('click', () => {
            currentPage = 1;
            renderTable();
            renderPagination();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        paginationDiv.appendChild(firstBtn);

        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.padding = '8px';
            paginationDiv.appendChild(dots);
        }
    }

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
        paginationDiv.appendChild(btn);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.padding = '8px';
            paginationDiv.appendChild(dots);
        }

        const lastBtn = document.createElement('button');
        lastBtn.textContent = totalPages;
        lastBtn.addEventListener('click', () => {
            currentPage = totalPages;
            renderTable();
            renderPagination();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        paginationDiv.appendChild(lastBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.textContent = '›';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
            renderPagination();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    paginationDiv.appendChild(nextBtn);
}

searchInput.addEventListener('input', applyFilters);
mandatFilter.addEventListener('change', applyFilters);
addVehiculeBtn.addEventListener('click', () => {
    window.location.href = '/vehicule.html';
});

loadVehicules();
