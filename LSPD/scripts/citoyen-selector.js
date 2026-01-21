/* Modal de sélection de citoyen - Composant réutilisable */

class CitoyenSelectorModal {
    constructor(options = {}) {
        this.modal = null;
        this.selectedCitoyenId = null;
        this.selectedCitoyenName = null;
        this.onSelectCallback = null;
        this.citoyens = [];
        this.searchTimeout = null;
        this.isLoading = false;
        this.showClearButton = options.showClearButton !== undefined ? options.showClearButton : true;
        this.uniqueId = options.uniqueId || 'default';
    }

    async init() {
        // Créer la structure HTML du modal
        this.createModalHTML();
        // Charger les citoyens initiaux (vide au départ)
        await this.loadCitoyens('');
        // Ajouter les event listeners
        this.attachEventListeners();
    }

    createModalHTML() {
        const modalHTML = `
      <div id="citoyenSelectorModal-${this.uniqueId}" class="citoyen-modal" style="display: none;">
        <div class="citoyen-modal-content">
          <div class="citoyen-modal-header">
            <h2>Sélectionner un citoyen</h2>
            <button class="citoyen-modal-close" id="closeCitoyenModal-${this.uniqueId}">&times;</button>
          </div>
          <div class="citoyen-modal-body">
            <input 
              type="text" 
              id="citoyenSearchInput-${this.uniqueId}" 
              class="citoyen-search-input" 
              placeholder="Rechercher par nom, prénom ou téléphone... (Minimum 2 caractères)"
              autocomplete="off"
            />
            <div id="citoyenListLoader-${this.uniqueId}" class="citoyen-list-loader" style="display: none; text-align: center; padding: 20px;">
              <div style="font-size: 14px; color: #666;">Recherche en cours...</div>
            </div>
            <div id="citoyenList-${this.uniqueId}" class="citoyen-list">
              <p class="no-results" style="color: #999; padding: 20px; text-align: center;">Commencez à taper pour rechercher un citoyen...</p>
            </div>
          </div>
          <div class="citoyen-modal-footer">
            ${this.showClearButton ? `<button id="clearCitoyenSelection-${this.uniqueId}" class="btn-secondary">Non Recensé</button>` : ''}
            <button id="confirmCitoyenSelection-${this.uniqueId}" class="btn-primary">Confirmer</button>
          </div>
        </div>
      </div>
    `;

        // Injecter dans le body s'il n'existe pas déjà
        if (!document.getElementById(`citoyenSelectorModal-${this.uniqueId}`)) {
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }

        this.modal = document.getElementById(`citoyenSelectorModal-${this.uniqueId}`);
    }

    async loadCitoyens(searchTerm = '') {
        try {
            this.isLoading = true;
            const loader = document.getElementById(`citoyenListLoader-${this.uniqueId}`);
            const listContainer = document.getElementById(`citoyenList-${this.uniqueId}`);
            
            if (loader) loader.style.display = 'block';
            
            // Ne charger que si on a au moins 2 caractères OU si on cherche à vider (pour réinitialiser)
            let url = '/api/citoyens?limit=50';
            
            if (searchTerm && searchTerm.trim().length >= 2) {
                url = `/api/citoyens?search=${encodeURIComponent(searchTerm.trim())}&limit=100`;
            } else if (searchTerm === '') {
                // Cas initial : on affiche un message, pas de requête
                listContainer.innerHTML = '<p class="no-results" style="color: #999; padding: 20px; text-align: center;">Commencez à taper pour rechercher un citoyen...</p>';
                if (loader) loader.style.display = 'none';
                this.isLoading = false;
                this.citoyens = [];
                return;
            } else {
                // Moins de 2 caractères
                listContainer.innerHTML = '<p class="no-results" style="color: #999; padding: 20px; text-align: center;">Tapez au moins 2 caractères...</p>';
                if (loader) loader.style.display = 'none';
                this.isLoading = false;
                this.citoyens = [];
                return;
            }
            
            const res = await fetch(url);
            if (!res.ok) throw new Error('Erreur chargement citoyens');
            const data = await res.json();
            this.citoyens = data.citoyens || [];
            
            if (loader) loader.style.display = 'none';
            this.renderCitoyenList();
            this.isLoading = false;
        } catch (error) {
            console.error('Erreur lors du chargement des citoyens:', error);
            showNotification('Erreur lors du chargement des citoyens', 'error');
            const loader = document.getElementById('citoyenListLoader');
            if (loader) loader.style.display = 'none';
            this.isLoading = false;
        }
    }

    renderCitoyenList() {
        const listContainer = document.getElementById(`citoyenList-${this.uniqueId}`);
        listContainer.innerHTML = '';

        if (this.citoyens.length === 0) {
            listContainer.innerHTML = '<p class="no-results">Aucun citoyen trouvé</p>';
            return;
        }

        this.citoyens.forEach(citoyen => {
            const item = document.createElement('div');
            item.className = 'citoyen-list-item';
            if (this.selectedCitoyenId === citoyen.id) {
                item.classList.add('selected');
            }

            const age = this.calculateAge(citoyen.date_naissance);
            const photoHTML = citoyen.photo
                ? `<img src="${citoyen.photo}" alt="${citoyen.nom}" class="citoyen-avatar">`
                : `<div class="citoyen-avatar no-photo">👤</div>`;

            item.innerHTML = `
        ${photoHTML}
        <div class="citoyen-info">
          <div class="citoyen-name">${citoyen.nom} ${citoyen.prenom}</div>
          <div class="citoyen-details">
            ${age} ans • ${citoyen.nationalite}
            ${citoyen.telephone ? ` • ${this.formatPhone(citoyen.telephone)}` : ''}
          </div>
        </div>
      `;

            item.addEventListener('click', () => {
                this.selectCitoyen(citoyen);
            });

            listContainer.appendChild(item);
        });
    }

