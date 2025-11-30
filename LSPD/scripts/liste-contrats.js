let currentPage = 0;
const limit = 50;
let searchTerm = '';
let statutFilter = '';

async function loadContrats() {
    const loaderOverlay = document.getElementById('loaderOverlay');
    loaderOverlay.style.display = 'flex';

    try {
        const params = new URLSearchParams({
            limit: limit,
            offset: currentPage * limit,
            ...(searchTerm && { search: searchTerm }),
            ...(statutFilter && { statut: statutFilter })
        });

        const response = await fetch(`/api/contrats?${params}`);
        if (!response.ok) {
            throw new Error('Erreur lors du chargement des contrats');
        }

        const data = await response.json();
        displayContrats(data.contrats);
        updateStats(data.contrats);
        updatePagination(data.total);
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur lors du chargement des contrats');
    } finally {
        loaderOverlay.style.display = 'none';
    }
}

async function loadAllStats() {
    try {
        const response = await fetch('/api/contrats?limit=1000&offset=0');
        if (response.ok) {
            const data = await response.json();
            updateStats(data.contrats);
        }
    } catch (error) {
        console.error('Erreur lors du chargement des statistiques:', error);
    }
}

function updateStats(contrats) {
    document.getElementById('totalContrats').textContent = contrats.length;
    document.getElementById('contratsActifs').textContent = contrats.filter(c => c.statut === 'actif').length;
    document.getElementById('contratsResilies').textContent = contrats.filter(c => c.statut === 'resilie' || c.statut === 'Résilié').length;
    document.getElementById('contratsExpires').textContent = contrats.filter(c => c.statut === 'expire').length;
}

function displayContrats(contrats) {
    const tbody = document.getElementById('contratTableBody');
    tbody.innerHTML = '';

    if (contrats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px;">Aucun contrat trouvé</td></tr>';
        return;
    }

    contrats.forEach(contrat => {
        const tr = document.createElement('tr');

        const dateDebut = new Date(contrat.date_debut).toLocaleDateString('fr-FR');
        const dateFin = new Date(contrat.date_fin).toLocaleDateString('fr-FR');

        const statutBadge = getStatutBadge(contrat.statut);

        tr.innerHTML = `
            <td><strong>${contrat.numero_contrat}</strong></td>
            <td>${contrat.nom_entreprise}</td>
            <td>${contrat.representant_entreprise || '-'}</td>
            <td>${dateDebut}</td>
            <td>${dateFin}</td>
            <td>${contrat.duree_mois} mois</td>
            <td>${statutBadge}</td>
            <td>${contrat.officier_responsable}</td>
            <td>
                <button class="action-btn view-btn" onclick="viewContrat(${contrat.id})" title="Voir / Gérer">👁️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getStatutBadge(statut) {
    const labels = {
        'actif': 'Actif',
        'en_attente': 'En attente',
        'expire': 'Expiré',
        'Résilié': 'Résilié',
        'resilie': 'Résilié'
    };
    let cssClass = statut.toLowerCase();
    if (cssClass === 'résilié') cssClass = 'resilie';

    return `<span class="badge-statut ${cssClass}">${labels[statut] || statut}</span>`;
}

function updatePagination(total) {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(total / limit);

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';
    for (let i = 0; i < totalPages; i++) {
        const active = i === currentPage ? 'active' : '';
        html += `<button class="page-btn ${active}" onclick="changePage(${i})">${i + 1}</button>`;
    }
    pagination.innerHTML = html;
}

window.changePage = function (page) {
    currentPage = page;
    loadContrats();
};

window.editContrat = function (id) {
    window.location.href = `/contrat?id=${id}&mode=edit`;
};

window.viewContrat = function (id) {
    window.location.href = `/contrat?id=${id}&mode=view`;
};

window.deleteContrat = async function (id, numero) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le contrat ${numero} ?`)) {
        return;
    }

    const loaderOverlay = document.getElementById('loaderOverlay');
    loaderOverlay.style.display = 'flex';

    try {
        const response = await fetch(`/api/contrats/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la suppression');
        }

        alert('Contrat supprimé avec succès');
        loadContrats();
        loadAllStats();
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur lors de la suppression du contrat');
    } finally {
        loaderOverlay.style.display = 'none';
    }
};

// Event listeners
document.getElementById('searchInput').addEventListener('input', (e) => {
    searchTerm = e.target.value;
    currentPage = 0;
    loadContrats();
});

document.getElementById('statutFilter').addEventListener('change', (e) => {
    statutFilter = e.target.value;
    currentPage = 0;
    loadContrats();
});

// Chargement initial
document.addEventListener('DOMContentLoaded', () => {
    loadContrats();
    loadAllStats();
});
