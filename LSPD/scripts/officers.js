const API_URL = '/api/officers';
const ITEMS_PER_PAGE = 10;

const searchInput = document.getElementById('searchInput');
const tableBody = document.querySelector('#officersTable tbody');
const paginationDiv = document.getElementById('pagination');

let agents = [];
let filteredAgents = [];
let currentPage = 1;

async function loadAgents() {
    const loader = document.getElementById('loaderOverlay');
    loader.style.display = 'flex';
    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error('Erreur chargement');
        agents = await res.json();
        applyFilters();
    } catch (e) {
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#f66;">Erreur de chargement.</td></tr>`;
        console.error(e);
    } finally {
        loader.style.display = 'none';
    }
}

function applyFilters() {
    const search = (searchInput.value || "").trim().toLowerCase();

    filteredAgents = agents.filter(item => {
        const name = (item.displayName || "").toLowerCase();
        const id = (item.id || "").toLowerCase();
        const grade = (item.grade || "").toLowerCase();

        return name.includes(search) || id.includes(search) || grade.includes(search);
    });

    currentPage = 1;
    renderTable();
    renderPagination();
}

function renderTable() {
    tableBody.innerHTML = '';
    if (filteredAgents.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="3" style="text-align:center;">Aucun officer trouvé.</td></tr>`;
        return;
    }

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = filteredAgents.slice(start, end);

    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
        <td>${item.id}</td>
        <td>${item.displayName}</td>
        <td>${item.grade}</td>
    `;
        tr.addEventListener('click', () => {
            // On ouvre le menu officer en transmettant l'ID Discord de l'agent
            window.location.href = `officerMenu.html?userId=${item.id}`;
        });
        tableBody.appendChild(tr);
    });
}

function renderPagination() {
    paginationDiv.innerHTML = '';
    const totalPages = Math.ceil(filteredAgents.length / ITEMS_PER_PAGE);
    if (totalPages <= 1) return;

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '‹ Précédent';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => { currentPage--; renderTable(); renderPagination(); });
    paginationDiv.appendChild(prevBtn);

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        if (i === currentPage) btn.disabled = true;
        btn.addEventListener('click', () => { currentPage = i; renderTable(); renderPagination(); });
        paginationDiv.appendChild(btn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Suivant ›';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => { currentPage++; renderTable(); renderPagination(); });
    paginationDiv.appendChild(nextBtn);
}

searchInput.addEventListener('input', applyFilters);

loadAgents();
