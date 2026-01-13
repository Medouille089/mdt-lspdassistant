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

            const res = await fetch(`/api/rapports-arrestation?${params}`);
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
            const dateObj = new Date(report.date_arrestation);
            const dateStr = dateObj.toLocaleDateString('fr-FR') + ' ' + dateObj.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});

            // Suspects formatting
            let suspects = 'Aucun';
            try {
                const suspArr = typeof report.suspects_impliques === 'string' ? JSON.parse(report.suspects_impliques) : report.suspects_impliques;
                if (suspArr && suspArr.length > 0) {
                    suspects = suspArr.map(s => s.name).join(', ');
                }
            } catch (e) {}

            // Tags formatting
            let tagsHtml = '<div class="mini-tags">';
            if (report.tags && report.tags.length > 0) {
                report.tags.forEach(tag => {
                    tagsHtml += `<span class="mini-tag-pill" style="background-color: ${tag.color}" title="${tag.name}">${tag.name}</span>`;
                });
            }
            tagsHtml += '</div>';

            tr.innerHTML = `
                <td>#${report.id}</td>
                <td>${dateStr}</td>
                <td>${report.officier_redacteur}</td>
                <td>${suspects}</td>
                <td>${tagsHtml}</td>
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
                window.location.href = `/view-rapport-arrestation?id=${report.id}`;
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
                window.location.href = `/modifier-rapport-arrestation?id=${id}`;
            });
        });

        // Attach delete listeners
        document.querySelectorAll('.btn-action.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                if (confirm('Êtes-vous sûr de vouloir supprimer ce rapport ? Cette action est irréversible.')) {
                    deleteReport(id);
                }
            });
        });
    }

    async function deleteReport(id) {
        try {
            const res = await fetch(`/api/rapports-arrestation/${id}`, { method: 'DELETE' });
            if (res.ok) {
                loadReports();
            } else {
                alert('Erreur lors de la suppression');
            }
        } catch (e) {
            console.error(e);
            alert('Erreur serveur');
        }
    }

    function renderPagination(totalPages) {
        paginationContainer.innerHTML = '';
        if (totalPages <= 1) return;

        // Bouton précédent
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '‹';
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadReports();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
        paginationContainer.appendChild(prevBtn);

        // Afficher au maximum 5 pages
        const maxPagesToShow = 5;
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

        if (endPage - startPage < maxPagesToShow - 1) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            if (i === currentPage) {
                btn.classList.add('active');
            }
            btn.addEventListener('click', () => {
                currentPage = i;
                loadReports();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            paginationContainer.appendChild(btn);
        }

        // Bouton suivant
        const nextBtn = document.createElement('button');
        nextBtn.textContent = '›';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadReports();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
        paginationContainer.appendChild(nextBtn);
    }

    loadReports();
});
