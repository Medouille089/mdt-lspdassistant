document.addEventListener('DOMContentLoaded', async () => {
    let currentPage = 1;
    const limit = 20;
    let searchQuery = '';

    const searchInput = document.getElementById('searchInput');
    const tbody = document.getElementById('enquetesTableBody');
    const paginationInfo = document.getElementById('paginationInfo');
    const paginationControls = document.getElementById('paginationControls');
    const popover = document.getElementById('listPopover');
    const popoverTitle = document.getElementById('popoverTitle');
    const popoverList = document.getElementById('popoverList');

    // Mettre en cache les données des enquêtes pour les popovers
    const enquetesData = new Map();

    // Fermer le popover au clic ailleurs
    document.addEventListener('click', (e) => {
        if (popover && !popover.contains(e.target) && !e.target.closest('.count-badge')) {
            popover.style.display = 'none';
        }
    });

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
            const superviseur = (enquete.superviseur_prenom && enquete.superviseur_nom)
                ? `${enquete.superviseur_prenom} ${enquete.superviseur_nom}`
                : (enquete.superviseur_nom || enquete.superviseur_prenom || 'Superviseur inconnu');
            return `
                <tr onclick="window.location.href='/view-rapport-enquete?id=${enquete.id}'">
                    <td><strong style="color: var(--main-color); hover: underline;">${enquete.numero_dossier}</strong></td>
                    <td>${enquete.sujet}</td>
                    <td>${superviseur}</td>
                    <td style="text-align: center; position: relative;">
                        <span class="count-badge info" id="agentsCount-${enquete.id}" data-enquete="${enquete.id}" data-type="agents">
                            <i data-lucide="users"></i> ...
                        </span>
                    </td>
                    <td style="text-align: center; position: relative;">
                        <span class="count-badge warning" id="suspectsCount-${enquete.id}" data-enquete="${enquete.id}" data-type="suspects">
                            <i data-lucide="user-x"></i> ...
                        </span>
                    </td>
                    <td>${dateCreation}</td>
                    <td onclick="event.stopPropagation();" class="actions-cell">
                        <button class="btn-action edit" onclick="window.location.href='/rapport-enquete?edit=${enquete.id}'" title="Modifier">
                            <i data-lucide="pencil"></i>
                        </button>
                        <button class="btn-action delete" onclick="deleteEnquete(${enquete.id}, '${enquete.numero_dossier}')" title="Supprimer">
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

                enquetesData.set(String(enquete.id), data);
                
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

        setupPopoverBadges();
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
            <button ${page === 1 ? 'disabled' : ''} onclick="changePage(${page - 1})">
                <i data-lucide="chevron-left"></i>
            </button>
        `;

        // Pages
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) {
                html += `
                    <button class="${i === page ? 'active' : ''}" onclick="changePage(${i})">
                        ${i}
                    </button>
                `;
            } else if (i === page - 3 || i === page + 3) {
                html += `<span style="padding: 0 5px; color: var(--text-muted);">...</span>`;
            }
        }

        // Bouton suivant
        html += `
            <button ${page === totalPages ? 'disabled' : ''} onclick="changePage(${page + 1})">
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

    async function handleBadgeClick(event) {
        event.stopPropagation();
        const badge = event.currentTarget;
        const enqueteId = badge.getAttribute('data-enquete');
        const type = badge.getAttribute('data-type');
        if (!enqueteId || !type) return;

        const data = await fetchEnqueteData(enqueteId);
        if (!data) return;

        const items = type === 'agents'
            ? data.agents.map(agent => ({
                label: formatAgentLabel(agent),
                url: agent.agent_id ? `/infos-agent?userId=${agent.agent_id}` : null
            }))
            : data.suspects.map(suspect => ({
                label: formatSuspectLabel(suspect),
                url: suspect.citoyen_id ? `/view-citoyen?id=${suspect.citoyen_id}` : null
            }));

        const title = type === 'agents' ? 'Agents assignés' : 'Suspects associés';
        togglePopover(badge, title, items);
    }

    function setupPopoverBadges() {
        document.querySelectorAll('.count-badge').forEach(badge => {
            badge.addEventListener('click', handleBadgeClick);
        });
    }

    async function fetchEnqueteData(id) {
        const key = String(id);
        if (enquetesData.has(key)) {
            return enquetesData.get(key);
        }

        try {
            const res = await fetch(`/api/rapports-enquete/${id}`);
            if (!res.ok) return null;
            const data = await res.json();
            enquetesData.set(key, data);
            return data;
        } catch (error) {
            console.error('Erreur chargement détails enquête pour popover', error);
            return null;
        }
    }

    function formatAgentLabel(agent) {
        return agent.name || agent.nom_complet || `${agent.agent_prenom || agent.prenom || ''} ${agent.agent_nom || agent.nom || ''}`.trim() || 'Agent inconnu';
    }

    function formatSuspectLabel(suspect) {
        return `${suspect.citoyen_prenom || suspect.prenom || ''} ${suspect.citoyen_nom || suspect.nom || ''}`.trim() || 'Suspect inconnu';
    }

    function togglePopover(anchor, title, items) {
        if (!popover || !popoverList || !popoverTitle) return;
        const targetKey = `${anchor.getAttribute('data-type')}-${anchor.getAttribute('data-enquete')}`;
        const alreadyOpen = popover.dataset.openTarget === targetKey && popover.style.display === 'block';

        if (alreadyOpen) {
            popover.style.display = 'none';
            popover.dataset.openTarget = '';
            return;
        }

        popoverTitle.textContent = title;

        if (items.length === 0) {
            popoverList.innerHTML = `<li style="color: var(--text-muted);">Aucune entrée</li>`;
        } else {
            popoverList.innerHTML = items.map(item => `
                <li class="popover-item" data-url="${item.url || ''}">
                    <span>${item.label}</span>
                </li>
            `).join('');
        }

        popover.dataset.openTarget = targetKey;
        popover.style.display = 'block';

        const rect = anchor.getBoundingClientRect();
        popover.style.top = `${rect.bottom + window.scrollY + 8}px`;
        popover.style.left = `${Math.min(Math.max(rect.left + window.scrollX, 10), window.innerWidth - popover.offsetWidth - 10)}px`;

        popoverList.querySelectorAll('.popover-item').forEach(li => {
            li.addEventListener('click', () => {
                const url = li.getAttribute('data-url');
                if (url) {
                    window.location.href = url;
                }
            });
        });
    }

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
