class GenericSelectorModal {
    constructor(config) {
        this.config = config;
        this.selectedItems = []; // Liste des items sélectionnés
        this.modal = null;
        this.items = []; // Liste des items chargés depuis l'API
        this.filteredItems = [];
        this.isLoaded = false;

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
                            placeholder="${this.config.searchPlaceholder || 'Rechercher...'}"
                            autocomplete="off"
                        />
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
            this.filterItems(e.target.value);
        });
    }

    async open() {
        this.modal.style.display = 'flex';
        const searchInput = document.getElementById(`search-${this.uniqueId}`);
        searchInput.value = '';
        searchInput.focus();

        if (!this.isLoaded) {
            await this.loadItems();
        } else {
            this.filteredItems = [...this.items];
            this.renderList();
        }
    }

    close() {
        this.modal.style.display = 'none';
    }

    async loadItems() {
        const listContainer = document.getElementById(`list-${this.uniqueId}`);
        listContainer.innerHTML = '<div class="loading-spinner">Chargement...</div>';

        try {
            let data;
            // Support pour URL ou fonction qui retourne une promesse
            if (typeof this.config.apiEndpoint === 'function') {
                data = await this.config.apiEndpoint();
            } else {
                const res = await fetch(this.config.apiEndpoint);
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
            this.renderList();

        } catch (err) {
            console.error("Erreur chargement items:", err);
            listContainer.innerHTML = '<div class="error-msg">Erreur de chargement des données.</div>';
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
            grade: item.grade, // Pour les agents
            date_naissance: item.date_naissance // Pour les civils
        }));

        input.value = JSON.stringify(dataToSave);
    }
}

const GenericSelector = {
    open: function(options) {
        // options: type, apiEndpoint, title, searchPlaceholder, renderItem, onSelect
        
        // Create modal HTML
        const modalId = 'generic-selector-modal-' + Math.random().toString(36).substr(2, 9);
        const modalHTML = `
            <div id="${modalId}" class="selector-modal" style="display: flex;">
                <div class="selector-modal-content">
                    <div class="selector-modal-header">
                        <h2>${options.title || 'Sélectionner'}</h2>
                        <button class="selector-modal-close" onclick="document.getElementById('${modalId}').remove()">&times;</button>
                    </div>
                    <div class="selector-modal-body">
                        <input type="text" class="selector-search-input" placeholder="${options.searchPlaceholder || 'Rechercher...'}" autocomplete="off">
                        <div class="selector-list">
                            <div class="loading-spinner">Chargement...</div>
                        </div>
                    </div>
                    <div class="selector-modal-footer">
                        <button class="btn-secondary" onclick="document.getElementById('${modalId}').remove()">Annuler</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        const modal = document.getElementById(modalId);
        const listContainer = modal.querySelector('.selector-list');
        const searchInput = modal.querySelector('.selector-search-input');
        
        let items = [];
        
        // Load items
        const load = async () => {
            try {
                let data;
                let endpoint = options.apiEndpoint;
                
                if (!endpoint && options.type === 'citizen') endpoint = '/api/citoyens';
                if (!endpoint && options.type === 'officer') endpoint = '/api/officers';
                
                const res = await fetch(endpoint);
                if (!res.ok) throw new Error('Erreur réseau');
                const json = await res.json();
                
                if (options.type === 'citizen') items = json.citoyens || json;
                else items = json;
                
                render(items);
            } catch (e) {
                console.error(e);
                listContainer.innerHTML = '<div class="error-msg">Erreur de chargement</div>';
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
        
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = items.filter(item => {
                // Simple text search on the rendered content or properties
                const text = (options.renderItem ? divToText(options.renderItem(item)) : (item.nom || item.displayName || '')).toLowerCase();
                // Fallback to properties if renderItem is complex
                const props = (item.nom + ' ' + item.prenom + ' ' + item.displayName).toLowerCase();
                return text.includes(query) || props.includes(query);
            });
            render(filtered);
        });
        
        // Helper to strip HTML tags for search
        const divToText = (html) => {
            const tmp = document.createElement('DIV');
            tmp.innerHTML = html;
            return tmp.textContent || tmp.innerText || '';
        };
        
        load();
    }
};
