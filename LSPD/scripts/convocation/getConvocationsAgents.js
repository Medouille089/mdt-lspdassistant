const API_URL = '/api/getConvocationsAgents';
const ITEMS_PER_PAGE = 10;

const searchInput = document.getElementById('searchInput');
const dateStartInput = document.getElementById('dateStart');
const dateEndInput = document.getElementById('dateEnd');
const tableBody = document.querySelector('#braceletTable tbody');
const paginationDiv = document.getElementById('pagination');

let convocations = [];
let filteredConvocations = [];
let currentPage = 1;

// Format date "yyyy-mm-dd" en "dd/mm/yyyy"
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR');
}

// Charge les données depuis l'API
async function loadConvocations() {
    const loader = document.getElementById('loaderOverlay');
    loader.style.display = 'flex';

    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error('Erreur chargement');
        convocations = await res.json();

        applyFilters();
    } catch (e) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#f66;">Erreur de chargement.</td></tr>`;
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
    
    filteredConvocations = convocations.filter(item => {
        const textMatch =
            (item.agent_convoque_nom?.toLowerCase().includes(search)) ||
            (item.agent_convoquant_nom?.toLowerCase().includes(search));

        const itemDate = item.date;
        const startOk = dateStart ? itemDate >= dateStart : true;
        const endOk = dateEnd ? itemDate <= dateEnd : true;

        return textMatch && startOk && endOk;
    });

    currentPage = 1;
    renderTable();
    renderPagination();
}

// Affiche la page courante du tableau
function renderTable() {
    tableBody.innerHTML = '';

    if (filteredConvocations.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Aucune convocation d'agent trouvée.</td></tr>`;
        return;
    }

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = filteredConvocations.slice(start, end);

    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.id}</td>
            <td>${item.agent_convoque_nom || 'Non précisé'}</td>
            <td>${item.agent_convoquant_nom || 'Non précisé'}</td>
            <td>${item.agent_convoquant_grade || 'Non précisé'}</td>
            <td>${formatDate(item.date)}</td>
            <td>${item.lieu || 'Non précisé'}</td>
        `;
        
        // Ajouter l'événement de clic pour ouvrir les détails
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => {
            window.location.href = `viewConvocationAgent.html?id=${item.id}`;
        });
        
        tableBody.appendChild(tr);
    });
}

// Affiche la pagination
function renderPagination() {
    const totalPages = Math.ceil(filteredConvocations.length / ITEMS_PER_PAGE);
    paginationDiv.innerHTML = '';

    if (totalPages <= 1) return;

    // Bouton précédent
    if (currentPage > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '← Précédent';
        prevBtn.onclick = () => {
            currentPage--;
            renderTable();
            renderPagination();
        };
        paginationDiv.appendChild(prevBtn);
    }

    // Numéros de pages
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.className = i === currentPage ? 'active' : '';
        pageBtn.onclick = () => {
            currentPage = i;
            renderTable();
            renderPagination();
        };
        paginationDiv.appendChild(pageBtn);
    }

    // Bouton suivant
    if (currentPage < totalPages) {
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Suivant →';
        nextBtn.onclick = () => {
            currentPage++;
            renderTable();
            renderPagination();
        };
        paginationDiv.appendChild(nextBtn);
    }
}

// Listeners sur les filtres
searchInput.addEventListener('input', applyFilters);
dateStartInput.addEventListener('change', applyFilters);
dateEndInput.addEventListener('change', applyFilters);

// Chargement initial
document.addEventListener('DOMContentLoaded', () => {
    loadConvocations();
});