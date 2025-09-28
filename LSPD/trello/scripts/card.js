import { boardData, currentCard, currentListId, setCurrentCard, setCurrentListId, activeCardCreations, availableTags } from './state.js';
import { syncBoardData } from './socket.js';
import { generateId, getCardTags, getEtatLabel, COMPACT_CARD_COLORS, extractShortId } from './utils.js';
import { renderBoard, updateSingleCardDOM } from './board.js';
import { openCardModal } from './modal.js';
import { renderCardTags } from './tags.js';

export function attachCardEvents() {
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', function (e) {
            e.stopPropagation();
            const cardId = this.dataset.cardId;
            const listId = this.closest('.list').dataset.listId;
            openCardModal(cardId, listId);
        });
    });

    document.querySelectorAll('.add-card-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            addCard(this);
        });
    });
}

export function addCard(button) {
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

function setupCardCreator(cardCreator, listId, button) {
    let processed = false;
    let selectedImage = null;

    const textarea = cardCreator.querySelector('.edit-input');
    const imageInput = cardCreator.querySelector(`#imageInput-${listId}`);
    const saveBtn = cardCreator.querySelector('.save-btn');
    const cancelBtn = cardCreator.querySelector('.cancel-btn');
    const imagePreviewContainer = cardCreator.querySelector('.image-preview-container');
    const imagePreview = cardCreator.querySelector('.image-preview');
    const removeImageBtn = cardCreator.querySelector('.remove-image');

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
            cleanup();
            syncBoardData();
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

    textarea.focus();
}

export function saveCardChanges() {
    if (!currentCard) return;

    const listId = currentListId;
    const cardId = currentCard.id;

    currentCard.description = document.getElementById('descriptionText').value;

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
    fieldMappings.forEach(([fieldId, cardProp]) => {
        currentCard[cardProp] = document.getElementById(fieldId).value;
    });

    syncBoardData();
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

    function saveTitle() {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== currentText) {
            currentCard.text = newTitle;
            titleElement.textContent = newTitle;
            renderCardTags();
            syncBoardData();
            renderBoard();
        }
        input.remove();
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
        syncBoardData();
        renderBoard();
    } else {
        showCompactCardDialog(card, extractShortId(card.text), listId);
    }
}

function showCompactCardDialog(card, defaultText, listId) {
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

    let selectedColor = 'gray';
    const textInput = dialog.querySelector('.compact-card-text-input');
    const colorOptions = dialog.querySelectorAll('.compact-card-color-option');
    const preview = dialog.querySelector('.compact-card-preview .compact-card');
    const previewText = dialog.querySelector('.compact-card-preview .compact-card-text');

    // Event handlers
    textInput.addEventListener('input', () => {
        previewText.textContent = textInput.value || defaultText;
    });

    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            colorOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedColor = option.dataset.color;
            preview.className = `compact-card color-${selectedColor}`;
        });
    });

    function closeDialog() {
        document.body.removeChild(dialog);
    }

    function confirmCompact() {
        card.isCompact = true;
        card.compactText = textInput.value.trim() || defaultText;
        card.compactColor = selectedColor;
        closeDialog();
        syncBoardData();
        renderBoard();
    }

    dialog.querySelector('.compact-card-dialog-close').addEventListener('click', closeDialog);
    dialog.querySelector('.cancel').addEventListener('click', closeDialog);
    dialog.querySelector('.confirm').addEventListener('click', confirmCompact);

    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) closeDialog();
    });

    document.addEventListener('keydown', function escapeHandler(e) {
        if (e.key === 'Escape') {
            closeDialog();
            document.removeEventListener('keydown', escapeHandler);
        }
    });

    textInput.focus();
    textInput.select();
}

// Image utilities
export function imageToBase64(file) {
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
