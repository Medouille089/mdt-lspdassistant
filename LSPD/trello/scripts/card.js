import { boardData, currentCard, currentListId, activeCardCreations, availableTags } from './state.js';
import { submitOperation } from './socket.js';
import { generateId, COMPACT_CARD_COLORS } from './utils.js';
import { renderBoard, updateSingleCardDOM } from './board.js';
import { openCardModal } from './modal.js';
import { renderCardTags } from './tags.js';

function editCompactCardTitle(cardId, listId, cardElement) {
    const list = boardData.lists.find(l => l.id === listId);
    const card = list?.cards.find(c => c.id === cardId);
    if (!card) return;

    const textElement = cardElement.querySelector('.compact-card-text');
    const currentText = card.text;

    // Créer l'input d'édition
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'compact-card-edit-input';
    
    // Styles pour l'input
    input.style.cssText = `
        background: rgba(255, 255, 255, 0.9);
        border: 2px solid #0079bf;
        border-radius: 4px;
        color: #333;
        font-size: 14px;
        font-weight: 600;
        padding: 4px 8px;
        width: calc(100% - 24px);
        outline: none;
        text-transform: none;
        letter-spacing: normal;
        position: absolute;
        top: 50%;
        left: 8px;
        transform: translateY(-50%);
        z-index: 20;
        box-shadow: 0 0 8px rgba(0, 121, 191, 0.5);
    `;

    // Masquer le texte original et ajouter l'input
    textElement.style.opacity = '0';
    cardElement.style.position = 'relative';
    cardElement.appendChild(input);

    // Focus et sélection
    input.focus();
    input.select();

    function saveTitle() {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== currentText) {
            card.text = newTitle;
            
            // Mettre à jour le texte compact si nécessaire
            if (card.isCompact && card.compactText) {
                card.compactText = newTitle;
            }
            
            const updates = card.isCompact
                ? { text: newTitle, compactText: card.compactText }
                : { text: newTitle };

            submitOperation('UPDATE_CARD', { listId, cardId: card.id, updates });
            renderBoard();
        } else {
            // Restaurer l'affichage original
            cleanup();
        }
    }

    function cleanup() {
        if (input.parentNode) {
            input.parentNode.removeChild(input);
        }
        textElement.style.opacity = '';
    }

    // Gestionnaires d'événements
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            saveTitle();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cleanup();
        }
    });

    input.addEventListener('blur', function (e) {
        // Délai pour permettre d'autres interactions
        setTimeout(() => {
            if (document.contains(input)) {
                saveTitle();
            }
        }, 100);
    });

    // Empêcher les clics sur l'input de déclencher d'autres événements
    input.addEventListener('click', function (e) {
        e.stopPropagation();
    });

    input.addEventListener('dblclick', function (e) {
        e.stopPropagation();
    });
}

export function attachCardEvents() {
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', function (e) {
            e.stopPropagation();
            
            // Ne pas ouvrir la modal si c'est une carte compacte
            if (this.classList.contains('compact-card')) {
                return;
            }
            
            const cardId = this.dataset.cardId;
            const listId = this.closest('.list').dataset.listId;
            openCardModal(cardId, listId);
        });

        // Ajouter l'édition par double-clic pour toutes les cartes (compactes et normales)
        card.addEventListener('dblclick', function (e) {
            e.stopPropagation();
            e.preventDefault();
            const cardId = this.dataset.cardId;
            const listId = this.closest('.list').dataset.listId;
            
            if (this.classList.contains('compact-card')) {
                editCompactCardTitle(cardId, listId, this);
            } else {
                // Pour les cartes normales, ouvrir la modal puis éditer le titre
                openCardModal(cardId, listId);
                setTimeout(() => editCardTitle(), 100);
            }
        });

        // Ajouter le menu contextuel (clic droit)
        card.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const cardId = this.dataset.cardId;
            const listId = this.closest('.list').dataset.listId;
            showCardContextMenu(e, cardId, listId);
        });
    });

    document.querySelectorAll('.add-card-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            addCard(this);
        });
    });
}

