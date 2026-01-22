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

        const wrapper = document.createElement('div');
        wrapper.className = 'pagination-wrapper';

        // Bouton précédent
        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-nav';
        prevBtn.innerHTML = '‹ Précédent';
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) { currentPage--; loadReports(); }
        });
        wrapper.appendChild(prevBtn);

        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
        if (endPage - startPage < maxPagesToShow - 1) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        if (startPage > 1) {
            const firstBtn = document.createElement('button');
            firstBtn.textContent = '1';
            firstBtn.addEventListener('click', () => { currentPage = 1; loadReports(); });
            wrapper.appendChild(firstBtn);
            if (startPage > 2) {
                const dots = document.createElement('span');
                dots.className = 'page-ellipsis';
                dots.textContent = '···';
                wrapper.appendChild(dots);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            if (i === currentPage) btn.classList.add('active');
            btn.addEventListener('click', () => { currentPage = i; loadReports(); });
            wrapper.appendChild(btn);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const dots = document.createElement('span');
                dots.className = 'page-ellipsis';
                dots.textContent = '···';
                wrapper.appendChild(dots);
            }
            const lastBtn = document.createElement('button');
            lastBtn.textContent = totalPages;
            lastBtn.addEventListener('click', () => { currentPage = totalPages; loadReports(); });
            wrapper.appendChild(lastBtn);
        }

        // Bouton suivant
        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-nav';
        nextBtn.innerHTML = 'Suivant ›';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) { currentPage++; loadReports(); }
        });
        wrapper.appendChild(nextBtn);

        paginationContainer.appendChild(wrapper);
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
