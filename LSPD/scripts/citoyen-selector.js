/* Modal de sélection de citoyen - Composant réutilisable */

class CitoyenSelectorModal {
    constructor() {
        this.modal = null;
        this.selectedCitoyenId = null;
        this.selectedCitoyenName = null;
        this.onSelectCallback = null;
        this.citoyens = [];
        this.filteredCitoyens = [];
    }

    async init() {
        // Créer la structure HTML du modal
        this.createModalHTML();
        // Charger les citoyens
        await this.loadCitoyens();
        // Ajouter les event listeners
        this.attachEventListeners();
    }

    createModalHTML() {
        const modalHTML = `
      <div id="citoyenSelectorModal" class="citoyen-modal" style="display: none;">
        <div class="citoyen-modal-content">
          <div class="citoyen-modal-header">
            <h2>Sélectionner un citoyen</h2>
            <button class="citoyen-modal-close" id="closeCitoyenModal">&times;</button>
          </div>
          <div class="citoyen-modal-body">
            <input 
              type="text" 
              id="citoyenSearchInput" 
              class="citoyen-search-input" 
              placeholder="Rechercher par nom, prénom ou téléphone..."
              autocomplete="off"
            />
            <div id="citoyenList" class="citoyen-list">
              <!-- Liste des citoyens sera injectée ici -->
            </div>
          </div>
          <div class="citoyen-modal-footer">
            <button id="clearCitoyenSelection" class="btn-secondary">Aucun propriétaire</button>
            <button id="confirmCitoyenSelection" class="btn-primary">Confirmer</button>
          </div>
        </div>
      </div>
    `;

        // Injecter dans le body s'il n'existe pas déjà
        if (!document.getElementById('citoyenSelectorModal')) {
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }

        this.modal = document.getElementById('citoyenSelectorModal');
    }

    async loadCitoyens() {
        try {
            const res = await fetch('/api/citoyens?limit=1000');
            if (!res.ok) throw new Error('Erreur chargement citoyens');
            const data = await res.json();
            this.citoyens = data.citoyens || [];
            this.filteredCitoyens = [...this.citoyens];
            this.renderCitoyenList();
        } catch (error) {
            console.error('Erreur lors du chargement des citoyens:', error);
            showNotification('Erreur lors du chargement des citoyens', 'error');
        }
    }

    renderCitoyenList() {
        const listContainer = document.getElementById('citoyenList');
        listContainer.innerHTML = '';

        if (this.filteredCitoyens.length === 0) {
            listContainer.innerHTML = '<p class="no-results">Aucun citoyen trouvé</p>';
            return;
        }

        this.filteredCitoyens.forEach(citoyen => {
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
            ${citoyen.telephone ? ` • ${citoyen.telephone}` : ''}
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

    filterCitoyens(searchTerm) {
        const search = searchTerm.toLowerCase().trim();

        if (!search) {
            this.filteredCitoyens = [...this.citoyens];
        } else {
            this.filteredCitoyens = this.citoyens.filter(citoyen => {
                return (
                    citoyen.nom.toLowerCase().includes(search) ||
                    citoyen.prenom.toLowerCase().includes(search) ||
                    (citoyen.telephone && citoyen.telephone.toLowerCase().includes(search))
                );
            });
        }

        this.renderCitoyenList();
    }

    attachEventListeners() {
        const closeBtn = document.getElementById('closeCitoyenModal');
        const confirmBtn = document.getElementById('confirmCitoyenSelection');
        const clearBtn = document.getElementById('clearCitoyenSelection');
        const searchInput = document.getElementById('citoyenSearchInput');

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
                this.onSelectCallback(citoyen);
            }
            this.close();
        });

        // Effacer la sélection (aucun propriétaire)
        clearBtn.addEventListener('click', () => {
            if (this.onSelectCallback) {
                this.onSelectCallback(null, null);
            }
            this.close();
        });

        // Recherche
        searchInput.addEventListener('input', (e) => {
            this.filterCitoyens(e.target.value);
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
        document.getElementById('citoyenSearchInput').value = '';
        this.filteredCitoyens = [...this.citoyens];
        this.renderCitoyenList();

        this.modal.style.display = 'flex';
    }

    close() {
        this.modal.style.display = 'none';
        this.selectedCitoyenId = null;
        this.selectedCitoyenName = null;
    }
}

// Instance globale
let citoyenSelector = null;

// Initialiser le sélecteur au chargement de la page
document.addEventListener('DOMContentLoaded', async () => {
    citoyenSelector = new CitoyenSelectorModal();
    await citoyenSelector.init();
});