export async function addCard(button) {
    const list = button.closest('.list');
    const listId = list.dataset.listId;

    if (activeCardCreations.has(listId) || list.querySelector('.edit-input')) {
        return;
    }

    activeCardCreations.add(listId);

    const cardCreator = document.createElement('div');
    cardCreator.className = 'simple-card-creator';
    cardCreator.innerHTML = `
        <textarea class="edit-input" placeholder="Entrez le titre de la carte..."></textarea>
        <div class="card-actions">
            <input type="file" id="imageInput-${listId}" accept="image/*" style="display: none;">
            <button class="image-btn" onclick="document.getElementById('imageInput-${listId}').click()">
                📷 Image
            </button>
            <div class="action-buttons">
                <button class="save-btn">Ajouter</button>
                <button class="cancel-btn">✕</button>
            </div>
        </div>
        <div class="image-preview-container" style="display: none;">
            <div class="image-preview"></div>
            <button class="remove-image">✕</button>
        </div>
    `;

    button.style.display = 'none';
    const listContent = list.querySelector('.list-content');
    listContent.insertBefore(cardCreator, button);

    setupCardCreator(cardCreator, listId, button);
}

// Exporter setupCardCreator pour pouvoir l'utiliser depuis board.js
export function setupCardCreator(cardCreator, listId, button) {
    let processed = false;
    let selectedImage = null;

    const textarea = cardCreator.querySelector('.edit-input');
    const imageInput = cardCreator.querySelector(`#imageInput-${listId}`);
    const saveBtn = cardCreator.querySelector('.save-btn');
    const cancelBtn = cardCreator.querySelector('.cancel-btn');
    const imagePreviewContainer = cardCreator.querySelector('.image-preview-container');
    const imagePreview = cardCreator.querySelector('.image-preview');
    const removeImageBtn = cardCreator.querySelector('.remove-image');

    // Si une image était déjà présente, la restaurer
    if (imagePreview.innerHTML) {
        const imgElement = imagePreview.querySelector('img');
        if (imgElement && imgElement.src) {
            selectedImage = {
                data: imgElement.src,
                name: 'image-restaurée.jpg',
                size: 0 // Taille inconnue pour une image restaurée
            };
        }
    }

    async function handleImageSelection(file) {
        try {
            if (file.size > 5 * 1024 * 1024) {
                alert('Image trop volumineuse (max 5MB)');
                return;
            }

            const resizedFile = await resizeImage(file);
            const base64Image = await imageToBase64(resizedFile);

            selectedImage = {
                data: base64Image,
                name: file.name,
                size: resizedFile.size
            };

            imagePreview.innerHTML = `<img src="${base64Image}" alt="Preview">`;
            imagePreviewContainer.style.display = 'flex';

        } catch (error) {
            console.error('Erreur image:', error);
            alert('Erreur lors du traitement de l\'image');
        }
    }

    function createCard() {
        if (processed) return;
        processed = true;

        const text = textarea.value.trim();
        if (!text && !selectedImage) {
            processed = false;
            alert('Ajoutez du texte ou une image');
            return;
        }

        const cardData = {
            id: generateId(),
            text: text || '',
            tags: [],
            description: '',
            etat: '',
            infoSupp: '',
            infoSuppPlus: '',
            localisation: '',
            vehicule: '',
            td: '',
            convoi: ''
        };

        if (selectedImage) {
            cardData.type = 'image';
            cardData.image = selectedImage;
        } else {
            cardData.type = 'text';
        }

        const targetList = boardData.lists.find(l => l.id == listId);
        if (targetList) {
            targetList.cards.push(cardData);
            const position = targetList.cards.length - 1;
            cleanup();
            submitOperation('CREATE_CARD', { listId, card: cardData, position });
            renderBoard();
        }
    }

    function cleanup() {
        if (cardCreator.parentNode) {
            cardCreator.parentNode.removeChild(cardCreator);
        }
        button.style.display = '';
        activeCardCreations.delete(listId);
    }

    // Event listeners
    imageInput.addEventListener('change', async (e) => {
        if (e.target.files[0]) {
            await handleImageSelection(e.target.files[0]);
        }
    });

    removeImageBtn.addEventListener('click', () => {
        selectedImage = null;
        imagePreviewContainer.style.display = 'none';
        imageInput.value = '';
    });

    saveBtn.addEventListener('click', createCard);
    cancelBtn.addEventListener('click', () => {
        processed = true;
        cleanup();
    });

    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            createCard();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            processed = true;
            cleanup();
        }
    });

    // Ne pas auto-focus si le textarea a déjà du contenu (restauration)
    if (!textarea.value) {
        textarea.focus();
    }
}

