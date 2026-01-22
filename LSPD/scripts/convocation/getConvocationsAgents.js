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
            window.location.href = `/viewConvocationAgent?id=${item.id}`;
        });
        
        tableBody.appendChild(tr);
    });
}

// Affiche la pagination
function renderPagination() {
    const totalPages = Math.ceil(filteredConvocations.length / ITEMS_PER_PAGE);
    paginationDiv.innerHTML = '';

    if (totalPages <= 1) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'pagination-wrapper';

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-nav';
    prevBtn.innerHTML = '‹ Précédent';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
            renderPagination();
        }
    };
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
        firstBtn.onclick = () => { currentPage = 1; renderTable(); renderPagination(); };
        wrapper.appendChild(firstBtn);
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.className = 'page-ellipsis';
            dots.textContent = '···';
            wrapper.appendChild(dots);
        }
    }

    // Page buttons
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        if (i === currentPage) btn.classList.add('active');
        btn.onclick = () => { currentPage = i; renderTable(); renderPagination(); };
        wrapper.appendChild(btn);
    }

    // Last page + ellipsis
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.className = 'page-ellipsis';
            dots.textContent = '···';
            wrapper.appendChild(dots);
        }
        const lastBtn = document.createElement('button');
        lastBtn.textContent = totalPages;
        lastBtn.onclick = () => { currentPage = totalPages; renderTable(); renderPagination(); };
        wrapper.appendChild(lastBtn);
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-nav';
    nextBtn.innerHTML = 'Suivant ›';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
            renderPagination();
        }
    };
    wrapper.appendChild(nextBtn);

    paginationDiv.appendChild(wrapper);
}

// Listeners sur les filtres
searchInput.addEventListener('input', applyFilters);
dateStartInput.addEventListener('change', applyFilters);
dateEndInput.addEventListener('change', applyFilters);

// Chargement initial
document.addEventListener('DOMContentLoaded', () => {
    loadConvocations();
});