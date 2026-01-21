const API_URL = '/api/citoyens';
const ITEMS_PER_PAGE = 20;

const searchInput = document.getElementById('searchInput');
const mandatFilter = document.getElementById('mandatFilter');
const tableBody = document.querySelector('#citoyenTable tbody');
const paginationDiv = document.getElementById('pagination');
const addCitoyenBtn = document.getElementById('addCitoyenBtn');
const totalCitoyensEl = document.getElementById('totalCitoyens');
const totalMandatsEl = document.getElementById('totalMandats');

let allCitoyens = [];
let filteredCitoyens = [];
let currentPage = 1;

// Format date "yyyy-mm-dd" en "dd/mm/yyyy"
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Calcule l'âge à partir de la date de naissance
function calculateAge(dateStr) {
    if (!dateStr) return '';
    const birthDate = new Date(dateStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

// Formatte un numéro de téléphone au format 555-XXXX
function formatPhoneNumber(phone) {
    if (!phone) return '-';
    
    // Extraire uniquement les chiffres
    const digits = phone.replace(/\D/g, '');
    
    // Si moins de 4 chiffres, retourner tel quel
    if (digits.length < 4) return digits || '-';
    
    // Prendre les 7 derniers chiffres si plus de 7
    const cleaned = digits.slice(-7);
    
    // Formater : 555-XXXX (3 premiers chiffres, tiret, 4 derniers)
    if (cleaned.length <= 3) {
        return cleaned;
    } else {
        return cleaned.substring(0, 3) + '-' + cleaned.substring(3, 7);
    }
}

// Charge les données depuis l'API
async function loadCitoyens() {
    const loader = document.getElementById('loaderOverlay');
    loader.style.display = 'flex';
    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error('Erreur chargement');
        const data = await res.json();
        allCitoyens = data.citoyens || [];
        updateStats();
        applyFilters();
    } catch (e) {
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#f66;">Erreur de chargement.</td></tr>`;
        console.error(e);
        showNotification('Erreur lors du chargement des citoyens', 'error');
    } finally {
        loader.style.display = 'none';
    }
}

// Mettre à jour les statistiques
function updateStats() {
    totalCitoyensEl.textContent = allCitoyens.length;
    const mandatsActifs = allCitoyens.filter(c => c.mandat_actif).length;
    totalMandatsEl.textContent = mandatsActifs;
}

// Appliquer filtres et pagination
function applyFilters() {
    const search = searchInput.value.trim().toLowerCase();
    const mandatValue = mandatFilter.value;

    filteredCitoyens = allCitoyens.filter(item => {
        // Filtre texte sur nom, prénom, téléphone
        const textMatch = (
            item.nom.toLowerCase().includes(search) ||
            item.prenom.toLowerCase().includes(search) ||
            (item.telephone && item.telephone.toLowerCase().includes(search))
        );

        // Filtre mandat
        let mandatMatch = true;
        if (mandatValue === 'true') {
            mandatMatch = item.mandat_actif === true;
        } else if (mandatValue === 'false') {
            mandatMatch = item.mandat_actif === false;
        }

        return textMatch && mandatMatch;
    });

    currentPage = 1; // reset page à 1 à chaque filtre
    renderTable();
    renderPagination();
}

// Affiche la page courante du tableau
function renderTable() {
    tableBody.innerHTML = '';

    if (filteredCitoyens.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Aucun citoyen trouvé.</td></tr>`;
        return;
    }

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = filteredCitoyens.slice(start, end);

    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        
        const photoCell = item.photo 
            ? `<td class="photo-cell"><img src="${item.photo}" alt="${item.nom}"></td>`
            : `<td class="photo-cell no-photo">👤</td>`;
        
        const age = calculateAge(item.date_naissance);
        const dateNaissanceDisplay = `${formatDate(item.date_naissance)} (${age} ans)`;
        
        const mandatBadge = item.mandat_actif 
            ? '<span class="badge-mandat actif">OUI</span>'
            : '<span class="badge-mandat inactif">NON</span>';

        const tagsHtml = `<div class="mini-tags">` + (item.tags || []).map(tag => 
            `<span class="mini-tag-pill" style="background: ${tag.color};" title="${tag.name}">${tag.name}</span>`
        ).join('') + `</div>`;

        tr.innerHTML = `
            ${photoCell}
            <td>${item.nom}</td>
            <td>${item.prenom}</td>
            <td>${dateNaissanceDisplay}</td>
            <td>${item.nationalite}</td>
            <td>${formatPhoneNumber(item.telephone)}</td>
            <td>${item.emploi || '-'}</td>
            <td>${tagsHtml}</td>
            <td>${mandatBadge}</td>
        `;
        
        tr.addEventListener('click', () => {
            window.location.href = `/view-citoyen.html?id=${item.id}`;
        });
        
        tableBody.appendChild(tr);
    });
}

// Affiche la pagination
function renderPagination() {
    paginationDiv.innerHTML = '';

    const totalPages = Math.ceil(filteredCitoyens.length / ITEMS_PER_PAGE);
    if (totalPages <= 1) return; // Pas besoin de pagination

    // Bouton précédent
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

    // Boutons de pages (max 5 boutons visibles)
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

    // Bouton suivant
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

// Event listeners
searchInput.addEventListener('input', applyFilters);
mandatFilter.addEventListener('change', applyFilters);
addCitoyenBtn.addEventListener('click', () => {
    window.location.href = '/citoyen.html';
});

// Chargement initial
loadCitoyens();
