const API_URL = '/api/sanctions/all';
const REVOKE_API = '/api/sanctions/revoke';
const ITEMS_PER_PAGE = 10;

const searchInput = document.getElementById('searchInput');
const dateStartInput = document.getElementById('dateStart');
const dateEndInput = document.getElementById('dateEnd');
const tableBody = document.querySelector('#sanctionsTable tbody');
const paginationDiv = document.getElementById('pagination');

let sanctions = [];
let filteredSanctions = [];
let currentPage = 1;

function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

async function loadSanctions() {
    document.getElementById('loaderOverlay').style.display = 'flex';
    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error('Erreur chargement');
        sanctions = await res.json();
        applyFilters();
    } catch (e) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#f66;">Erreur de chargement.</td></tr>`;
        console.error(e);
    } finally {
        document.getElementById('loaderOverlay').style.display = 'none';
    }
}

function applyFilters() {
    const search = searchInput.value.trim().toLowerCase();
    const dateStart = dateStartInput.value;
    const dateEnd = dateEndInput.value;

    filteredSanctions = sanctions.filter(item => {
        const textMatch =
            (item.player_id?.toLowerCase().includes(search)) ||
            (item.issued_by?.toLowerCase().includes(search));

        const startOk = dateStart ? item.date_from >= dateStart : true;
        const endOk = dateEnd ? item.date_end <= dateEnd : true;

        return textMatch && startOk && endOk;
    });

    currentPage = 1;
    renderTable();
    renderPagination();
}

function renderTable() {
    tableBody.innerHTML = '';
    if (filteredSanctions.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Aucune sanction trouvée.</td></tr>`;
        return;
    }

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = filteredSanctions.slice(start, end);

    pageItems.forEach(item => {
        const tr = document.createElement('tr');

        // Ligne grisée si sanction révoquée
        if (item.archived) tr.classList.add('archived');

        tr.innerHTML = `
            <td>${item.id}</td>
            <td>${item.player_id}</td>
            <td>${item.issued_by}</td>
            <td>${item.type}</td>
            <td>${item.reason}</td>
            <td>${formatDate(item.date_from.split('T')[0])}</td>
            <td>${item.date_end ? formatDate(item.date_end.split('T')[0]) : '-'}</td>
            <td>
                ${item.archived ? `Révoqué par : ${item.revoked_by || 'Vous'}` : `<button class="revoke-btn">Révoquer</button>`}
            </td>
        `;

        if (!item.archived) {
            const btn = tr.querySelector('.revoke-btn');
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                try {
                    const res = await fetch(`${REVOKE_API}/${item.id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (!res.ok) throw new Error('Erreur révocation');

                    const data = await res.json();

                    if (data.success) {
                        // Utilise le nom réel si disponible, sinon "Inconnu"
                        const revokedByName = (data.revoked_by && data.revoked_by.trim()) ? data.revoked_by : 'Vous';

                        // Met à jour l'objet et la ligne
                        item.archived = true;
                        item.revoked_by = revokedByName;
                        tr.classList.add('archived');
                        btn.replaceWith(document.createTextNode(`Révoqué par : ${revokedByName}`));
                    }
                } catch (e) {
                    btn.disabled = false;
                    console.error(e);
                    showNotification('Impossible de révoquer la sanction', 'error');
                }
            });
        }

        tableBody.appendChild(tr);
    });
}


function renderPagination() {
    paginationDiv.innerHTML = '';
    const totalPages = Math.ceil(filteredSanctions.length / ITEMS_PER_PAGE);
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

searchInput.addEventListener('input', applyFilters);
dateStartInput.addEventListener('change', applyFilters);
dateEndInput.addEventListener('change', applyFilters);

loadSanctions();