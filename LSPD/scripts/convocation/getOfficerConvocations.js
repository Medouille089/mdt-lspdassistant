// Script pour afficher les convocations reçues par l'agent connecté
// À placer dans scripts/convocation/getOfficerConvocations.js

const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get('userId');
const API_URL = `/api/officer/convocations?userId=${userId}`;
const tableBody = document.querySelector('#convocationsTable tbody');
const paginationDiv = document.getElementById('pagination');
const ITEMS_PER_PAGE = 10;
let convocations = [];
let currentPage = 1;

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR');
}

async function loadConvocations() {
    const loader = document.getElementById('loaderOverlay');
    loader.style.display = 'flex';
    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error('Erreur chargement');
        convocations = await res.json();
        renderTable();
        renderPagination();
    } catch (e) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#f66;">Erreur de chargement.</td></tr>`;
        console.error(e);
    } finally {
        loader.style.display = 'none';
    }
}

function renderTable() {
    tableBody.innerHTML = '';
    if (convocations.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Aucune convocation reçue.</td></tr>`;
        return;
    }
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageItems = convocations.slice(start, end);
    pageItems.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.id}</td>
            <td>${item.agent_convoquant_nom || 'Non précisé'}</td>
            <td>${item.agent_convoquant_grade || 'Non précisé'}</td>
            <td>${formatDate(item.date)}</td>
            <td>${item.lieu || 'Non précisé'}</td>
        `;
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => {
            window.location.href = `/viewConvocationAgent?id=${item.id}`;
        });
        tableBody.appendChild(tr);
    });
}

function renderPagination() {
    const totalPages = Math.ceil(convocations.length / ITEMS_PER_PAGE);
    paginationDiv.innerHTML = '';
    if (totalPages <= 1) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'pagination-wrapper';

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-nav';
    prevBtn.innerHTML = '‹ Précédent';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderTable(); renderPagination(); } };
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
    nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderTable(); renderPagination(); } };
    wrapper.appendChild(nextBtn);

    paginationDiv.appendChild(wrapper);
}

document.addEventListener('DOMContentLoaded', () => {
    loadConvocations();
});
