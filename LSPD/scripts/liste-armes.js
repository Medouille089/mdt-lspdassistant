// Script pour la page liste-armes.html
// Structure et logique identiques à liste-vehicules.js, adapté pour les armes

document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loaderOverlay');
    loader.style.display = 'flex';

    const armeTableBody = document.querySelector('#armeTable tbody');
    const totalArmesEl = document.getElementById('totalArmes');
    const totalModelesEl = document.getElementById('totalModeles');
    const searchInput = document.getElementById('searchInput');
    const modeleFilter = document.getElementById('modeleFilter');
    const paginationEl = document.getElementById('pagination');
    const addArmeBtn = document.getElementById('addArmeBtn');

    let armes = [];
    let modeles = [];
    let currentPage = 1;
    let pageSize = 20;
    let totalArmes = 0;
    let totalModeles = 0;

    // Fetch all weapon models for filter
    async function loadModeles() {
        try {
            const res = await fetch('/api/weapon_models');
            if (!res.ok) throw new Error('Erreur chargement modèles');
            const data = await res.json();
            modeles = data.models || [];
            modeleFilter.innerHTML = '<option value="">Tous les modèles</option>';
            modeles.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.model_name;
                modeleFilter.appendChild(opt);
            });
        } catch (e) {
            showNotification('Erreur chargement modèles', 'error');
        }
    }

    // Fetch armes
    async function loadArmes() {
        loader.style.display = 'flex';
        let url = `/api/weapons?limit=${pageSize}&offset=${(currentPage-1)*pageSize}`;
        const search = searchInput.value.trim();
        const modeleId = modeleFilter.value;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (modeleId) url += `&model_id=${modeleId}`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Erreur chargement armes');
            const data = await res.json();
            armes = data.weapons || [];
            totalArmes = data.total || armes.length;
            totalModeles = [...new Set(armes.map(a => a.model_id))].length;
            renderTable();
            renderPagination();
            totalArmesEl.textContent = totalArmes;
            totalModelesEl.textContent = totalModeles;
        } catch (e) {
            showNotification('Erreur chargement armes', 'error');
        } finally {
            loader.style.display = 'none';
        }
    }

    function renderTable() {
        armeTableBody.innerHTML = '';
        if (armes.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 5;
            td.style.textAlign = 'center';
            td.style.color = '#7f8c8d';
            td.textContent = 'Aucune arme trouvée.';
            tr.appendChild(td);
            armeTableBody.appendChild(tr);
            return;
        }
        armes.forEach(arme => {
            const tr = document.createElement('tr');
            // Photo
            const photoTd = document.createElement('td');
            photoTd.className = 'photo-cell';
            if (arme.model_image_url) {
                const img = document.createElement('img');
                img.src = arme.model_image_url;
                img.alt = arme.model_name || 'Arme';
                img.style.transform = 'scale(0.8)';
                img.style.objectFit = 'contain';
                img.style.margin = '0 4px';
                photoTd.style.verticalAlign = 'middle';
                photoTd.appendChild(img);
            } else {
                photoTd.classList.add('no-photo');
                photoTd.textContent = '🔫';
            }
            tr.appendChild(photoTd);
            // Modèle
            const modeleTd = document.createElement('td');
            modeleTd.textContent = arme.model_name || '-';
            tr.appendChild(modeleTd);
            // S/N
            const serialTd = document.createElement('td');
            const serialSpan = document.createElement('span');
            serialSpan.textContent = arme.serial_number || '-';
            serialSpan.style.background = '#22304a';
            serialSpan.style.color = '#fff';
            serialSpan.style.fontFamily = 'Consolas, monospace';
            serialSpan.style.padding = '4px 12px';
            serialSpan.style.borderRadius = '4px';
            serialTd.appendChild(serialSpan);
            tr.appendChild(serialTd);
            // Propriétaire
            const propTd = document.createElement('td');
            propTd.textContent = arme.owner_name || '-';
            tr.appendChild(propTd);
            // Date ajout
            const dateTd = document.createElement('td');
            dateTd.textContent = arme.created_at ? new Date(arme.created_at).toLocaleDateString('fr-FR') : '-';
            tr.appendChild(dateTd);
            // Redirection sur click
            tr.style.cursor = 'pointer';
            tr.addEventListener('click', () => {
                window.location.href = `/view-arme.html?id=${arme.id}`;
            });

            // Ajout du menu contextuel personnalisé pour copier le N° série
                        tr.addEventListener('contextmenu', function(e) {
                                e.preventDefault();
                                e.stopPropagation();
                                window.setExtraContextMenuItems([
                                    {
                                        label: 'Copier le N° série',
                                        action: () => {
                                            navigator.clipboard.writeText(arme.serial_number || '').then(() => {
                                                if (typeof showNotification === 'function') {
                                                    showNotification('N° série copié !', 'success');
                                                }
                                            });
                                        },
                                        id: 'copy-serial-item'
                                    }
                                ]);
                                if (typeof window.createContextMenu === 'function') {
                                    window.createContextMenu(e.clientX, e.clientY);
                                }
                        });
                    // Remove extra menu items when clicking elsewhere (cleanup)
                    document.addEventListener('click', () => {
                        window.setExtraContextMenuItems([]);
                    });
            armeTableBody.appendChild(tr);
        });
    }

    function renderPagination() {
        paginationEl.innerHTML = '';
        const totalPages = Math.ceil(totalArmes / pageSize);
        if (totalPages <= 1) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'pagination-wrapper';

        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-nav';
        prevBtn.innerHTML = '‹ Précédent';
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) { currentPage--; loadArmes(); }
        });
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
            firstBtn.addEventListener('click', () => { currentPage = 1; loadArmes(); });
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
            btn.addEventListener('click', () => { currentPage = i; loadArmes(); });
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
            lastBtn.addEventListener('click', () => { currentPage = totalPages; loadArmes(); });
            wrapper.appendChild(lastBtn);
        }

        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-nav';
        nextBtn.innerHTML = 'Suivant ›';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) { currentPage++; loadArmes(); }
        });
        wrapper.appendChild(nextBtn);

        paginationEl.appendChild(wrapper);
    }

    searchInput.addEventListener('input', () => {
        currentPage = 1;
        loadArmes();
    });
    modeleFilter.addEventListener('change', () => {
        currentPage = 1;
        loadArmes();
    });
    addArmeBtn.addEventListener('click', () => {
        window.location.href = '/arme.html';
    });

    loadModeles();
    loadArmes();

    // Ajout du menu contextuel custom pour copier le N° série
    document.addEventListener('DOMContentLoaded', () => {
        let lastSerialToCopy = null;
        armeTableBody.addEventListener('contextmenu', function(e) {
            let tr = e.target;
            while (tr && tr.tagName !== 'TR') tr = tr.parentElement;
            if (!tr) return;
            const serialTd = tr.querySelector('td:nth-child(3) span, td:nth-child(3)');
            if (!serialTd) return;
            lastSerialToCopy = serialTd.textContent.trim();
            if (window.createContextMenu) {
                const oldCreate = window.createContextMenu;
                window.createContextMenu = function(x, y) {
                    oldCreate(x, y);
                    const menu = document.querySelector('.context-menu');
                    if (menu && !menu.querySelector('.context-menu__item.copy-serial')) {
                        // Trouve le séparateur avant Imprimer
                        const items = Array.from(menu.children);
                        let insertBefore = null;
                        for (let i = items.length - 1; i >= 0; i--) {
                            if (items[i].classList.contains('context-menu__separator')) {
                                insertBefore = items[i];
                                break;
                            }
                        }
                        const item = document.createElement('div');
                        item.className = 'context-menu__item copy-serial';
                        item.textContent = 'Copier le N° série';
                        item.onclick = function(ev) {
                            ev.stopPropagation();
                            window.removeContextMenu && window.removeContextMenu();
                            if (lastSerialToCopy) {
                                navigator.clipboard.writeText(lastSerialToCopy).then(() => {
                                    showNotification('N° série copié !', 'success');
                                });
                            }
                        };
                        if (insertBefore) menu.insertBefore(item, insertBefore);
                        else menu.appendChild(item);
                    }
                };
            }
        });
    });
});
