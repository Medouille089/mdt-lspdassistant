// === Constants ===
const API_URL = '/api/officer/sanctions';
const REVOKE_API = '/api/sanctions/revoke';
const ITEMS_PER_PAGE = 10;

// === DOM Elements ===
const tableBody = document.querySelector('#sanctionsTable tbody');
const paginationDiv = document.getElementById('pagination');
const loaderOverlay = document.getElementById('loaderOverlay');
const h1 = document.querySelector('h1');

// === URL Parameters ===
const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get('userId');

let sanctions = [];
let currentPage = 1;

// === Helper Functions ===
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date)) return '-';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// === Fetch agent display name ===
async function fetchAgentName() {
    try {
        // Fetch le membre Discord via l'API Discord côté serveur
        const res = await fetch(`/api/discord/member/${userId}`);
        if (!res.ok) throw new Error('Erreur récupération agent');
        const data = await res.json();

        // data.displayName = nom de l'agent sur le serveur
        if (data.displayName) {
            h1.textContent = `Sanctions de l'agent ${data.displayName}`;
        } else {
            h1.textContent = `Sanctions de l'agent`;
        }
    } catch (err) {
        console.warn(err);
        h1.textContent = `Sanctions de l'agent`;
    }
}


// === Load sanctions ===
async function loadSanctions() {
    if (!userId) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Utilisateur non spécifié.</td></tr>`;
        return;
    }

    loaderOverlay.style.display = 'flex';
    try {
        const res = await fetch(`${API_URL}?userId=${userId}`);
        if (!res.ok) throw new Error('Erreur lors de la récupération des sanctions');
        sanctions = await res.json();
        renderTable();
        renderPagination();
    } catch (err) {
        console.error(err);
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#f66;">Erreur de chargement.</td></tr>`;
    } finally {
        loaderOverlay.style.display = 'none';
    }
}

// === Render table ===
function renderTable() {
    tableBody.innerHTML = '';
    if (!sanctions.length) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Aucune sanction pour cet agent.</td></tr>`;
        return;
    }

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = sanctions.slice(start, end);

    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        if (item.archived) tr.classList.add('archived');

        tr.innerHTML = `
            <td>${item.id}</td>
            <td>${item.player_id}</td>
            <td>${item.issued_by}</td>
            <td>${item.type}</td>
            <td>${item.reason}</td>
            <td>${formatDate(item.date_from)}</td>
            <td>${item.date_end ? formatDate(item.date_end) : '-'}</td>
            <td>
            ${item.archived
                ? `Révoqué par ${item.revoked_by || 'inconnu'}`
                : `<button class="revoke-btn">Révoquer</button>`}
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
                        item.archived = true;
                        tr.classList.add('archived');
                        btn.replaceWith(document.createTextNode('Révoqué'));
                    }
                } catch (err) {
                    console.error(err);
                    btn.disabled = false;
                    alert('Impossible de révoquer la sanction');
                }
            });
        }

        tableBody.appendChild(tr);
    });
}

// === Render pagination ===
function renderPagination() {
    paginationDiv.innerHTML = '';
    const totalPages = Math.ceil(sanctions.length / ITEMS_PER_PAGE);
    if (totalPages <= 1) return;

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '‹ Précédent';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => {
        currentPage--;
        renderTable();
        renderPagination();
    });
    paginationDiv.appendChild(prevBtn);

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        if (i === currentPage) btn.disabled = true;
        btn.addEventListener('click', () => {
            currentPage = i;
            renderTable();
            renderPagination();
        });
        paginationDiv.appendChild(btn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Suivant ›';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => {
        currentPage++;
        renderTable();
        renderPagination();
    });
    paginationDiv.appendChild(nextBtn);
}

// === Init ===
(async function init() {
    await fetchAgentName();
    await loadSanctions();
})();