export function saveCardChanges() {
    if (!currentCard) return;

    const listId = currentListId;
    const cardId = currentCard.id;

    // Sauvegarder la description seulement si l'élément existe
    const descriptionElement = document.getElementById('descriptionText');
    if (descriptionElement) {
        currentCard.description = descriptionElement.value;
    }

    const etatSelect = document.getElementById('etatField');
    const selectedOption = etatSelect.options[etatSelect.selectedIndex];
    currentCard.etat = etatSelect.value;
    currentCard.etatLabel = selectedOption ? selectedOption.text : '';

    const fieldMappings = [
        ['infoSuppField1', 'infoSupp'],
        ['infoSuppField2', 'infoSuppPlus'],
        ['localisationField', 'localisation'],
        ['vehiculeField', 'vehicule'],
        ['tdField', 'td'],
        ['convoiField', 'convoi']
    ];
    const updates = {
        description: currentCard.description,
        etat: currentCard.etat,
        etatLabel: currentCard.etatLabel,
        tags: Array.isArray(currentCard.tags) ? [...currentCard.tags] : []
    };
    fieldMappings.forEach(([fieldId, cardProp]) => {
        const element = document.getElementById(fieldId);
        const value = element ? element.value : '';
        currentCard[cardProp] = value;
        updates[cardProp] = value;
    });

    submitOperation('UPDATE_CARD', { listId, cardId, updates });
    updateSingleCardDOM(cardId, listId);
}

export function editCardTitle() {
    const titleElement = document.getElementById('modalTitle');
    const currentText = titleElement.textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'title-edit-input';

    titleElement.style.display = 'none';
    titleElement.parentNode.insertBefore(input, titleElement);
    input.focus();
    input.select();

    let handled = false;

    function saveTitle() {
        if (handled) return;
        handled = true;

        const newTitle = input.value.trim();
        if (newTitle && newTitle !== currentText) {
            currentCard.text = newTitle;
            titleElement.textContent = newTitle;
            renderCardTags();
            submitOperation('UPDATE_CARD', {
                listId: currentListId,
                cardId: currentCard.id,
                updates: { text: newTitle }
            });
            renderBoard();
        }
        if (input.isConnected) {
            input.remove();
        }
        titleElement.style.display = '';
    }

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveTitle();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            input.remove();
            titleElement.style.display = '';
        }
    });

    input.addEventListener('blur', saveTitle);
}

export function toggleCardCompact(cardId, listId) {
    const list = boardData.lists.find(l => l.id === listId);
    const card = list?.cards.find(c => c.id === cardId);
    if (!card) return;

    if (card.isCompact) {
        delete card.isCompact;
        delete card.compactText;
        delete card.compactColor;
        submitOperation('UPDATE_CARD', {
            listId,
            cardId,
            updates: { isCompact: null, compactText: null, compactColor: null }
        });
        renderBoard();
    } else {
        showCompactCardDialog(card, card.text, listId);
    }
}

