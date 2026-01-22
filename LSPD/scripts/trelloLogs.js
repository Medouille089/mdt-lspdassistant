let currentPage = 1;
let currentTypeFilter = '';
let currentMemberFilter = '';
let currentSearch = '';
let searchTimeout = null;
let socket = null;
let preloadedPages = new Map(); // Cache pour les pages préchargées

// Initialiser Socket.IO pour les mises à jour en temps réel
function initSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('✅ WebSocket connecté');
    });
    
    socket.on('trelloLog', (newLog) => {
        console.log('📡 Nouveau log reçu:', newLog);
        // Si on est sur la page 1 et sans filtre, ajouter le log en haut
        if (currentPage === 1 && !currentTypeFilter && !currentMemberFilter && !currentSearch) {
            prependNewLog(newLog);
        }
    });
    
    socket.on('disconnect', () => {
        console.warn('⚠️  WebSocket déconnecté');
    });
}

// Ajouter un nouveau log en haut de la liste
function prependNewLog(log) {
    const logsContent = document.getElementById('logsContent');
    const firstLog = logsContent.querySelector('.log-entry');
    
    const newLogElement = document.createElement('div');
    newLogElement.innerHTML = renderLogEntry(log);
    newLogElement.classList.add('log-entry-new'); // Pour animation
    
    if (firstLog) {
        logsContent.insertBefore(newLogElement.firstElementChild, firstLog);
    } else {
        logsContent.innerHTML = newLogElement.innerHTML;
    }
    
    // Animation d'apparition
    setTimeout(() => {
        const element = logsContent.querySelector('.log-entry-new');
        if (element) element.classList.remove('log-entry-new');
    }, 1000);
}

// Charger les logs au démarrage
document.addEventListener('DOMContentLoaded', () => {
    initSocket();
    loadMembers();
    loadLogs();
    
    // Barre de recherche avec debounce
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearch = e.target.value;
            currentPage = 1;
            preloadedPages.clear(); // Vider le cache
            loadLogs();
        }, 500); // Attendre 500ms après la dernière frappe
    });
    
    // Filtres
    document.getElementById('memberFilter').addEventListener('change', (e) => {
        currentMemberFilter = e.target.value;
        currentPage = 1;
        preloadedPages.clear();
        loadLogs();
    });
    
    document.getElementById('typeFilter').addEventListener('change', (e) => {
        currentTypeFilter = e.target.value;
        currentPage = 1;
        preloadedPages.clear();
        loadLogs();
    });
});

async function loadMembers() {
    try {
        const response = await fetch('/api/trello/logs/members');
        if (!response.ok) {
            console.error('Erreur fetch membres:', response.status);
            return;
        }
        
        const data = await response.json();
        console.log('Membres reçus:', data);
        const memberFilter = document.getElementById('memberFilter');
        
        if (!data.members || data.members.length === 0) {
            console.warn('Aucun membre reçu du serveur');
            return;
        }
        
        data.members.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.displayName;
            memberFilter.appendChild(option);
        });
        
        console.log(`✅ ${data.members.length} membres ajoutés au select`);
    } catch (error) {
        console.error('Erreur chargement membres:', error);
    }
}

async function loadLogs(page = currentPage, useCache = true) {
    // Vérifier si la page est en cache
    if (useCache && preloadedPages.has(page)) {
        const cachedData = preloadedPages.get(page);
        displayLogs(cachedData);
        return;
    }
    
    const logsContent = document.getElementById('logsContent');
    const pagination = document.getElementById('pagination');
    
    // Afficher le loader seulement pour la page courante
    if (page === currentPage) {
        logsContent.innerHTML = '<div class="loading">Chargement des logs...</div>';
    }
    
    try {
        const params = new URLSearchParams({
            page: page,
            limit: 50
        });
        
        if (currentTypeFilter) {
            params.append('type', currentTypeFilter);
        }
        
        if (currentMemberFilter) {
            params.append('user_id', currentMemberFilter);
        }
        
        if (currentSearch) {
            params.append('search', currentSearch);
        }
        
        const response = await fetch(`/api/trello/logs?${params}`);
        if (!response.ok) throw new Error('Erreur chargement logs');
        
        const data = await response.json();
        
        // Mettre en cache
        preloadedPages.set(page, data);
        
        // Afficher seulement si c'est la page courante
        if (page === currentPage) {
            displayLogs(data);
        }
        
        // Précharger les pages suivantes en arrière-plan
        if (page === currentPage) {
            preloadNextPages(data.pagination);
        }
        
    } catch (error) {
        console.error('❌ Erreur:', error);
        if (page === currentPage) {
            logsContent.innerHTML = `
                <div class="empty-state">
                    <h3>Erreur</h3>
                    <p>Impossible de charger les logs. Veuillez réessayer.</p>
                </div>
            `;
        }
    }
}

