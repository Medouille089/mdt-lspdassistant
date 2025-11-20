/**
 * Système de modals personnalisées pour remplacer alert, confirm et prompt
 */

/**
 * Affiche une modal d'alerte personnalisée
 * @param {string} message - Le message à afficher
 * @param {string} title - Le titre de la modal (optionnel)
 * @returns {Promise<void>}
 */
export function showAlert(message, title = 'Information') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'custom-modal custom-alert-modal';
        modal.innerHTML = `
            <div class="custom-modal-header">
                <h3 class="custom-modal-title">${title}</h3>
            </div>
            <div class="custom-modal-body">
                <p class="custom-modal-message">${message}</p>
            </div>
            <div class="custom-modal-footer">
                <button class="custom-modal-btn custom-modal-btn-primary" data-action="ok">OK</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Animation d'entrée
        setTimeout(() => {
            overlay.classList.add('show');
            modal.classList.add('show');
        }, 10);
        
        const okBtn = modal.querySelector('[data-action="ok"]');
        
        const close = () => {
            overlay.classList.remove('show');
            modal.classList.remove('show');
            setTimeout(() => {
                overlay.remove();
                resolve();
            }, 200);
        };
        
        okBtn.addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
        
        // Focus sur le bouton OK
        setTimeout(() => okBtn.focus(), 100);
        
        // Touche Entrée pour fermer
        const handleEnter = (e) => {
            if (e.key === 'Enter') {
                close();
                document.removeEventListener('keydown', handleEnter);
            }
        };
        document.addEventListener('keydown', handleEnter);
    });
}

/**
 * Affiche une modal de confirmation personnalisée
 * @param {string} message - Le message à afficher
 * @param {string} title - Le titre de la modal (optionnel)
 * @param {object} options - Options de personnalisation
 * @returns {Promise<boolean>}
 */
export function showConfirm(message, title = 'Confirmation', options = {}) {
    const {
        confirmText = 'Confirmer',
        cancelText = 'Annuler',
        danger = false
    } = options;
    
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'custom-modal custom-confirm-modal';
        modal.innerHTML = `
            <div class="custom-modal-header">
                <h3 class="custom-modal-title">${title}</h3>
            </div>
            <div class="custom-modal-body">
                <p class="custom-modal-message">${message}</p>
            </div>
            <div class="custom-modal-footer">
                <button class="custom-modal-btn custom-modal-btn-secondary" data-action="cancel">${cancelText}</button>
                <button class="custom-modal-btn custom-modal-btn-primary ${danger ? 'danger' : ''}" data-action="confirm">${confirmText}</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Animation d'entrée
        setTimeout(() => {
            overlay.classList.add('show');
            modal.classList.add('show');
        }, 10);
        
        const confirmBtn = modal.querySelector('[data-action="confirm"]');
        const cancelBtn = modal.querySelector('[data-action="cancel"]');
        
        const close = (confirmed) => {
            overlay.classList.remove('show');
            modal.classList.remove('show');
            setTimeout(() => {
                overlay.remove();
                resolve(confirmed);
            }, 200);
        };
        
        confirmBtn.addEventListener('click', () => close(true));
        cancelBtn.addEventListener('click', () => close(false));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close(false);
        });
        
        // Focus sur le bouton de confirmation
        setTimeout(() => confirmBtn.focus(), 100);
        
        // Touches Entrée et Échap
        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                close(true);
                document.removeEventListener('keydown', handleKeydown);
            } else if (e.key === 'Escape') {
                close(false);
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    });
}

/**
 * Affiche une modal de prompt personnalisée
 * @param {string} message - Le message à afficher
 * @param {string} title - Le titre de la modal (optionnel)
 * @param {string} defaultValue - La valeur par défaut (optionnel)
 * @returns {Promise<string|null>}
 */
export function showPrompt(message, title = 'Saisie', defaultValue = '') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'custom-modal custom-prompt-modal';
        modal.innerHTML = `
            <div class="custom-modal-header">
                <h3 class="custom-modal-title">${title}</h3>
            </div>
            <div class="custom-modal-body">
                <p class="custom-modal-message">${message}</p>
                <input type="text" class="custom-modal-input" value="${defaultValue}" />
            </div>
            <div class="custom-modal-footer">
                <button class="custom-modal-btn custom-modal-btn-secondary" data-action="cancel">Annuler</button>
                <button class="custom-modal-btn custom-modal-btn-primary" data-action="ok">OK</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Animation d'entrée
        setTimeout(() => {
            overlay.classList.add('show');
            modal.classList.add('show');
        }, 10);
        
        const input = modal.querySelector('.custom-modal-input');
        const okBtn = modal.querySelector('[data-action="ok"]');
        const cancelBtn = modal.querySelector('[data-action="cancel"]');
        
        const close = (value) => {
            overlay.classList.remove('show');
            modal.classList.remove('show');
            setTimeout(() => {
                overlay.remove();
                resolve(value);
            }, 200);
        };
        
        okBtn.addEventListener('click', () => close(input.value.trim() || null));
        cancelBtn.addEventListener('click', () => close(null));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close(null);
        });
        
        // Focus sur l'input et sélection du texte
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);
        
        // Touches Entrée et Échap
        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                close(input.value.trim() || null);
                document.removeEventListener('keydown', handleKeydown);
            } else if (e.key === 'Escape') {
                close(null);
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    });
}
