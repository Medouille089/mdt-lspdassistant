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
    if (currentPage > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '← Précédent';
        prevBtn.onclick = () => { currentPage--; renderTable(); renderPagination(); };
        paginationDiv.appendChild(prevBtn);
    }
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.className = i === currentPage ? 'active' : '';
        pageBtn.onclick = () => { currentPage = i; renderTable(); renderPagination(); };
        paginationDiv.appendChild(pageBtn);
    }
    if (currentPage < totalPages) {
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Suivant →';
        nextBtn.onclick = () => { currentPage++; renderTable(); renderPagination(); };
        paginationDiv.appendChild(nextBtn);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadConvocations();
});