// Afficher les logs à l'écran
function displayLogs(data) {
    const logsContent = document.getElementById('logsContent');
    const pagination = document.getElementById('pagination');
    
    if (!data || !data.logs) {
        console.error('❌ Données invalides:', data);
        return;
    }
    
    if (data.logs.length === 0) {
        logsContent.innerHTML = `
            <div class="empty-state">
                <h3>Aucun log trouvé</h3>
                <p>Aucune action n'a encore été enregistrée sur le Trello${currentSearch ? ' avec ce critère de recherche' : ''}.</p>
            </div>
        `;
        pagination.innerHTML = '';
        return;
    }
    
    // Afficher les logs
    logsContent.innerHTML = data.logs.map(log => renderLogEntry(log)).join('');
    
    // Mettre à jour la pagination
    renderPagination(data.pagination);
}

// Précharger les 2-3 pages suivantes en arrière-plan
async function preloadNextPages(paginationInfo) {
    const pagesToPreload = [];
    
    // Précharger page suivante et +2
    if (currentPage < paginationInfo.totalPages) {
        pagesToPreload.push(currentPage + 1);
    }
    if (currentPage + 1 < paginationInfo.totalPages) {
        pagesToPreload.push(currentPage + 2);
    }
    
    // Charger en parallèle sans attendre
    for (const page of pagesToPreload) {
        if (!preloadedPages.has(page)) {
            loadLogs(page, false).catch(err => {
                console.warn(`Échec préchargement page ${page}:`, err);
            });
        }
    }
}

function renderLogEntry(log) {
    const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
    const date = new Date(log.created_at);
    const dateStr = date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    let logClass = '';
    let badgeClass = 'create';
    if (log.log_type.includes('DELETE')) {
        logClass = 'delete';
        badgeClass = 'delete';
    } else if (log.log_type === 'RESET') {
        logClass = 'reset';
        badgeClass = 'reset';
    } else if (log.log_type.includes('UPDATE')) {
        badgeClass = 'update';
    } else if (log.log_type.includes('MOVE')) {
        badgeClass = 'move';
    }
    
    const title = getLogTitle(log.log_type);
    const initials = log.user_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    
    // Avatar avec photo si disponible
    let avatarHtml = '';
    if (log.photo_url) {
        avatarHtml = `<img src="${log.photo_url}" alt="${log.user_name}" onerror="this.style.display='none'; this.parentElement.textContent='${initials}';">`;
    } else {
        avatarHtml = initials;
    }
    
    return `
        <div class="log-entry ${logClass}">
            <div class="log-content">
                <div class="log-meta">
                    <div class="log-avatar">${avatarHtml}</div>
                    <div class="log-info">
                        <div class="log-user-line">
                            <span class="log-username">${log.user_name}</span>
                            <span class="log-timestamp">${dateStr}</span>
                        </div>
                        <span class="log-type-badge ${badgeClass}">${title}</span>
                    </div>
                </div>
                <div class="log-description">${log.action_description}</div>
                ${renderLogDetails(log.log_type, details)}
            </div>
        </div>
    `;
}

function getLogTitle(logType) {
    const titles = {
        'CREATE_CARD': 'Création de Card',
        'CREATE_LIST': 'Création de Liste',
        'UPDATE_CARD': 'Modification de Card',
        'UPDATE_LIST': 'Modification de Liste',
        'DELETE_CARD': 'Suppression de Card',
        'DELETE_LIST': 'Suppression de Liste',
        'MOVE_CARD': 'Mouvement de Card',
        'RESET': 'Réinitialisation du Trello'
    };
    return titles[logType] || logType;
}

