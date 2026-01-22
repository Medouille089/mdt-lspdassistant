const API_URL = '/api/getConvocation';
const ITEMS_PER_PAGE = 10;

const searchInput = document.getElementById('searchInput');
const dateStartInput = document.getElementById('dateStart');
const dateEndInput = document.getElementById('dateEnd');
const tableBody = document.querySelector('#braceletTable tbody');
const paginationDiv = document.getElementById('pagination');

let convocations = [];
let filteredConvocations = [];
let currentPage = 1;

// Format date "yyyy-mm-ddT22:00:00" en "dd/mm/yyyy"
function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
}

// Charge les données depuis l'API
async function loadConvocations() {
    const loader = document.getElementById('loaderOverlay');
    loader.style.display = 'flex';

    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error('Erreur chargement');
        convocations = await res.json();

        // convocations.sort((a, b) => {
        //     const numA = parseInt(a.id.replace(/\D/g, ''), 10);
        //     const numB = parseInt(b.id.replace(/\D/g, ''), 10);
        //     return numB - numA;
        // });

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
    filteredConvocations = convocations.filter(item => {
        const textMatch =
            (!search) ||
            (item.id?.toString().toLowerCase().includes(search)) ||
            (`CVC${item.id}`.toLowerCase().includes(search)) ||
            (item.nom?.toLowerCase().includes(search)) ||
            (item.prenom?.toLowerCase().includes(search)) ||
            (`${item.nom} ${item.prenom}`.toLowerCase().includes(search)) ||
            (item.officer?.toLowerCase().includes(search));

        const startOk = dateStart ? item.date >= dateStart : true;
        const endOk = dateEnd ? item.date <= dateEnd : true;

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
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Aucune convocation trouvée.</td></tr>`;
        return;
    }

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = filteredConvocations.slice(start, end);

    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>CVC${item.id}</td>
            <td>${item.nom + ' ' + item.prenom}</td>
            <td>${formatDate(item.date)}</td>
            <td>${item.heure ? item.heure.slice(0, 5) : 'Non précisé'}</td>
            <td>${item.officer || 'Non précisé'}</td>
        `;
        tr.addEventListener('click', () => {
            window.location.href = `/viewConvocation?id=${item.id}`;
        });
        tableBody.appendChild(tr);
    });
}

// Affiche la pagination
function renderPagination() {
    paginationDiv.innerHTML = '';

    const totalPages = Math.ceil(filteredConvocations.length / ITEMS_PER_PAGE);
    if (totalPages <= 1) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'pagination-wrapper';

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-nav';
    prevBtn.innerHTML = '‹ Précédent';
    prevBtn.disabled = currentPage === 1;
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
        firstBtn.addEventListener('click', () => { currentPage = 1; renderTable(); renderPagination(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
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
            dots.textContent = '···';
            wrapper.appendChild(dots);
        }
        const lastBtn = document.createElement('button');
        lastBtn.textContent = totalPages;
        lastBtn.addEventListener('click', () => { currentPage = totalPages; renderTable(); renderPagination(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
        wrapper.appendChild(lastBtn);
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-nav';
    nextBtn.innerHTML = 'Suivant ›';
    nextBtn.disabled = currentPage === totalPages;
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
}

// Listeners sur les filtres
searchInput.addEventListener('input', applyFilters);
dateStartInput.addEventListener('change', applyFilters);
dateEndInput.addEventListener('change', applyFilters);

// Charge les convocations à l'ouverture
loadConvocations();
