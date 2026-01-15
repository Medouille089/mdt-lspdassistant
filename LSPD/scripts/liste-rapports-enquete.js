document.addEventListener('DOMContentLoaded', async () => {
    let currentPage = 1;
    const limit = 20;
    let searchQuery = '';

    const searchInput = document.getElementById('searchInput');
    const tbody = document.getElementById('enquetesTableBody');
    const paginationInfo = document.getElementById('paginationInfo');
    const paginationControls = document.getElementById('paginationControls');

    // Initialiser Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }

    // Recherche avec debounce
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchQuery = e.target.value;
                currentPage = 1;
                loadEnquetes();
            }, 300);
        });
    }

    async function loadEnquetes() {
        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit,
                search: searchQuery
            });

            const res = await fetch(`/api/rapports-enquete?${params}`);
            if (!res.ok) throw new Error('Erreur lors du chargement des enquêtes');

            const data = await res.json();
            renderEnquetes(data.enquetes);
            renderPagination(data);

        } catch (error) {
            console.error('Erreur:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: #e74c3c;">
                        Erreur lors du chargement des enquêtes
                    </td>
                </tr>
            `;
        }
    }

    function renderEnquetes(enquetes) {
        if (enquetes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
                        Aucune enquête trouvée
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = enquetes.map(enquete => {
            const dateCreation = new Date(enquete.created_at).toLocaleDateString('fr-FR');
            const superviseur = enquete.superviseur_prenom && enquete.superviseur_nom
                ? `${enquete.superviseur_prenom} ${enquete.superviseur_nom}`
                : 'Non assigné';

            return `
                <tr onclick="window.location.href='/view-rapport-enquete?id=${enquete.id}'" style="cursor: pointer;">
                    <td><strong style="color: var(--lspd-blue);">${enquete.numero_dossier}</strong></td>
                    <td>${enquete.sujet}</td>
                    <td>${superviseur}</td>
                    <td style="text-align: center;">
                        <span class="badge-info" id="agentsCount-${enquete.id}">
                            <i data-lucide="users"></i> ...
                        </span>
                    </td>
                    <td style="text-align: center;">
                        <span class="badge-warning" id="suspectsCount-${enquete.id}">
                            <i data-lucide="user-x"></i> ...
                        </span>
                    </td>
                    <td>${dateCreation}</td>
                    <td onclick="event.stopPropagation();" style="text-align: center;">
                        <button class="btn-icon btn-edit" onclick="window.location.href='/rapport-enquete?edit=${enquete.id}'" title="Modifier">
                            <i data-lucide="edit"></i>
                        </button>
                        <button class="btn-icon btn-delete" onclick="deleteEnquete(${enquete.id}, '${enquete.numero_dossier}')" title="Supprimer">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Charger les compteurs d'agents et suspects pour chaque enquête
        enquetes.forEach(async (enquete) => {
            try {
                const res = await fetch(`/api/rapports-enquete/${enquete.id}`);
                const data = await res.json();
                
                const agentsCountEl = document.getElementById(`agentsCount-${enquete.id}`);
                const suspectsCountEl = document.getElementById(`suspectsCount-${enquete.id}`);
                
                if (agentsCountEl) {
                    agentsCountEl.innerHTML = `<i data-lucide="users"></i> ${data.agents.length}`;
                }
                if (suspectsCountEl) {
                    suspectsCountEl.innerHTML = `<i data-lucide="user-x"></i> ${data.suspects.length}`;
                }
                
                // Réinitialiser les icônes Lucide
                if (window.lucide) {
                    lucide.createIcons();
                }
            } catch (error) {
                console.error(`Erreur chargement détails enquête ${enquete.id}:`, error);
            }
        });

        // Réinitialiser les icônes Lucide
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    function renderPagination(data) {
        const { page, totalPages, total } = data;

        // Info
        const start = (page - 1) * limit + 1;
        const end = Math.min(page * limit, total);
        paginationInfo.textContent = `${start}-${end} sur ${total} enquête(s)`;

        // Contrôles
        if (totalPages <= 1) {
            paginationControls.innerHTML = '';
            return;
        }

        let html = '';

        // Bouton précédent
        html += `
            <button class="pagination-btn" ${page === 1 ? 'disabled' : ''} onclick="changePage(${page - 1})">
                <i data-lucide="chevron-left"></i>
            </button>
        `;

        // Pages
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
                html += `
                    <button class="pagination-btn ${i === page ? 'active' : ''}" onclick="changePage(${i})">
                        ${i}
                    </button>
                `;
            } else if (i === page - 3 || i === page + 3) {
                html += `<span style="padding: 0 5px;">...</span>`;
            }
        }

        // Bouton suivant
        html += `
            <button class="pagination-btn" ${page === totalPages ? 'disabled' : ''} onclick="changePage(${page + 1})">
                <i data-lucide="chevron-right"></i>
            </button>
        `;

        paginationControls.innerHTML = html;

        // Réinitialiser les icônes Lucide
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    window.changePage = function(page) {
        currentPage = page;
        loadEnquetes();
    };

    window.deleteEnquete = async function(id, numeroDossier) {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer l'enquête ${numeroDossier} ?\n\nCette action est irréversible et nécessite les permissions Command-Staff.`)) {
            return;
        }

        const loaderOverlay = document.getElementById('loaderOverlay');
        if (loaderOverlay) loaderOverlay.style.display = 'flex';

        try {
            const res = await fetch(`/api/rapports-enquete/${id}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Erreur lors de la suppression');
            }

            showNotification(`Enquête ${numeroDossier} supprimée avec succès`, 'success');
            loadEnquetes();

        } catch (error) {
            console.error('Erreur:', error);
            showNotification(error.message || 'Erreur lors de la suppression', 'error');
        } finally {
            if (loaderOverlay) loaderOverlay.style.display = 'none';
        }
    };

    // Chargement initial
    loadEnquetes();
});
