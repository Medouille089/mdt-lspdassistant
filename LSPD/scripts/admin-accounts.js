let accountToDelete = null;
let allAccounts = [];
let filteredAccounts = [];
const ITEMS_PER_PAGE = 10;
let currentPage = 1;

async function loadAccounts() {
    const loader = document.getElementById('loaderOverlay');
    loader.style.display = 'flex';

    try {
        const response = await fetch('/api/accounts');

        if (response.status === 403) {
            const error = await response.json();
            const tbody = document.querySelector('#accountsTable tbody');
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px;">
                        <div style="color: #dc3545; font-size: 1.2rem; margin-bottom: 10px;">
                            🔒 Accès refusé
                        </div>
                        <div style="color: #666;">
                            ${error.error || 'Vous n\'avez pas les permissions nécessaires pour accéder à cette page.'}
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        if (!response.ok) {
            throw new Error('Erreur lors du chargement des comptes');
        }

        allAccounts = await response.json();
        filteredAccounts = [...allAccounts];
        currentPage = 1;
        displayAccounts();
    } catch (error) {
        console.error('Erreur:', error);
        const tbody = document.querySelector('#accountsTable tbody');
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #dc3545;">Erreur lors du chargement des comptes</td></tr>';
    } finally {
        loader.style.display = 'none';
    }
}

function displayAccounts() {
    const tbody = document.querySelector('#accountsTable tbody');

    if (filteredAccounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px;">Aucun compte trouvé</td></tr>';
        updatePagination();
        return;
    }

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageAccounts = filteredAccounts.slice(start, end);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    tbody.innerHTML = pageAccounts.map(account => {
        // Utiliser la photo_url de la table lspd_agent_profiles
        const defaultAvatar = 'https://media.istockphoto.com/id/1016744004/fr/vectoriel/image-despace-r%C3%A9serv%C3%A9-de-profil-gray-ne-silhouette-aucune-photo.jpg?s=612x612&w=0&k=20&c=7OLCKLuDpDHaXywnkaGuK-bKQS9lnivwYDYnGqD60bc=';
        const avatarUrl = account.photo_url || defaultAvatar;

        const createdDate = new Date(account.created_at).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const lastLoginDate = account.last_login ? new Date(account.last_login) : null;
        const lastLogin = lastLoginDate
            ? lastLoginDate.toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
            : 'Jamais';

        // Déterminer le statut basé sur la dernière connexion
        const isActive = lastLoginDate && lastLoginDate >= oneWeekAgo;
        const statusClass = isActive ? 'status-active' : 'status-inactive';
        const statusText = isActive ? 'Actif' : 'Inactif';

        return `
            <tr data-account-id="${account.id}" data-discord-id="${account.discord_id}">
                <td><img src="${avatarUrl}" alt="Avatar" class="avatar-img" onerror="this.src='https://media.istockphoto.com/id/1016744004/fr/vectoriel/image-despace-r%C3%A9serv%C3%A9-de-profil-gray-ne-silhouette-aucune-photo.jpg?s=612x612&w=0&k=20&c=7OLCKLuDpDHaXywnkaGuK-bKQS9lnivwYDYnGqD60bc='"></td>
                <td><strong>${escapeHtml(account.username)}</strong></td>
                <td>${escapeHtml(account.displayName || account.username)}</td>
                <td>${escapeHtml(account.discord_id)}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td class="date-cell">${createdDate}</td>
                <td class="date-cell">${lastLogin}</td>
                <td class="actions-cell">
                    <button class="btn-action delete" title="Supprimer" data-id="${account.id}" data-username="${escapeHtml(account.username)}">
                        <i data-lucide="trash-2"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Refresh Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Add click handlers on rows
    document.querySelectorAll('#accountsTable tbody tr').forEach(row => {
        row.addEventListener('click', (e) => {
            // Ignore clicks on action buttons
            if (e.target.closest('.actions-cell') || e.target.closest('.btn-action')) return;
            const discordId = row.dataset.discordId;
            window.location.href = `/infos-agent?userId=${discordId}`;
        });
    });

    // Add click handlers on delete buttons
    document.querySelectorAll('.btn-action.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const username = btn.dataset.username;
            confirmDelete(id, username);
        });
    });

    updatePagination();
}


function updatePagination() {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE);

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';

    // Bouton Précédent
    html += `<button ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">Précédent</button>`;

    // Numéros de page
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<button ${i === currentPage ? 'disabled' : ''} onclick="changePage(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += '<span>...</span>';
        }
    }

    // Bouton Suivant
    html += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">Suivant</button>`;

    pagination.innerHTML = html;
}

function changePage(page) {
    currentPage = page;
    displayAccounts();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(title, message, isSuccess = true) {
    document.getElementById('notificationTitle').textContent = title;
    document.getElementById('notificationMessage').textContent = message;

    // Changer la couleur du titre selon le type
    const titleEl = document.getElementById('notificationTitle');
    titleEl.style.color = isSuccess ? '#28a745' : '#dc3545';

    document.getElementById('notificationPopup').style.display = 'flex';
}

function confirmDelete(accountId, username) {
    accountToDelete = accountId;
    document.getElementById('confirmMessage').textContent =
        `Êtes-vous sûr de vouloir supprimer le compte de "${username}" ?`;
    document.getElementById('confirmPopup').style.display = 'flex';
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (!accountToDelete) return;

    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;
    btn.textContent = 'Suppression...';

    try {
        const response = await fetch(`/api/accounts/${accountToDelete}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (!response.ok) {
            // Fermer le popup de confirmation
            document.getElementById('confirmPopup').style.display = 'none';

            // Afficher l'erreur dans un popup
            showNotification('Erreur', data.error || 'Erreur lors de la suppression', false);
            return;
        }

        // Retirer le compte de la liste
        allAccounts = allAccounts.filter(acc => acc.id !== accountToDelete);
        filteredAccounts = filteredAccounts.filter(acc => acc.id !== accountToDelete);

        // Réafficher
        displayAccounts();

        // Fermer le popup de confirmation
        document.getElementById('confirmPopup').style.display = 'none';

        // Afficher le succès
        showNotification('Succès', 'Compte supprimé avec succès', true);

    } catch (error) {
        console.error('Erreur:', error);

        // Fermer le popup de confirmation
        document.getElementById('confirmPopup').style.display = 'none';

        // Afficher l'erreur
        showNotification('Erreur', error.message || 'Une erreur est survenue', false);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Supprimer';
        accountToDelete = null;
    }
});

document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
    document.getElementById('confirmPopup').style.display = 'none';
    accountToDelete = null;
});

document.getElementById('notificationOkBtn').addEventListener('click', () => {
    document.getElementById('notificationPopup').style.display = 'none';
});

// Bouton retour
const backlinkBtn = document.getElementById('backlinkBtn');
if (backlinkBtn) {
    backlinkBtn.addEventListener('click', () => {
        window.history.back();
    });
}

// Fonction pour appliquer les filtres de recherche, statut et date
function applyFilters() {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    const statusFilter = document.getElementById('statusFilter').value;
    const dateStart = document.getElementById('dateStart').value;
    const dateEnd = document.getElementById('dateEnd').value;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    filteredAccounts = allAccounts.filter(account => {
        // Filtre de recherche
        const textMatch = !search ||
            account.username.toLowerCase().includes(search) ||
            account.discord_id.toLowerCase().includes(search) ||
            (account.email && account.email.toLowerCase().includes(search));

        // Filtre de statut
        let statusMatch = true;
        if (statusFilter) {
            const lastLoginDate = account.last_login ? new Date(account.last_login) : null;
            const isActive = lastLoginDate && lastLoginDate >= oneWeekAgo;

            if (statusFilter === 'active') {
                statusMatch = isActive;
            } else if (statusFilter === 'inactive') {
                statusMatch = !isActive;
            }
        }

        // Filtre de date sur created_at
        let dateMatch = true;
        if (dateStart || dateEnd) {
            const accountDate = account.created_at ? account.created_at.split('T')[0] : null;
            if (accountDate) {
                const startOk = dateStart ? accountDate >= dateStart : true;
                const endOk = dateEnd ? accountDate <= dateEnd : true;
                dateMatch = startOk && endOk;
            } else {
                dateMatch = false;
            }
        }

        return textMatch && statusMatch && dateMatch;
    });

    currentPage = 1;
    displayAccounts();
}

// Recherche
document.getElementById('searchInput').addEventListener('input', applyFilters);

// Filtre de statut
document.getElementById('statusFilter').addEventListener('change', applyFilters);

// Filtres de dates
document.getElementById('dateStart').addEventListener('change', applyFilters);
document.getElementById('dateEnd').addEventListener('change', applyFilters);

// Charger les comptes au chargement de la page
loadAccounts();