function renderLogDetails(logType, details) {
    if (!details) return '';
    
    let html = '<div class="log-details">';
    
    // Informations communes
    if (details.cardName) {
        html += `<div class="log-detail-row"><span class="log-detail-label">Card:</span> <span class="log-detail-value">${details.cardName}</span></div>`;
    }
    if (details.listName) {
        html += `<div class="log-detail-row"><span class="log-detail-label">Liste:</span> <span class="log-detail-value">${details.listName}</span></div>`;
    }
    
    // Changements pour UPDATE
    if (details.changes && details.changes.length > 0) {
        details.changes.forEach(change => {
            html += `
                <div class="log-change">
                    <span class="log-detail-label">${change.field}:</span>
                    <span class="log-old-value">${change.oldValue}</span>
                    <span class="log-change-arrow">→</span>
                    <span class="log-new-value">${change.newValue}</span>
                </div>
            `;
        });
    }
    
    // Champs supplémentaires pour DELETE_CARD
    if (details.fields && details.fields.length > 0) {
        details.fields.forEach(field => {
            html += `<div class="log-detail-row"><span class="log-detail-label">${field.label}:</span> <span class="log-detail-value">${field.value}</span></div>`;
        });
    }
    
    // Cards supprimées pour DELETE_LIST
    if (details.cards && details.cards.length > 0) {
        html += `<div class="log-detail-row"><span class="log-detail-label">Cards supprimées (${details.cardCount}):</span></div>`;
        details.cards.slice(0, 5).forEach(card => {
            html += `<div class="log-detail-row" style="padding-left: 1rem;">• ${card.name}</div>`;
        });
        if (details.cards.length > 5) {
            html += `<div class="log-detail-row" style="padding-left: 1rem; font-style: italic;">... et ${details.cards.length - 5} autres</div>`;
        }
    }
    
    // Déplacement
    if (details.fromListName && details.toListName) {
        html += `<div class="log-detail-row"><span class="log-detail-label">De:</span> <span class="log-detail-value">${details.fromListName}</span></div>`;
        html += `<div class="log-detail-row"><span class="log-detail-label">Vers:</span> <span class="log-detail-value">${details.toListName}</span></div>`;
    }
    
    html += '</div>';
    return html;
}

// Pagination Amazon style
function renderPagination(paginationData) {
    const paginationDiv = document.getElementById('pagination');
    if (!paginationDiv) {
        console.error('Élément pagination introuvable');
        return;
    }

    paginationDiv.innerHTML = '';

    const { currentPage: page, totalPages, totalLogs } = paginationData;

    if (totalPages <= 1) {
        const info = document.createElement('div');
        info.style.textAlign = 'center';
        info.style.padding = '1rem';
        info.style.color = '#6b7280';
        info.style.fontSize = '0.9rem';
        info.textContent = `${totalLogs} log${totalLogs > 1 ? 's' : ''} au total`;
        paginationDiv.appendChild(info);
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'pagination-wrapper';

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-nav';
    prevBtn.innerHTML = '‹ Précédent';
    prevBtn.disabled = page === 1;
    prevBtn.addEventListener('click', () => {
        if (page > 1) {
            currentPage--;
            loadLogs();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    wrapper.appendChild(prevBtn);

    const maxButtons = 5;
    let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    // First page + ellipsis
    if (startPage > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.textContent = '1';
        firstBtn.addEventListener('click', () => {
            currentPage = 1;
            loadLogs();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
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
        if (i === page) btn.classList.add('active');
        btn.addEventListener('click', () => {
            currentPage = i;
            loadLogs();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
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
        lastBtn.addEventListener('click', () => {
            currentPage = totalPages;
            loadLogs();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        wrapper.appendChild(lastBtn);
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-nav';
    nextBtn.innerHTML = 'Suivant ›';
    nextBtn.disabled = page === totalPages;
    nextBtn.addEventListener('click', () => {
        if (page < totalPages) {
            currentPage++;
            loadLogs();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    wrapper.appendChild(nextBtn);

    paginationDiv.appendChild(wrapper);
}

(function () {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    const btn = document.getElementById("backlinkBtn");
    if (!btn) return;

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      if (window.history.length > 1) {
        window.history.back();
      } else {
      }
    });
  }
})();