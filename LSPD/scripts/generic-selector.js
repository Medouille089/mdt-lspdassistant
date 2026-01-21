class GenericSelectorModal {
    constructor(config) {
        this.config = config;
        this.selectedItems = []; // Liste des items sélectionnés
        this.modal = null;
        this.items = []; // Liste des items chargés depuis l'API
        this.filteredItems = [];
        this.isLoaded = false;
        this.searchTimeout = null;
        this.isLoading = false;
        this.useServerSearch = false; // Détecté automatiquement

        this.init();
    }

    init() {
        this.createModalHTML();
        this.attachEventListeners();
        this.setupTrigger();
    }

    setupTrigger() {
        const triggerBtn = document.getElementById(this.config.triggerBtnId);
        if (triggerBtn) {
            triggerBtn.addEventListener('click', () => this.open());
        }
    }

    createModalHTML() {
        // Générer un ID unique pour ce modal basé sur le triggerBtnId ou un random
        this.uniqueId = this.config.triggerBtnId || Math.random().toString(36).substr(2, 9);
        const modalId = `modal-${this.uniqueId}`;
        
        // Si le modal existe déjà (cas de rechargement de page ou autre), on le supprime
        const existingModal = document.getElementById(modalId);
        if (existingModal) existingModal.remove();

        const modalHTML = `
            <div id="${modalId}" class="selector-modal" style="display: none;">
                <div class="selector-modal-content">
                    <div class="selector-modal-header">
                        <h2>${this.config.modalTitle || 'Sélectionner'}</h2>
                        <button class="selector-modal-close" id="close-${this.uniqueId}">&times;</button>
                    </div>
                    <div class="selector-modal-body">
                        <input 
                            type="text" 
                            id="search-${this.uniqueId}" 
                            class="selector-search-input" 
                            placeholder="${this.config.searchPlaceholder || 'Rechercher... (Minimum 2 caractères)'}"
                            autocomplete="off"
                        />
                        <div id="loader-${this.uniqueId}" class="selector-list-loader" style="display: none; text-align: center; padding: 20px; color: #666; font-size: 14px;">
                            Recherche en cours...
                        </div>
                        <div id="list-${this.uniqueId}" class="selector-list">
                            <!-- Liste injectée ici -->
                        </div>
                    </div>
                    <div class="selector-modal-footer">
                        <button id="cancel-${this.uniqueId}" class="btn-secondary">Annuler</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById(modalId);
    }

    attachEventListeners() {
        const closeBtn = document.getElementById(`close-${this.uniqueId}`);
        const cancelBtn = document.getElementById(`cancel-${this.uniqueId}`);
        const searchInput = document.getElementById(`search-${this.uniqueId}`);

        const closeAction = () => this.close();

        closeBtn.addEventListener('click', closeAction);
        cancelBtn.addEventListener('click', closeAction);
        
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) closeAction();
        });

        searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });
    }

    async open() {
        this.modal.style.display = 'flex';
        const searchInput = document.getElementById(`search-${this.uniqueId}`);
        searchInput.value = '';
        searchInput.focus();

        // Check if we should use server-side search (for /api/citoyens endpoint)
        this.detectServerSearch();

        if (this.useServerSearch) {
            // Server-side search mode: show prompt
            const listContainer = document.getElementById(`list-${this.uniqueId}`);
            listContainer.innerHTML = '<div class="no-results" style="color: #999; padding: 20px; text-align: center;">Commencez à taper pour rechercher...</div>';
        } else {
            // Client-side filter mode: load all items
            if (!this.isLoaded) {
                await this.loadItems();
            } else {
                this.filteredItems = [...this.items];
                this.renderList();
            }
        }
    }

    detectServerSearch() {
        // Detect if endpoint is /api/citoyens to use server-side search
        const endpoint = this.config.apiEndpoint;
        
        if (typeof endpoint === 'string') {
            this.useServerSearch = endpoint.includes('/api/citoyens');
        } else if (typeof endpoint === 'function') {
            // For async functions, check the URL in the function body (as string)
            const fnString = endpoint.toString();
            this.useServerSearch = fnString.includes('/api/citoyens');
        }
    }

    async handleSearch(query) {
        if (this.useServerSearch) {
            // Server-side search with debounce
            if (this.searchTimeout) clearTimeout(this.searchTimeout);
            
            this.searchTimeout = setTimeout(() => {
                this.loadItems(query);
            }, 300);
        } else {
            // Client-side filter
            this.filterItems(query);
        }
    }

    close() {
        this.modal.style.display = 'none';
    }

    async loadItems(searchTerm = '') {
        const listContainer = document.getElementById(`list-${this.uniqueId}`);
        const loader = document.getElementById(`loader-${this.uniqueId}`);
        
        if (this.useServerSearch) {
            // Server-side search mode
            if (searchTerm && searchTerm.trim().length < 2) {
                listContainer.innerHTML = '<div class="no-results" style="color: #999; padding: 20px; text-align: center;">Tapez au moins 2 caractères...</div>';
                if (loader) loader.style.display = 'none';
                this.items = [];
                this.isLoading = false;
                return;
            }
            
            if (!searchTerm || searchTerm.trim().length === 0) {
                listContainer.innerHTML = '<div class="no-results" style="color: #999; padding: 20px; text-align: center;">Commencez à taper pour rechercher...</div>';
                if (loader) loader.style.display = 'none';
                this.items = [];
                this.isLoading = false;
                return;
            }
        }
        
        if (loader) loader.style.display = 'block';
        if (!this.useServerSearch) {
            listContainer.innerHTML = '<div class="loading-spinner">Chargement...</div>';
        }

        try {
            this.isLoading = true;
            let data;
            
            // Support pour URL ou fonction qui retourne une promesse
            if (typeof this.config.apiEndpoint === 'function') {
                if (this.useServerSearch && searchTerm) {
                    // Inject search parameter if it's a citizen endpoint
                    data = await this.config.apiEndpoint();
                    
                    // Re-fetch with search parameter
                    const res = await fetch(`/api/citoyens?search=${encodeURIComponent(searchTerm.trim())}&limit=100`);
                    if (!res.ok) throw new Error('Erreur réseau');
                    data = await res.json();
                } else {
                    data = await this.config.apiEndpoint();
                }
            } else {
                let url = this.config.apiEndpoint;
                
                if (this.useServerSearch && searchTerm) {
                    // Add search parameter
                    url = `/api/citoyens?search=${encodeURIComponent(searchTerm.trim())}&limit=100`;
                }
                
                const res = await fetch(url);
                if (!res.ok) throw new Error('Erreur réseau');
                data = await res.json();
            }

            // Transformation des données si nécessaire
            if (this.config.transformData) {
                this.items = this.config.transformData(data);
            } else {
                this.items = Array.isArray(data) ? data : [];
            }

            this.filteredItems = [...this.items];
            this.isLoaded = true;
            if (loader) loader.style.display = 'none';
            this.renderList();
            this.isLoading = false;

        } catch (err) {
            console.error("Erreur chargement items:", err);
            listContainer.innerHTML = '<div class="error-msg">Erreur de chargement des données.</div>';
            if (loader) loader.style.display = 'none';
            this.isLoading = false;
        }
    }

    filterItems(query) {
        query = query.toLowerCase();
        if (!query) {
            this.filteredItems = [...this.items];
        } else {
            this.filteredItems = this.items.filter(item => {
                // Utiliser itemLabelKey si c'est une fonction pour filtrer sur le label affiché
                // Ou une logique custom de filtre
                const label = this.getItemLabel(item).toLowerCase();
                return label.includes(query);
            });
        }
        this.renderList();
    }

    getItemLabel(item) {
        if (typeof this.config.itemLabelKey === 'function') {
            return this.config.itemLabelKey(item);
        }
        return item[this.config.itemLabelKey] || 'Item sans nom';
    }

    getItemValue(item) {
        return item[this.config.itemValueKey] || item.id;
    }

    renderList() {
        const listContainer = document.getElementById(`list-${this.uniqueId}`);
        listContainer.innerHTML = '';

        if (this.filteredItems.length === 0) {
            listContainer.innerHTML = '<div class="no-results">Aucun résultat</div>';
            return;
        }

        this.filteredItems.forEach(item => {
            const div = document.createElement('div');
            div.className = 'selector-list-item';
            
            // Rendu custom ou par défaut
            if (this.config.renderItem) {
                div.innerHTML = this.config.renderItem(item);
            } else {
                div.textContent = this.getItemLabel(item);
            }

            div.addEventListener('click', () => {
                this.addItem(item);
                this.close();
            });

            listContainer.appendChild(div);
        });
    }

    addItem(item) {
        // Vérifier doublons
        const val = this.getItemValue(item);
        if (this.selectedItems.find(i => this.getItemValue(i) === val)) return;

        this.selectedItems.push(item);
        this.updateUI();
        this.updateHiddenInput();
    }

    removeItem(index) {
        this.selectedItems.splice(index, 1);
        this.updateUI();
        this.updateHiddenInput();
    }

    updateUI() {
        const container = document.getElementById(this.config.containerId);
        if (!container) return;

        container.innerHTML = '';
        this.selectedItems.forEach((item, index) => {
            const tag = document.createElement('div');
            tag.className = 'selected-item';
            
            const label = this.config.renderItem ? this.config.renderItem(item) : this.getItemLabel(item);
            // On nettoie le HTML pour l'affichage dans le tag si nécessaire, ou on garde simple
            // Pour simplifier, on prend juste le texte si c'est du HTML complexe, ou on affiche tel quel
            // Ici on va assumer que renderItem retourne du texte ou HTML simple inline
            
            tag.innerHTML = `<span>${label}</span>`;
            
            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = () => this.removeItem(index);
            
            tag.appendChild(removeBtn);
            container.appendChild(tag);
        });
    }

    updateHiddenInput() {
        const input = document.getElementById(this.config.hiddenInputId);
        if (!input) return;

        // On sauvegarde un tableau d'objets {id, name} ou juste les IDs selon besoin
        // Le backend attend probablement un JSON string
        const dataToSave = this.selectedItems.map(item => ({
            id: this.getItemValue(item),
            name: this.getItemLabel(item),
            // On peut ajouter d'autres champs si nécessaire
            date_naissance: item.date_naissance // Pour les civils
        }));

        input.value = JSON.stringify(dataToSave);
    }
}

const GenericSelector = {
    open: function(options) {
        // options: type, apiEndpoint, title, searchPlaceholder, renderItem, onSelect, allowUnregistered, onUnregistered
        
        // Create modal HTML
        const modalId = 'generic-selector-modal-' + Math.random().toString(36).substr(2, 9);
        const unregisteredBtn = options.allowUnregistered ? 
            `<button class="btn-unregistered" id="unregistered-${modalId}">Personne non recensée</button>` : '';
        
        const modalHTML = `
            <div id="${modalId}" class="selector-modal" style="display: flex;">
                <div class="selector-modal-content">
                    <div class="selector-modal-header">
                        <h2>${options.title || 'Sélectionner'}</h2>
                        <button class="selector-modal-close" onclick="document.getElementById('${modalId}').remove()">&times;</button>
                    </div>
                    <div class="selector-modal-body">
                        <input type="text" class="selector-search-input" placeholder="${options.searchPlaceholder || 'Rechercher... (Minimum 2 caractères)'}" autocomplete="off">
                        <div class="selector-list-loader" style="display: none; text-align: center; padding: 20px; color: #666; font-size: 14px;">
                            Recherche en cours...
                        </div>
                        <div class="selector-list">
                            <div class="no-results" style="color: #999; padding: 20px; text-align: center;">Commencez à taper pour rechercher...</div>
                        </div>
                    </div>
                    <div class="selector-modal-footer">
                        ${unregisteredBtn}
                        <button class="btn-secondary" onclick="document.getElementById('${modalId}').remove()">Annuler</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const modal = document.getElementById(modalId);
        const listContainer = modal.querySelector('.selector-list');
        const searchInput = modal.querySelector('.selector-search-input');
        const loader = modal.querySelector('.selector-list-loader');
        
        // Handle unregistered button
        if (options.allowUnregistered) {
            const unregBtn = document.getElementById(`unregistered-${modalId}`);
            if (unregBtn) {
                unregBtn.onclick = () => {
                    if (options.onUnregistered) options.onUnregistered();
                    modal.remove();
                };
            }
        }
        
        let items = [];
        let searchTimeout = null;
        let isLoading = false;
        
        // Load items with server-side search
        const load = async (searchTerm = '') => {
            try {
                isLoading = true;
                if (loader) loader.style.display = 'block';
                
                let endpoint = options.apiEndpoint;
                
                // Build endpoint with search parameter
                if (!endpoint && options.type === 'citizen') endpoint = '/api/citoyens';
                if (!endpoint && options.type === 'officer') endpoint = '/api/officers';
                
                // For citizens, use server-side search
                if (options.type === 'citizen') {
                    // Don't search if less than 2 characters
                    if (searchTerm && searchTerm.trim().length < 2) {
                        listContainer.innerHTML = '<div class="no-results" style="color: #999; padding: 20px; text-align: center;">Tapez au moins 2 caractères...</div>';
                        if (loader) loader.style.display = 'none';
                        isLoading = false;
                        items = [];
                        return;
                    }
                    
                    if (!searchTerm || searchTerm.trim().length === 0) {
                        listContainer.innerHTML = '<div class="no-results" style="color: #999; padding: 20px; text-align: center;">Commencez à taper pour rechercher...</div>';
                        if (loader) loader.style.display = 'none';
                        isLoading = false;
                        items = [];
                        return;
                    }
                    
                    // Use search parameter for server-side filtering
                    const searchParam = searchTerm ? `search=${encodeURIComponent(searchTerm.trim())}` : '';
                    endpoint = `/api/citoyens?${searchParam}&limit=100`;
                } else {
                    // For non-citizens, keep old logic (remove limit parameter if it exists in the URL)
                    // Actually, we should encourage server-side search for all types eventually
                    if (endpoint && endpoint.includes('?limit=')) {
                        // Remove the limit parameter and let the API use default or add search
                        endpoint = endpoint.replace(/[?&]limit=\d+/, '');
                    }
                }
                
                const res = await fetch(endpoint);
                if (!res.ok) throw new Error('Erreur réseau');
                const json = await res.json();
                
                if (options.type === 'citizen') items = json.citoyens || json;
                else items = json;
                
                if (loader) loader.style.display = 'none';
                render(items);
                isLoading = false;
            } catch (e) {
                console.error(e);
                listContainer.innerHTML = '<div class="error-msg">Erreur de chargement</div>';
                if (loader) loader.style.display = 'none';
                isLoading = false;
            }
        };
        
        const render = (list) => {
            listContainer.innerHTML = '';
            if (list.length === 0) {
                listContainer.innerHTML = '<div class="no-results">Aucun résultat</div>';
                return;
            }
            
            list.forEach(item => {
                const div = document.createElement('div');
                div.className = 'selector-list-item';
                
                if (options.renderItem) {
                    div.innerHTML = options.renderItem(item);
                } else if (options.type === 'citizen') {
                    div.textContent = `${item.nom} ${item.prenom} (${item.date_naissance})`;
                } else {
                    div.textContent = item.displayName || item.name || 'Item';
                }
                
                div.onclick = () => {
                    if (options.onSelect) options.onSelect(item);
                    modal.remove();
                };
                
                listContainer.appendChild(div);
            });
        };
        
        // Debounced search
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            
            if (searchTimeout) clearTimeout(searchTimeout);
            
            if (options.type === 'citizen') {
                // Server-side search with debounce
                searchTimeout = setTimeout(() => {
                    load(query);
                }, 300);
            } else {
                // Client-side filter (for backward compatibility)
                const filtered = items.filter(item => {
                    const text = (options.renderItem ? divToText(options.renderItem(item)) : (item.nom || item.displayName || '')).toLowerCase();
                    const props = (item.nom + ' ' + item.prenom + ' ' + item.displayName).toLowerCase();
                    return text.includes(query.toLowerCase()) || props.includes(query.toLowerCase());
                });
                render(filtered);
            }
        });
        
        // Helper to strip HTML tags for search
        const divToText = (html) => {
            const tmp = document.createElement('DIV');
            tmp.innerHTML = html;
            return tmp.textContent || tmp.innerText || '';
        };
        
        // Initial load (empty for citizens, showing prompt)
        if (options.type === 'citizen') {
            listContainer.innerHTML = '<div class="no-results" style="color: #999; padding: 20px; text-align: center;">Commencez à taper pour rechercher...</div>';
        } else {
            load();
        }
    }
};
// Helper function pour compatibilité avec l'ancien code
window.openGenericSelector = function(options) {
    // Créer un modal temporaire
    const modalId = 'temp-generic-modal-' + Date.now();
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal';
    modal.style.cssText = 'display: flex; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 10000; align-items: center; justify-content: center;';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.cssText = 'background: white; padding: 20px; border-radius: 8px; max-width: 600px; width: 90%; max-height: 80vh; display: flex; flex-direction: column;';
    
    const title = document.createElement('h2');
    title.textContent = options.title || 'Sélectionner';
    title.style.marginTop = '0';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = options.searchPlaceholder || 'Rechercher...';
    searchInput.style.cssText = 'width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px;';
    
    const loader = document.createElement('div');
    loader.textContent = 'Chargement...';
    loader.style.cssText = 'text-align: center; padding: 20px; display: none;';
    
    const listContainer = document.createElement('div');
    listContainer.style.cssText = 'flex: 1; overflow-y: auto; margin: 10px 0;';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Fermer';
    closeBtn.className = 'btn-secondary';
    closeBtn.style.cssText = 'padding: 10px 20px; cursor: pointer;';
    
    modalContent.appendChild(title);
    modalContent.appendChild(searchInput);
    modalContent.appendChild(loader);
    modalContent.appendChild(listContainer);
    modalContent.appendChild(closeBtn);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    const closeModal = () => {
        modal.remove();
    };
    
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    let items = [];
    let searchTimeout;
    let isLoading = false;
    
    const load = async (searchTerm = '') => {
        if (isLoading) return;
        
        isLoading = true;
        loader.style.display = 'block';
        listContainer.innerHTML = '';
        
        try {
            let endpoint = options.endpoint;
            
            // Ajouter paramètre de recherche si nécessaire
            if (searchTerm && searchTerm.trim().length >= 2) {
                const separator = endpoint.includes('?') ? '&' : '?';
                endpoint = `${endpoint}${separator}search=${encodeURIComponent(searchTerm.trim())}&limit=100`;
            } else {
                const separator = endpoint.includes('?') ? '&' : '?';
                endpoint = `${endpoint}${separator}limit=100`;
            }
            
            const res = await fetch(endpoint);
            if (!res.ok) throw new Error('Erreur réseau');
            const json = await res.json();
            
            // Extraire les items selon la structure de réponse
            items = json.officers || json.citoyens || json.agents || json.data || json;
            
            loader.style.display = 'none';
            render(items);
            isLoading = false;
        } catch (e) {
            console.error(e);
            listContainer.innerHTML = '<div style="color: #e74c3c; padding: 20px; text-align: center;">Erreur de chargement</div>';
            loader.style.display = 'none';
            isLoading = false;
        }
    };
    
    const render = (list) => {
        listContainer.innerHTML = '';
        
        if (list.length === 0) {
            listContainer.innerHTML = '<div style="color: #7f8c8d; padding: 20px; text-align: center;">Aucun résultat</div>';
            return;
        }
        
        list.forEach(item => {
            const div = document.createElement('div');
            div.style.cssText = 'padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.2s;';
            div.addEventListener('mouseenter', () => div.style.background = 'rgba(11, 27, 90, 0.05)');
            div.addEventListener('mouseleave', () => div.style.background = 'white');
            
            if (options.displayField) {
                if (typeof options.displayField === 'function') {
                    div.textContent = options.displayField(item);
                } else {
                    div.textContent = item[options.displayField] || 'Item';
                }
            } else {
                div.textContent = `${item.prenom || ''} ${item.nom || ''} ${item.grade || ''}`.trim() || 'Item';
            }
            
            div.onclick = () => {
                if (options.onSelect) options.onSelect(item);
                closeModal();
            };
            
            listContainer.appendChild(div);
        });
    };
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        
        if (searchTimeout) clearTimeout(searchTimeout);
        
        searchTimeout = setTimeout(() => {
            if (query.trim().length >= 2 || query.trim().length === 0) {
                load(query);
            }
        }, 300);
    });
    
    // Initial load
    load();
};