    selectCitoyen(citoyen) {
        this.selectedCitoyenId = citoyen.id;
        this.selectedCitoyenName = `${citoyen.nom || ''} ${citoyen.prenom || ''}`.trim();

        // Mettre à jour l'affichage visuel
        document.querySelectorAll('.citoyen-list-item').forEach(item => {
            item.classList.remove('selected');
        });
        event.currentTarget.classList.add('selected');
    }

    calculateAge(dateStr) {
        if (!dateStr) return '';
        const birthDate = new Date(dateStr);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }

    formatPhone(phone) {
        if (!phone) return '';
        // Extraire uniquement les chiffres
        const digits = phone.replace(/\D/g, '');
        // Format: 555-XXXX (3 premiers chiffres - 4 derniers chiffres)
        if (digits.length >= 7) {
            return `${digits.slice(0, 3)}-${digits.slice(3, 7)}`;
        }
        return phone; // Retourner le numéro original si format incorrect
    }

    async searchCitoyens(searchTerm) {
        // Debounce : attendre 300ms après la dernière frappe
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        this.searchTimeout = setTimeout(async () => {
            await this.loadCitoyens(searchTerm);
        }, 300);
    }

    attachEventListeners() {
        const closeBtn = document.getElementById(`closeCitoyenModal-${this.uniqueId}`);
        const confirmBtn = document.getElementById(`confirmCitoyenSelection-${this.uniqueId}`);
        const clearBtn = document.getElementById(`clearCitoyenSelection-${this.uniqueId}`);
        const searchInput = document.getElementById(`citoyenSearchInput-${this.uniqueId}`);

        // Fermer le modal
        closeBtn.addEventListener('click', () => this.close());

        // Fermer si on clique en dehors
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Confirmer la sélection
        confirmBtn.addEventListener('click', () => {
            if (this.selectedCitoyenId && this.onSelectCallback) {
                const citoyen = this.citoyens.find(c => c.id === this.selectedCitoyenId);
                console.log('Sélection confirmée:', citoyen);
                if (citoyen) {
                    this.onSelectCallback(citoyen.id, `${citoyen.nom || ''} ${citoyen.prenom || ''}`.trim(), citoyen);
                } else {
                    showNotification('Erreur: citoyen non trouvé', 'error');
                    return;
                }
            } else {
                //showNotification('Veuillez sélectionner un citoyen', 'warning');
                return;
            }
            this.close();
        });

        // Effacer la sélection (aucun propriétaire) - seulement si le bouton existe
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (this.onSelectCallback) {
                    this.onSelectCallback(null, null, null);
                }
                this.close();
            });
        }

        // Recherche
        searchInput.addEventListener('input', (e) => {
            this.searchCitoyens(e.target.value);
        });

        // Fermer avec Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.style.display === 'flex') {
                this.close();
            }
        });
    }

    open(onSelectCallback, currentCitoyenId = null) {
        this.onSelectCallback = onSelectCallback;
        this.selectedCitoyenId = currentCitoyenId;
        this.selectedCitoyenName = null;

        // Réinitialiser la recherche
        document.getElementById(`citoyenSearchInput-${this.uniqueId}`).value = '';
        this.citoyens = [];
        
        // Afficher le message initial
        const listContainer = document.getElementById(`citoyenList-${this.uniqueId}`);
        if (listContainer) {
            listContainer.innerHTML = '<p class="no-results" style="color: #999; padding: 20px; text-align: center;">Commencez à taper pour rechercher un citoyen...</p>';
        }

        this.modal.style.display = 'flex';
    }

    close() {
        this.modal.style.display = 'none';
        this.selectedCitoyenId = null;
        this.selectedCitoyenName = null;
    }
}

// Instances globales
let citoyenSelector = null; // Avec bouton "Aucun propriétaire"
let citoyenSelectorNoClear = null; // Sans bouton "Aucun propriétaire"

// Initialiser les sélecteurs au chargement de la page
document.addEventListener('DOMContentLoaded', async () => {
    citoyenSelector = new CitoyenSelectorModal({ showClearButton: true });
    await citoyenSelector.init();
    
    citoyenSelectorNoClear = new CitoyenSelectorModal({ showClearButton: false });
    await citoyenSelectorNoClear.init();
});

// Fonction helper pour ouvrir le sélecteur de citoyen (sans bouton "Aucun propriétaire")
function openCitoyenSelector(callback, currentCitoyenId = null) {
    if (citoyenSelectorNoClear) {
        citoyenSelectorNoClear.open(callback, currentCitoyenId);
    } else {
        console.error('Le sélecteur de citoyen n\'est pas encore initialisé');
    }
}

// Fonction helper pour ouvrir le sélecteur de citoyen (avec bouton "Aucun propriétaire")
function openCitoyenSelectorWithClear(callback, currentCitoyenId = null) {
    if (citoyenSelector) {
        citoyenSelector.open(callback, currentCitoyenId);
    } else {
        console.error('Le sélecteur de citoyen n\'est pas encore initialisé');
    }
}