function showCompactCardDialog(card, defaultText, listId) {
    // Fermer tout dialog existant
    const existingDialog = document.querySelector('.compact-card-dialog-overlay');
    if (existingDialog) {
        existingDialog.remove();
    }

    const dialog = document.createElement('div');
    dialog.className = 'compact-card-dialog-overlay';
    dialog.innerHTML = `
        <div class="compact-card-dialog">
            <div class="compact-card-dialog-header">
                <h3>Configurer la carte compacte</h3>
                <button class="compact-card-dialog-close">×</button>
            </div>
            <div class="compact-card-dialog-content">
                <div class="compact-card-dialog-section">
                    <label class="compact-card-dialog-label">Texte compact :</label>
                    <input type="text" class="compact-card-text-input" value="${defaultText}" placeholder="Texte à afficher">
                </div>
                <div class="compact-card-dialog-section">
                    <label class="compact-card-dialog-label">Couleur :</label>
                    <div class="compact-card-color-grid">
                        ${COMPACT_CARD_COLORS.map(colorOption => `
                            <div class="compact-card-color-option ${colorOption.id === 'gray' ? 'selected' : ''}" 
                                 data-color="${colorOption.id}" 
                                 style="background-color: ${colorOption.color}"
                                 title="${colorOption.label}">
                                <span class="color-check">✓</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="compact-card-dialog-section">
                    <label class="compact-card-dialog-label">Aperçu :</label>
                    <div class="compact-card-preview">
                        <div class="compact-card color-gray">
                            <div class="compact-card-content">
                                <span class="compact-card-text">${defaultText}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="compact-card-dialog-actions">
                <button class="compact-card-dialog-btn cancel">Annuler</button>
                <button class="compact-card-dialog-btn confirm">Confirmer</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    // Forcer l'affichage du dialog
    requestAnimationFrame(() => {
        dialog.style.display = 'flex';
        dialog.style.opacity = '1';
    });

    let selectedColor = 'gray';
    const textInput = dialog.querySelector('.compact-card-text-input');
    const colorOptions = dialog.querySelectorAll('.compact-card-color-option');
    const preview = dialog.querySelector('.compact-card-preview .compact-card');
    const previewText = dialog.querySelector('.compact-card-preview .compact-card-text');
    const closeBtn = dialog.querySelector('.compact-card-dialog-close');
    const cancelBtn = dialog.querySelector('.cancel');
    const confirmBtn = dialog.querySelector('.confirm');

    // Event handlers pour l'input texte
    textInput.addEventListener('input', () => {
        const newText = textInput.value.trim() || defaultText;
        previewText.textContent = newText;
    });

    // Event handlers pour les couleurs
    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            colorOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedColor = option.dataset.color;
            preview.className = `compact-card color-${selectedColor}`;
        });
    });

    function closeDialog() {
        if (dialog.parentNode) {
            dialog.parentNode.removeChild(dialog);
        }
    }

    function confirmCompact() {
        const finalText = textInput.value.trim() || defaultText;
        card.isCompact = true;
        card.compactText = finalText;
        card.compactColor = selectedColor;
        submitOperation('UPDATE_CARD', {
            listId,
            cardId: card.id,
            updates: { isCompact: true, compactText: finalText, compactColor: selectedColor }
        });
        renderBoard();
        closeDialog();
    }

    // Event listeners pour fermer
    closeBtn.addEventListener('click', closeDialog);
    cancelBtn.addEventListener('click', closeDialog);
    confirmBtn.addEventListener('click', confirmCompact);

    // Fermer en cliquant sur l'overlay
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            closeDialog();
        }
    });

    // Fermer avec Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeDialog();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

    // Focus sur l'input
    setTimeout(() => {
        textInput.focus();
        textInput.select();
    }, 100);
}

function showCardContextMenu(event, cardId, listId) {
    // Fermer les menus existants
    closeCardContextMenu();

    const list = boardData.lists.find(l => l.id === listId);
    const card = list?.cards.find(c => c.id === cardId);
    if (!card) return;

    const contextMenu = document.createElement('div');
    contextMenu.className = 'card-context-menu';
    
    // Menu différent pour les cartes compactes
    if (card.isCompact) {
        contextMenu.innerHTML = `
            <button class="context-menu-item" data-action="change-color">
                🎨 Modifier la couleur
            </button>
            <button class="context-menu-item" data-action="duplicate">
                📄 Dupliquer la carte
            </button>
            <button class="context-menu-item danger" data-action="delete">
                🗑️ Supprimer la carte
            </button>
        `;
    } else {
        contextMenu.innerHTML = `
            <button class="context-menu-item" data-action="duplicate">
                📄 Dupliquer la carte
            </button>
            <button class="context-menu-item danger" data-action="delete">
                🗑️ Supprimer la carte
            </button>
        `;
    }

    // Positionner le menu
    contextMenu.style.position = 'fixed';
    contextMenu.style.left = event.clientX + 'px';
    contextMenu.style.top = event.clientY + 'px';
    contextMenu.style.zIndex = '9999';

    document.body.appendChild(contextMenu);

    // Ajuster la position si le menu sort de l'écran
    const rect = contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        contextMenu.style.left = (event.clientX - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        contextMenu.style.top = (event.clientY - rect.height) + 'px';
    }

    // Gérer les clics sur les éléments du menu
    contextMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = e.target.dataset.action;

        if (action === 'delete') {
            deleteCard(cardId, listId);
        } else if (action === 'duplicate') {
            duplicateCard(cardId, listId);
        } else if (action === 'change-color') {
            showCompactCardColorPicker(cardId, listId);
        }

        closeCardContextMenu();
    });

    // Fermer le menu si on clique ailleurs
    setTimeout(() => {
        document.addEventListener('click', closeCardContextMenu, { once: true });
        document.addEventListener('contextmenu', closeCardContextMenu, { once: true });
    }, 0);
}

