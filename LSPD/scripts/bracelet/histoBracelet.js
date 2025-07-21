const API_URL = '/api/historique';
const ITEMS_PER_PAGE = 10;

const searchInput = document.getElementById('searchInput');
const dateStartInput = document.getElementById('dateStart');
const dateEndInput = document.getElementById('dateEnd');
const tableBody = document.querySelector('#historiqueTable tbody');
const paginationDiv = document.getElementById('pagination');

let historique = [];
let filteredHistorique = [];
let currentPage = 1;

// Format date "yyyy-mm-dd" en "dd/mm/yyyy"
function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

// Charge les données depuis l'API
async function loadHistorique() {
    const loader = document.getElementById('loaderOverlay');
    loader.style.display = 'flex';
    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error('Erreur chargement');
        historique = await res.json();
        applyFilters();
    } catch (e) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#f66;">Erreur de chargement.</td></tr>`;
        console.error(e);
    } finally {
        loader.style.display = 'none';
    }
}

// Appliquer filtres et pagination
function applyFilters() {
    const search = searchInput.value.trim().toLowerCase();
    const dateStart = dateStartInput.value;
    const dateEnd = dateEndInput.value;

    filteredHistorique = historique.filter(item => {
        // Filtre texte sur id_brac, nom, prénom
        const textMatch = (item.id_brac.toLowerCase().includes(search) ||
            item.nom.toLowerCase().includes(search) ||
            item.prenom.toLowerCase().includes(search));

        // Filtre date entre dateStart et dateEnd
        // Dates au format ISO "yyyy-mm-dd"
        const startOk = dateStart ? item.dateDebut >= dateStart : true;
        const endOk = dateEnd ? item.dateDebut <= dateEnd : true;

        return textMatch && startOk && endOk;
    });

    currentPage = 1; // reset page à 1 à chaque filtre
    renderTable();
    renderPagination();
}

// Affiche la page courante du tableau
function renderTable() {
    tableBody.innerHTML = '';

    if (filteredHistorique.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Aucun historique trouvé.</td></tr>`;
        return;
    }

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = filteredHistorique.slice(start, end);

    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.id_brac}</td>
            <td>${item.nom}</td>
            <td>${item.prenom}</td>
            <td>${item.tel}</td>
            <td>${formatDate(item.dateDebut)}</td>
        `;
        tableBody.appendChild(tr);
    });
}

// Affiche la pagination
function renderPagination() {
    paginationDiv.innerHTML = '';

    const totalPages = Math.ceil(filteredHistorique.length / ITEMS_PER_PAGE);
    if (totalPages <= 1) return;

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '‹ Précédent';
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

    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage < maxPagesToShow - 1) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        if (i === currentPage) {
            btn.disabled = true;
            btn.style.fontWeight = 'bold';
            btn.style.background = '#344863';
        }
        btn.addEventListener('click', () => {
            currentPage = i;
            renderTable();
            renderPagination();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        paginationDiv.appendChild(btn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Suivant ›';
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

// Listeners sur les filtres
searchInput.addEventListener('input', applyFilters);
dateStartInput.addEventListener('change', applyFilters);
dateEndInput.addEventListener('change', applyFilters);

// Charge l'historique à l'ouverture
loadHistorique();
