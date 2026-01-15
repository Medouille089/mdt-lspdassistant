document.addEventListener('DOMContentLoaded', async () => {
    const searchInput = document.getElementById('searchInput');
    const dateStartInput = document.getElementById('dateStart');
    const dateEndInput = document.getElementById('dateEnd');
    const tableBody = document.querySelector('#reportsTable tbody');
    const paginationContainer = document.getElementById('pagination');
    const loader = document.getElementById('loaderOverlay');

    let currentPage = 1;
    let currentSearch = '';
    let currentDateStart = '';
    let currentDateEnd = '';
    let currentUser = null;

    // Charger l'utilisateur pour les permissions
    try {
        const res = await fetch('/api/user');
        currentUser = await res.json();
    } catch (e) {
        console.error("Erreur chargement user", e);
    }

    // Debounce search
    let timeout = null;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            currentSearch = e.target.value;
            currentPage = 1;
            loadReports();
        }, 300);
    });

    // Date filters
    dateStartInput.addEventListener('change', () => {
        currentDateStart = dateStartInput.value;
        currentPage = 1;
        loadReports();
    });

    dateEndInput.addEventListener('change', () => {
        currentDateEnd = dateEndInput.value;
        currentPage = 1;
        loadReports();
    });

    async function loadReports() {
        loader.style.display = 'flex';
        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit: 10,
                search: currentSearch
            });

            if (currentDateStart) {
                params.append('dateStart', currentDateStart);
            }
            if (currentDateEnd) {
                params.append('dateEnd', currentDateEnd);
            }

            const res = await fetch(`/api/rapports-interrogatoire?${params}`);
            if (!res.ok) throw new Error('Erreur chargement rapports');
            
            const data = await res.json();
            renderTable(data.reports);
            renderPagination(data.totalPages);

        } catch (err) {
            console.error(err);
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Erreur de chargement</td></tr>';
        } finally {
            loader.style.display = 'none';
        }
    }

    function renderTable(reports) {
        tableBody.innerHTML = '';
        if (reports.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Aucun rapport trouvé</td></tr>';
            return;
        }

        reports.forEach(report => {
            const tr = document.createElement('tr');
            
            // Format date
            const dateStr = new Date(report.date_interrogatoire).toLocaleDateString('fr-FR');
            const heureStr = report.heure_interrogatoire || '';

            // Citoyen
            const citoyenName = `${report.citoyen_prenom || ''} ${report.citoyen_nom || ''}`.trim() || 'Inconnu';

            // Droits cités
            const droitsCites = report.droits_cites ? '✓ Oui' : '✗ Non';

            tr.innerHTML = `
                <td>#${report.id}</td>
                <td>${dateStr} ${heureStr}</td>
                <td>${report.officier_redacteur || ''}</td>
                <td>${citoyenName}</td>
                <td>${droitsCites}</td>
                <td class="actions-cell">
                    <button class="btn-action edit" title="Modifier" data-id="${report.id}">
                        <i data-lucide="pencil"></i>
                    </button>
                    ${(currentUser && currentUser.isCommandStaff) ? `
                    <button class="btn-action delete" title="Supprimer" data-id="${report.id}">
                        <i data-lucide="trash-2"></i>
                    </button>` : ''}
                </td>
            `;

            // Make row clickable to view report
            tr.style.cursor = 'pointer';
            tr.addEventListener('click', (e) => {
                // Ignore if clicking on action buttons
                if (e.target.closest('.btn-action')) return;
                window.location.href = `/view-rapport-interrogatoire?id=${report.id}`;
            });

            tableBody.appendChild(tr);
        });

        // Refresh Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Attach edit listeners
        document.querySelectorAll('.btn-action.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                editReport(id);
            });
        });

        // Attach delete listeners
        document.querySelectorAll('.btn-action.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                deleteReport(id);
            });
        });
    }

    function renderPagination(totalPages) {
        paginationContainer.innerHTML = '';
        
        if (totalPages <= 1) return;

        // Bouton précédent
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '←';
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadReports();
            }
        });
        paginationContainer.appendChild(prevBtn);

        // Numéros de page
        for (let i = 1; i <= totalPages; i++) {
            // Afficher seulement quelques pages autour de la page courante
            if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                const pageBtn = document.createElement('button');
                pageBtn.textContent = i;
                pageBtn.classList.toggle('active', i === currentPage);
                pageBtn.addEventListener('click', () => {
                    currentPage = i;
                    loadReports();
                });
                paginationContainer.appendChild(pageBtn);
            } else if (i === currentPage - 3 || i === currentPage + 3) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.style.padding = '0 10px';
                paginationContainer.appendChild(ellipsis);
            }
        }

        // Bouton suivant
        const nextBtn = document.createElement('button');
        nextBtn.textContent = '→';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadReports();
            }
        });
        paginationContainer.appendChild(nextBtn);
    }

    function editReport(id) {
        window.location.href = `/rapport-interrogatoire?edit=${id}`;
    }

    async function deleteReport(id) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce rapport ?')) {
            return;
        }

        loader.style.display = 'flex';
        try {
            const res = await fetch(`/api/rapports-interrogatoire/${id}`, {
                method: 'DELETE'
            });

            if (!res.ok) throw new Error('Erreur suppression rapport');

            showNotification('Rapport supprimé avec succès', 'success');
            loadReports();

        } catch (err) {
            console.error(err);
            showNotification('Erreur lors de la suppression', 'error');
        } finally {
            loader.style.display = 'none';
        }
    }

    // Charger les rapports au démarrage
    loadReports();
});