function closeCardContextMenu() {
    const existingMenu = document.querySelector('.card-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
}

function deleteCard(cardId, listId) {
    const list = boardData.lists.find(l => l.id === listId);
    if (!list) return;

    const card = list.cards.find(c => c.id === cardId);
    if (!card) return;

    if (confirm(`Êtes-vous sûr de vouloir supprimer la carte "${card.text}" ?`)) {
        list.cards = list.cards.filter(c => c.id !== cardId);
        submitOperation('DELETE_CARD', { listId, cardId });
        renderBoard();
    }
}

function duplicateCard(cardId, listId) {
    const list = boardData.lists.find(l => l.id === listId);
    if (!list) return;

    const originalCard = list.cards.find(c => c.id === cardId);
    if (!originalCard) return;

    const cardIndex = list.cards.findIndex(c => c.id === cardId);
    const duplicatedCard = JSON.parse(JSON.stringify(originalCard));
    duplicatedCard.id = generateId();
    duplicatedCard.text = duplicatedCard.text;

    const insertIndex = cardIndex + 1;
    list.cards.splice(insertIndex, 0, duplicatedCard);
    submitOperation('CREATE_CARD', { listId, card: duplicatedCard, position: insertIndex });
    renderBoard();
}

function showCompactCardColorPicker(cardId, listId) {
    const list = boardData.lists.find(l => l.id === listId);
    const card = list?.cards.find(c => c.id === cardId);
    if (!card || !card.isCompact) return;

    // Fermer tout dialog existant
    const existingDialog = document.querySelector('.compact-card-color-picker-overlay');
    if (existingDialog) {
        existingDialog.remove();
    }

    const dialog = document.createElement('div');
    dialog.className = 'compact-card-color-picker-overlay';
    dialog.innerHTML = `
        <div class="compact-card-color-picker">
            <div class="compact-card-dialog-header">
                <h3>Changer la couleur</h3>
                <button class="compact-card-dialog-close">×</button>
            </div>
            <div class="compact-card-dialog-content">
                <div class="compact-card-dialog-section">
                    <label class="compact-card-dialog-label">Couleur :</label>
                    <div class="compact-card-color-grid">
                        ${COMPACT_CARD_COLORS.map(colorOption => `
                            <div class="compact-card-color-option ${colorOption.id === (card.compactColor || 'gray') ? 'selected' : ''}" 
                                 data-color="${colorOption.id}" 
                                 style="background-color: ${colorOption.color}"
                                 title="${colorOption.label}">
                                <span class="color-check">✓</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="compact-card-dialog-section">
                    <label class="compact-card-dialog-label">Aperçu :</label>
                    <div class="compact-card-preview">
                        <div class="compact-card color-${card.compactColor || 'gray'}">
                            <div class="compact-card-content">
                                <span class="compact-card-text">${card.compactText || card.text}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="compact-card-dialog-actions">
                <button class="compact-card-dialog-btn cancel">Annuler</button>
                <button class="compact-card-dialog-btn confirm">Confirmer</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    // Forcer l'affichage du dialog
    requestAnimationFrame(() => {
        dialog.style.display = 'flex';
        dialog.style.opacity = '1';
    });

    let selectedColor = card.compactColor || 'gray';
    const colorOptions = dialog.querySelectorAll('.compact-card-color-option');
    const preview = dialog.querySelector('.compact-card-preview .compact-card');
    const closeBtn = dialog.querySelector('.compact-card-dialog-close');
    const cancelBtn = dialog.querySelector('.cancel');
    const confirmBtn = dialog.querySelector('.confirm');

    // Event handlers pour les couleurs
    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            colorOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedColor = option.dataset.color;
            preview.className = `compact-card color-${selectedColor}`;
        });
    });

    function closeDialog() {
        if (dialog.parentNode) {
            dialog.parentNode.removeChild(dialog);
        }
    }

    function confirmColorChange() {
        card.compactColor = selectedColor;
        submitOperation('UPDATE_CARD', {
            listId,
            cardId,
            updates: { compactColor: selectedColor }
        });
        renderBoard();
        closeDialog();
    }

    // Event listeners pour fermer
    closeBtn.addEventListener('click', closeDialog);
    cancelBtn.addEventListener('click', closeDialog);
    confirmBtn.addEventListener('click', confirmColorChange);

    // Fermer en cliquant sur l'overlay
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            closeDialog();
        }
    });

    // Fermer avec Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeDialog();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

    // Focus sur l'input
    setTimeout(() => {
        colorOptions[0].focus();
    }, 100);
}

function imageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

export function resizeImage(file, maxWidth = 400, maxHeight = 300, quality = 0.8) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            if (width > height) {
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
            }
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(resolve, 'image/jpeg', quality);
        };
        img.src = URL.createObjectURL(file);
    });
}
