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
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#f66;">Erreur de chargement.</td></tr>`;
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
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Aucun officer trouvé.</td></tr>`;
        return;
    }

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = filteredAgents.slice(start, end);

    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        const defaultAvatar = 'https://media.istockphoto.com/id/1016744004/fr/vectoriel/image-despace-r%C3%A9serv%C3%A9-de-profil-gray-ne-silhouette-aucune-photo.jpg?s=612x612&w=0&k=20&c=7OLCKLuDpDHaXywnkaGuK-bKQS9lnivwYDYnGqD60bc=';
        const avatarUrl = item.photo_url || defaultAvatar;
        
        tr.innerHTML = `
        <td><img src="${avatarUrl}" alt="Avatar" class="avatar-img" onerror="this.src='https://media.istockphoto.com/id/1016744004/fr/vectoriel/image-despace-r%C3%A9serv%C3%A9-de-profil-gray-ne-silhouette-aucune-photo.jpg?s=612x612&w=0&k=20&c=7OLCKLuDpDHaXywnkaGuK-bKQS9lnivwYDYnGqD60bc='"></td>
        <td>${item.id}</td>
        <td>${item.displayName}</td>
        <td>${item.grade}</td>
    `;
        tr.addEventListener('click', () => {
            // On ouvre le menu officer en transmettant l'ID Discord de l'agent
            window.location.href = `/menu-officier?userId=${item.id}`;
        });
        tableBody.appendChild(tr);
    });
}

function renderPagination() {
    paginationDiv.innerHTML = '';
    const totalPages = Math.ceil(filteredAgents.length / ITEMS_PER_PAGE);
    if (totalPages <= 1) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'pagination-wrapper';

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-nav';
    prevBtn.innerHTML = '‹ Précédent';
    prevBtn.disabled = currentPage === 1;
    prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTable(); renderPagination(); } });
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
        firstBtn.addEventListener('click', () => { currentPage = 1; renderTable(); renderPagination(); });
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
        btn.addEventListener('click', () => { currentPage = i; renderTable(); renderPagination(); });
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
        lastBtn.addEventListener('click', () => { currentPage = totalPages; renderTable(); renderPagination(); });
        wrapper.appendChild(lastBtn);
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-nav';
    nextBtn.innerHTML = 'Suivant ›';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderTable(); renderPagination(); } });
    wrapper.appendChild(nextBtn);

    paginationDiv.appendChild(wrapper);
}

searchInput.addEventListener('input', applyFilters);

loadAgents();
