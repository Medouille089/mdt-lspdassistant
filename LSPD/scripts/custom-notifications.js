/**
 * Custom Notifications System
 * Compatible FiveM NUI - Remplace alert(), confirm() et prompt()
 * 
 * Usage:
 * 1. Inclure le CSS: <link rel="stylesheet" href="styles/custom-notifications.css">
 * 2. Inclure ce JS: <script src="scripts/custom-notifications.js"></script>
 * 3. Utiliser les fonctions:
 *    - showNotification(message, type) - Remplace alert()
 *    - showConfirm(message, callback) - Remplace confirm()
 *    - showPrompt(message, defaultValue, callback) - Remplace prompt()
 */

(function() {
    'use strict';

    // Container pour les notifications
    let notificationContainer = null;

    /**
     * Initialise le container de notifications
     */
    function initNotificationContainer() {
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.className = 'notification-container';
            document.body.appendChild(notificationContainer);
        }
        return notificationContainer;
    }

    /**
     * Affiche une notification
     * @param {string} message - Le message à afficher
     * @param {string} type - Type: 'info', 'success', 'warning', 'error' (défaut: 'info')
     * @param {number} duration - Durée en ms (défaut: 3000)
     */
    window.showNotification = function(message, type = 'info', duration = 3000) {
        const container = initNotificationContainer();
        
        const notification = document.createElement('div');
        notification.className = `custom-notification notification-${type}`;
        
        const content = document.createElement('div');
        content.className = 'notification-content';
        content.textContent = message;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'notification-close';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = function() {
            closeNotification(notification);
        };
        
        notification.appendChild(content);
        notification.appendChild(closeBtn);
        container.appendChild(notification);
        
        // Auto-close après la durée spécifiée
        if (duration > 0) {
            setTimeout(() => {
                closeNotification(notification);
            }, duration);
        }
        
        return notification;
    };

    /**
     * Ferme une notification avec animation
     */
    function closeNotification(notification) {
        notification.classList.add('closing');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    /**
     * Affiche une boîte de confirmation
     * @param {string} message - Le message à afficher
     * @param {function} callback - Callback(result) où result est true/false
     * @param {object} options - Options: { yesText: 'Oui', noText: 'Non' }
     */
    window.showConfirm = function(message, callback, options = {}) {
        const yesText = options.yesText || 'Oui';
        const noText = options.noText || 'Non';
        
        const overlay = document.createElement('div');
        overlay.className = 'custom-confirm-overlay';
        
        overlay.innerHTML = `
            <div class="custom-confirm-box">
                <div class="custom-confirm-message">${message}</div>
                <div class="custom-confirm-buttons">
                    <button class="custom-confirm-btn custom-confirm-btn-yes">${yesText}</button>
                    <button class="custom-confirm-btn custom-confirm-btn-no">${noText}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Afficher avec animation
        setTimeout(() => overlay.classList.add('show'), 10);
        
        const yesBtn = overlay.querySelector('.custom-confirm-btn-yes');
        const noBtn = overlay.querySelector('.custom-confirm-btn-no');
        
        function close(result) {
            overlay.classList.add('closing');
            overlay.classList.remove('show');
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
                if (callback) callback(result);
            }, 200);
        }
        
        yesBtn.onclick = () => close(true);
        noBtn.onclick = () => close(false);
        
        // Fermer en cliquant sur l'overlay
        overlay.onclick = function(e) {
            if (e.target === overlay) {
                close(false);
            }
        };
        
        // Support clavier (Enter = Oui, Escape = Non)
        function handleKeyPress(e) {
            if (e.key === 'Enter') {
                close(true);
                document.removeEventListener('keydown', handleKeyPress);
            } else if (e.key === 'Escape') {
                close(false);
                document.removeEventListener('keydown', handleKeyPress);
            }
        }
        document.addEventListener('keydown', handleKeyPress);
    };

    /**
     * Affiche une boîte de prompt (saisie de texte)
     * @param {string} message - Le message à afficher
     * @param {string} defaultValue - Valeur par défaut
     * @param {function} callback - Callback(result) où result est la valeur saisie ou null si annulé
     * @param {object} options - Options: { okText: 'OK', cancelText: 'Annuler', placeholder: '' }
     */
    window.showPrompt = function(message, defaultValue = '', callback, options = {}) {
        const okText = options.okText || 'OK';
        const cancelText = options.cancelText || 'Annuler';
        const placeholder = options.placeholder || '';
        
        const overlay = document.createElement('div');
        overlay.className = 'custom-prompt-overlay';
        
        overlay.innerHTML = `
            <div class="custom-prompt-box">
                <div class="custom-prompt-message">${message}</div>
                <input type="text" class="custom-prompt-input" value="${defaultValue}" placeholder="${placeholder}">
                <div class="custom-prompt-buttons">
                    <button class="custom-prompt-btn custom-prompt-btn-ok">${okText}</button>
                    <button class="custom-prompt-btn custom-prompt-btn-cancel">${cancelText}</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Afficher avec animation
        setTimeout(() => overlay.classList.add('show'), 10);
        
        const input = overlay.querySelector('.custom-prompt-input');
        const okBtn = overlay.querySelector('.custom-prompt-btn-ok');
        const cancelBtn = overlay.querySelector('.custom-prompt-btn-cancel');
        
        // Focus sur l'input
        setTimeout(() => {
            input.focus();
            input.select();
        }, 50);
        
        function close(result) {
            overlay.classList.add('closing');
            overlay.classList.remove('show');
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
                if (callback) callback(result);
            }, 200);
        }
        
        okBtn.onclick = () => close(input.value);
        cancelBtn.onclick = () => close(null);
        
        // Fermer en cliquant sur l'overlay
        overlay.onclick = function(e) {
            if (e.target === overlay) {
                close(null);
            }
        };
        
        // Support clavier (Enter = OK, Escape = Annuler)
        function handleKeyPress(e) {
            if (e.key === 'Enter') {
                close(input.value);
                document.removeEventListener('keydown', handleKeyPress);
            } else if (e.key === 'Escape') {
                close(null);
                document.removeEventListener('keydown', handleKeyPress);
            }
        }
        document.addEventListener('keydown', handleKeyPress);
    };

    /**
     * Fonction utilitaire pour remplacer facilement tous les alert() d'un fichier
     * Usage: window.alert = showNotification;
     */
    window.customAlert = function(message) {
        showNotification(message, 'info');
    };

    /**
     * Versions alternatives avec des noms différents pour éviter les conflits
     */
    window.notify = window.showNotification;
    window.confirmDialog = window.showConfirm;
    window.promptDialog = window.showPrompt;

    // Log pour confirmer le chargement
    console.log('Custom Notifications System loaded - Compatible FiveM NUI');
})();
