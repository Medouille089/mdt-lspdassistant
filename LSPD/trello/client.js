// Connexion Socket.io
const socket = io();

// Structure de données globales
let boardData = { lists: [], tags: [] };
let availableTags = JSON.parse(localStorage.getItem('availableTags') || '[]');

// Variables de drag & drop et modals
let currentCard = null;
let currentListId = null;
let draggedCard = null;
let draggedFromList = null;

// Variables de synchronisation
let lastSyncData = null;
let isLocalUpdate = false;
let activeCardCreations = new Set();
let syncTimeout;

// === Préservation des positions de scroll ===
let scrollState = { boardX: 0, lists: {} };

function captureScrollState() {
    const boardContainer = document.querySelector('.board-container');
    if (boardContainer) scrollState.boardX = boardContainer.scrollLeft;
    scrollState.lists = {};
    document.querySelectorAll('.list').forEach(listEl => {
        const id = listEl.dataset.listId;
        const scroller = listEl.querySelector('.list-content');
        if (id && scroller) scrollState.lists[id] = scroller.scrollTop;
    });
}

function restoreScrollState() {
    const boardContainer = document.querySelector('.board-container');
    if (boardContainer) boardContainer.scrollLeft = scrollState.boardX || 0;
    Object.entries(scrollState.lists || {}).forEach(([id, top]) => {
        const listEl = document.querySelector(`.list[data-list-id="${id}"] .list-content`);
        if (listEl) listEl.scrollTop = top;
    });
}

// ===== Mise à jour partielle d'une carte (sans re-render global) =====
function updateSingleCardDOM(cardId, listId) {
    const list = boardData.lists.find(l => l.id == listId);
    if (!list) return;
    const card = list.cards.find(c => c.id == cardId);
    if (!card) return;

    // Sauvegarder scroll de la liste ciblée uniquement
    const listContentEl = document.querySelector(`.list[data-list-id="${listId}"] .list-content`);
    const prevScrollTop = listContentEl ? listContentEl.scrollTop : 0;

    // Regénérer l'HTML de la carte
    const tmp = document.createElement('div');
    tmp.innerHTML = renderCard(card, listId).trim();
    const newCardEl = tmp.firstElementChild;
    const oldCardEl = document.querySelector(`.card[data-card-id="${cardId}"]`);
    if (oldCardEl && newCardEl) {
        oldCardEl.replaceWith(newCardEl);
        // Ré-attacher les events uniquement pour cette carte
        newCardEl.addEventListener('click', function (e) {
            e.stopPropagation();
            openCardModal(cardId, listId);
        });
    }

    // Restaurer le scroll de la liste (aucun jump)
    if (listContentEl) listContentEl.scrollTop = prevScrollTop;
}

// ==================== SOCKET EVENTS ====================

socket.on('boardSync', (serverBoardData) => {
    boardData = serverBoardData;
    lastSyncData = serverBoardData;
    syncTagsFromBoardData();

    // Si update locale et une carte est ouverte, on évite un render global pour ne pas faire sauter le scroll
    if (isLocalUpdate && currentCard && currentListId && document.getElementById('cardModal')?.classList.contains('active')) {
        isLocalUpdate = false;
        // Mise à jour partielle uniquement
        updateSingleCardDOM(currentCard.id, currentListId);
        return;
    }

    if (isLocalUpdate && activeCardCreations.size > 0) {
        isLocalUpdate = false;
        return;
    }

    isLocalUpdate = false;
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => renderBoard(true), 100);
});

function syncBoardData() {
    isLocalUpdate = true;
    // Avant émission on capture (pour sécurité si re-render rapide local)
    captureScrollState();
    socket.emit('boardUpdate', boardData);
}

// ==================== UTILITAIRES ====================

const generateId = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);

// Patterns pour extraction automatique de tags
const AUTO_TAG_PATTERNS = {
    'officer': /Officier 2/i,
    'k9': /K9/i,
    'metropolitan': /Metropolitan Division/i,
    'traffic': /Trafic Division/i,
    'dispatch': /Dispatch/i,
    'terrain': /Lead Terrain|Négociateur/i,
    'army': /US Army/i,
    'ppa': /PPA [12]/i
};

const extractAutoTags = (text) => {
    return Object.entries(AUTO_TAG_PATTERNS)
        .filter(([_, pattern]) => pattern.test(text))
        .map(([tagId]) => tagId);
};

const getCardTags = (card) => {
    const autoTags = extractAutoTags(card.text);
    const manualTags = card.tags || [];
    return [...new Set([...autoTags, ...manualTags])];
};

// ==================== LABELS ET STYLES ====================

const ETAT_LABELS = {
    '10-98': { text: '✅ 10-98', color: '#164b35', textColor: '#b2ead3' },
    '10-56': { text: '🚓 10-56', color: '#5d1f1a', textColor: '#e68680' },
    '10-40': { text: '🗓️ 10-40', color: '#123263', textColor: '#789fdb' },
    '10-37': { text: '🏠 10-37', color: '#123263', textColor: '#789fdb' },
    '10-38': { text: '🚓 10-38', color: '#123263', textColor: '#789fdb' },
    '10-23': { text: '🛑 10-23', color: '#48245d', textColor: '#c691e4' },
    'code5': { text: '👁️ CODE 5', color: '#693200', textColor: '#fbc828' },
    '10-60': { text: '🟡 CODE 5 - 10-60', color: '#693200', textColor: '#fbc828' },
    '10-31': { text: '💥 Code 5 - 10-31', color: '#693200', textColor: '#fbc828' },
    '10-6': { text: '🚫 10-6 Procédures', color: '#5d1f1a', textColor: '#e68680' },
    '10-06': { text: '❓ 10-06 Divers', color: '#5d1f1a', textColor: '#e68680' },
    'bijouterie': { text: '💎 Bijouterie', color: '#5d1f1a', textColor: '#e68680' },
    '10-91': { text: '💲 10-91', color: '#5d1f1a', textColor: '#e68680' },
    'blesse': { text: '🩹 Blessé', color: '#48245d', textColor: '#c691e4' },
    '10-99': { text: '🔴 10-99', color: '#48245d', textColor: '#c691e4' },
    'pasajour': { text: '❗ PAS A JOUR', color: '#5d1f1a', textColor: '#e68680' }
};

const COMPACT_CARD_COLORS = [
    { id: 'gray', label: 'Gris', color: '#63666b' },
    { id: 'blue', label: 'Bleu', color: '#1558bc' },
    { id: 'red', label: 'Rouge', color: '#ae2e24' },
    { id: 'green', label: 'Vert', color: '#216e4e' },
    { id: 'purple', label: 'Violet', color: '#803fa5' },
    { id: 'bluegray', label: 'BleuGris', color: '#206a83' }
];

const getEtatLabel = (etat) => ETAT_LABELS[etat] || { text: etat, color: '#6c757d', textColor: '#ffffff' };

// ==================== GÉNÉRATION HTML ====================

function generateCustomFieldsHtml(card) {
    if (!card) return '';

    const fields = [];

    if (card.etat) {
        const etatInfo = getEtatLabel(card.etat);
        fields.push({
            label: 'ETATS',
            value: card.etatLabel || etatInfo.text,
            className: `status-${card.etat}`,
            color: etatInfo.color,
            textColor: etatInfo.textColor
        });
    }

    const simpleFields = [
        { key: 'localisation', label: 'Localisation', className: 'location-field' },
        { key: 'vehicule', label: 'Véhicule', className: 'vehicle-field' },
        { key: 'td', label: 'TD', className: 'shift-field' },
        { key: 'convoi', label: 'Convoi', className: 'convoi-field' },
        { key: 'infoSupp', label: 'INFO SUPP', className: 'info-field' },
        { key: 'infoSuppPlus', label: 'INFO SUPP+', className: 'info-field' }
    ];

    simpleFields.forEach(({ key, label, className }) => {
        if (card[key]) {
            fields.push({ label, value: card[key], className });
        }
    });

    if (fields.length === 0) return '';

    return `
        <div class="card-custom-fields">
            ${fields.map(field => {
                const colorStyle = field.color ? 
                    `background-color: ${field.color}E6; color: ${field.textColor};` : '';
                return `
                    <div class="card-field ${field.className}" title="${field.label}: ${field.value}" style="${colorStyle}">
                        <span class="card-field-label">${field.label}:</span>
                        <span class="card-field-value">${field.value}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function extractShortId(cardText) {
    const patterns = [
        /(\d{1,3}-\d{1,3})/,
        /([A-Z]\d+-\d+)/i,
        /Unit[- ]?(\d+)/i,
        /([A-Z]{1,3}\d{1,3})/,
        /(#\d+)/,
        /(\w{2,4}-\w{2,4})/
    ];
    
    for (const pattern of patterns) {
        const match = cardText.match(pattern);
        if (match) return match[1] || match[0];
    }
    
    // Fallback: premiers mots (max 8 chars)
    const words = cardText.trim().split(' ');
    let result = '';
    for (const word of words) {
        if ((result + word).length <= 8) {
            result += (result ? ' ' : '') + word;
        } else break;
    }
    
    return result || cardText.substring(0, 8);
}

// ==================== RENDU DU BOARD ====================

function renderBoard(preserveScroll = true) {
    if (preserveScroll) captureScrollState();
    const board = document.querySelector('.board');
    
    // Sauvegarder les états des inputs actifs
    const activeInputs = new Map();
    document.querySelectorAll('.simple-card-creator').forEach(creator => {
        const listId = creator.closest('.list')?.dataset.listId;
        if (listId && activeCardCreations.has(listId)) {
            const textarea = creator.querySelector('.edit-input');
            activeInputs.set(listId, {
                value: textarea?.value || '',
                focused: document.activeElement === textarea
            });
        }
    });

    board.innerHTML = '';

    boardData.lists.forEach(list => {
        const listEl = document.createElement('div');
        listEl.className = 'list';
        listEl.dataset.listId = list.id;

        const cardsHtml = list.cards.map(card => renderCard(card, list.id)).join('');

        listEl.innerHTML = `
            <div class="list-header">
                <div class="list-title editable-list-title">${list.title}</div>
                </div>
                <div class="list-content">
                ${cardsHtml}
                <button class="add-card-btn">+ Ajouter une carte</button>
                </div>
                `;
                
                // <button class="delete-list-btn" title="Supprimer la liste" onclick="deleteList('${list.id}')">🗑️</button>
        board.appendChild(listEl);
    });

    attachEvents();
    // Restauration après que le DOM soit prêt
    requestAnimationFrame(() => {
        if (preserveScroll) restoreScrollState();
    });
}

function renderCard(card, listId) {
    const cardTags = getCardTags(card);
    const cardTagsHtml = cardTags.map(tagId => {
        const tagInfo = availableTags.find(t => t.id === tagId);
        return tagInfo ? `<span class="card-tag" style="background-color: ${tagInfo.color}" title="${tagInfo.label}"></span>` : '';
    }).join('');

    if (card.isCompact) {
        const shortId = card.compactText || extractShortId(card.text);
        const colorClass = card.compactColor ? `color-${card.compactColor}` : 'color-gray';
        
        return `
            <div class="card compact-card ${colorClass}" data-card-id="${card.id}" draggable="true" title="${card.text}">
                <div class="compact-card-content">
                    <span class="compact-card-text">${shortId}</span>
                </div>
            </div>
        `;
    }

    const customFieldsHtml = generateCustomFieldsHtml(card);
    let cardContentHtml = '';
    
    if (card.type === 'image' && card.image) {
        cardContentHtml = `
            <div class="card-image">
                <img src="${card.image.data}" alt="${card.text}" style="width: 100%; height: auto; max-height: 100%; object-fit: cover; border-radius: 4px;">
            </div>
            <div class="card-title">${card.text}</div>
        `;
    } else {
        cardContentHtml = `<div class="card-title">${card.text}</div>`;
    }

    return `
        <div class="card ${card.type === 'image' ? 'image-card' : ''}" data-card-id="${card.id}" draggable="true">
            <div class="card-content">
                ${cardContentHtml}
                ${cardTagsHtml ? `<div class="card-tags">${cardTagsHtml}</div>` : ''}
                ${customFieldsHtml}
                <button class="compact-card-btn" onclick="toggleCardCompact('${card.id}', '${listId}')" title="Compacter la carte">⤡</button>
            </div>
        </div>
    `;
}

// ==================== MODAL MANAGEMENT ====================

function openCardModal(cardId, listId) {
    const list = boardData.lists.find(l => l.id == listId);
    if (!list) return;
    const card = list.cards.find(c => c.id == cardId);
    if (!card) return;

    currentCard = card;
    currentListId = listId;

    // Remplir les champs
    document.getElementById('modalTitle').textContent = card.text;
    document.getElementById('descriptionText').value = card.description || '';
    
    // Champs personnalisés
    const fieldMappings = [
        ['etatField', 'etat'],
        ['infoSuppField1', 'infoSupp'],
        ['infoSuppField2', 'infoSuppPlus'],
        ['localisationField', 'localisation'],
        ['vehiculeField', 'vehicule'],
        ['tdField', 'td'],
        ['convoiField', 'convoi']
    ];

    fieldMappings.forEach(([fieldId, cardProp]) => {
        const element = document.getElementById(fieldId);
        if (element) element.value = card[cardProp] || '';
    });

    // Style spécial pour l'état
    const etatField = document.getElementById('etatField');
    if (card.etat && etatField) {
        const etatInfo = getEtatLabel(card.etat);
        etatField.style.backgroundColor = `${etatInfo.color}E6`;
        etatField.style.color = etatInfo.textColor;
    } else if (etatField) {
        etatField.style.backgroundColor = '';
        etatField.style.color = '';
    }

    // Gestion de l'affichage d'image
    handleModalImage(card);
    
    renderCardTags();
    document.getElementById('cardModal').classList.add('active');
}

function handleModalImage(card) {
    const modalContent = document.querySelector('.modal-content');
    let existingImageDisplay = modalContent.querySelector('.modal-image-display');
    
    if (card.type === 'image' && card.image) {
        if (!existingImageDisplay) {
            existingImageDisplay = document.createElement('div');
            existingImageDisplay.className = 'modal-image-display';
            modalContent.insertBefore(existingImageDisplay, modalContent.firstChild.nextSibling);
        }
        
        existingImageDisplay.innerHTML = `
            <div class="modal-image-container">
                <img src="${card.image.data}" alt="${card.text}" 
                    style="max-width: 100%; max-height: 80vh; object-fit: contain; border-radius: 8px; cursor: zoom-in;"
                    onclick="openFullscreenImage('${card.image.data}', '${card.text}')">
                <div class="image-info">
                    <small>Nom: ${card.image.name} | Taille: ${(card.image.size / 1024).toFixed(1)} KB</small>
                </div>
            </div>
        `;
    } else if (existingImageDisplay) {
        existingImageDisplay.remove();
    }
}

function closeCardModal() {
    document.getElementById('cardModal').classList.remove('active');
    hideTagSelector();
    currentCard = null;
    currentListId = null;
}

function saveCardChanges() {
    if (!currentCard) return;

    // Pas de re-render global ici: on ne veut pas remonter la liste
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

    // Sync (les autres clients feront leur render)
    syncBoardData();

    // Mise à jour DOM locale ciblée
    updateSingleCardDOM(cardId, listId);
}

// ==================== TAGS MANAGEMENT ====================

function renderCardTags() {
    const tagsContainer = document.getElementById('tagsContainer');
    tagsContainer.innerHTML = '';

    const cardTags = getCardTags(currentCard);

    cardTags.forEach(tagId => {
        const tagInfo = availableTags.find(t => t.id === tagId);
        if (tagInfo) {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.style.backgroundColor = tagInfo.color;
            tag.style.color = tagInfo.textColor || '#fff';
            tag.innerHTML = `${tagInfo.label}<span class="tag-remove" onclick="removeTag('${tagId}')">×</span>`;
            tagsContainer.appendChild(tag);
        }
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'add-tag-btn';
    addBtn.innerHTML = '+';
    addBtn.onclick = showTagSelector;
    tagsContainer.appendChild(addBtn);
}

function renderTagRow(tag, cardTags) {
    return `
        <label class="tag-row" style="background-color: ${tag.color}; color: ${tag.textColor}; display: flex; align-items: center; padding: 8px 12px; border-radius: 4px; gap: 8px;">
            <input type="checkbox" class="tag-checkbox" ${cardTags.includes(tag.id) ? 'checked' : ''} onchange="toggleTagFromCheckbox('${tag.id}', this.checked)" style="margin: 0; width: 20px; height: 20px;">
            <span class="tag-label" style="flex: 1; font-size: 14px; font-weight: 500;">${tag.label}</span>
            <button class="tag-edit-btn" title="Modifier" onclick="editTag('${tag.id}')" style="background: none; border: none; padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                ✎
            </button>
            <button class="tag-delete-btn" title="Supprimer" onclick="deleteTag('${tag.id}')" style="background: none; border: none; padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                🗑️
            </button>
        </label>
    `;
}

function renderTagsList(availableTags, cardTags) {
    return availableTags.map(tag => renderTagRow(tag, cardTags)).join('');
}

function showTagSelector() {
    const existingSelector = document.querySelector('.tag-selector');
    if (existingSelector) {
        existingSelector.remove();
        return;
    }

    const cardTags = getCardTags(currentCard);
    const selector = document.createElement('div');
    selector.className = 'tag-selector';

    selector.innerHTML = `
        <div class="tag-selector-header">
            <h3>Étiquettes</h3>
            <button class="tag-selector-close" onclick="hideTagSelector()">×</button>
        </div>
        <input type="text" class="tag-search-input" placeholder="Parcourir les étiquettes...">
        <div class="tags-list-section">
            <h4>Étiquettes</h4>
            <div class="tags-list">
                ${renderTagsList(availableTags, cardTags)}
            </div>
        </div>
        <button class="create-new-tag-btn" onclick="showCreateTagDialog()">Créer une nouvelle étiquette</button>
    `;

    document.getElementById('tagsContainer').appendChild(selector);
}

function hideTagSelector() {
    const selector = document.querySelector('.tag-selector');
    if (selector) selector.remove();
}

function toggleTagFromCheckbox(tagId, isChecked) {
    if (!currentCard.tags) currentCard.tags = [];

    const autoTags = extractAutoTags(currentCard.text);
    if (autoTags.includes(tagId)) {
        const checkbox = document.querySelector(`input[onchange*="${tagId}"]`);
        if (checkbox) checkbox.checked = true;
        alert('Ce tag est automatiquement détecté dans le texte et ne peut pas être supprimé.');
        return;
    }

    if (isChecked) {
        if (!currentCard.tags.includes(tagId)) {
            currentCard.tags.push(tagId);
        }
    } else {
        currentCard.tags = currentCard.tags.filter(id => id !== tagId);
    }

    saveCardChanges();
    renderCardTags();
    renderBoard();
}

function removeTag(tagId) {
    const autoTags = extractAutoTags(currentCard.text);
    if (autoTags.includes(tagId)) {
        alert('Ce tag est automatiquement détecté dans le texte et ne peut pas être supprimé.');
        return;
    }

    if (currentCard.tags) {
        currentCard.tags = currentCard.tags.filter(id => id !== tagId);
    }

    saveCardChanges();
    renderCardTags();
    renderBoard();
}

// ==================== CARTE COMPACTE ====================

function toggleCardCompact(cardId, listId) {
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

// ==================== DRAG & DROP ====================

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getOrCreateDropIndicator(list) {
    let indicator = list.querySelector('.drop-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'drop-indicator';
    }
    return indicator;
}

function moveCardToPosition(cardId, fromListId, toListId, afterElement) {
    const fromList = boardData.lists.find(l => l.id == fromListId);
    const toList = boardData.lists.find(l => l.id == toListId);
    
    const cardIndex = fromList.cards.findIndex(c => c.id == cardId);
    const card = fromList.cards[cardIndex];
    
    if (!card) return;
    
    fromList.cards.splice(cardIndex, 1);
    
    let insertIndex = toList.cards.length;
    if (afterElement) {
        const afterCardId = afterElement.dataset.cardId;
        const afterCardIndex = toList.cards.findIndex(c => c.id == afterCardId);
        if (afterCardIndex !== -1) {
            insertIndex = afterCardIndex;
        }
    }
    
    toList.cards.splice(insertIndex, 0, card);
    syncBoardData();
    renderBoard();
}

// ==================== CRÉATION DE CARTES ====================

function addCard(button) {
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

// ==================== IMAGE UTILITIES ====================

function imageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

function resizeImage(file, maxWidth = 400, maxHeight = 300, quality = 0.8) {
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

// ==================== FULLSCREEN IMAGE ====================

function openFullscreenImage(src, alt = '') {
    const fullscreen = document.getElementById('imageFullscreen');
    const fullscreenImg = document.getElementById('fullscreenImg');
    fullscreenImg.src = src;
    fullscreenImg.alt = alt;
    fullscreen.style.display = 'flex';
}

function closeFullscreenImage() {
    const fullscreen = document.getElementById('imageFullscreen');
    fullscreen.style.display = 'none';
}

// ==================== LISTS MANAGEMENT ====================

function addList(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const addListBtn = document.querySelector('.add-list-btn');
    if (!addListBtn) return;
    
    const container = addListBtn.parentElement;
    const listForm = document.createElement('div');
    listForm.className = 'list';
    listForm.style.backgroundColor = 'var(--primary-bg)';

    listForm.innerHTML = `
        <input type="text" class="list-title-input" placeholder="Saisissez le titre de la liste..." />
        <div class="list-actions">
            <button class="list-action-btn save-list">Ajouter une liste</button>
            <button class="list-action-btn cancel cancel-list">×</button>
        </div>
    `;

    container.replaceChild(listForm, addListBtn);

    const input = listForm.querySelector('.list-title-input');
    const saveBtn = listForm.querySelector('.save-list');
    const cancelBtn = listForm.querySelector('.cancel-list');

    input.focus();

    let listSaved = false;

    function saveList() {
        if (listSaved) return;
        
        const title = input.value.trim();
        if (title) {
            listSaved = true;
            
            const newList = {
                id: generateId(),
                title: title,
                cards: []
            };

            boardData.lists.push(newList);
            syncBoardData();

            if (container.contains(listForm)) {
                container.replaceChild(addListBtn, listForm);
            }

            renderBoard();
        } else {
            if (container.contains(listForm)) {
                container.replaceChild(addListBtn, listForm);
            }
        }
    }

    function cancelList() {
        if (container.contains(listForm)) {
            container.replaceChild(addListBtn, listForm);
        }
    }

    saveBtn.addEventListener('click', saveList, { once: true });
    cancelBtn.addEventListener('click', cancelList, { once: true });

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveList();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelList();
        }
    });

    input.addEventListener('blur', function () {
        setTimeout(() => {
            if (document.activeElement !== saveBtn && document.activeElement !== cancelBtn && !listSaved) {
                saveList();
            }
        }, 100);
    });
}

function deleteList(listId) {
    const list = boardData.lists.find(l => l.id === listId);
    if (!list) return;

    const hasCards = list.cards.length > 0;
    let confirmMessage = `Êtes-vous sûr de vouloir supprimer la liste "${list.title}" ?`;
    
    if (hasCards) {
        confirmMessage += `\n\nCette liste contient ${list.cards.length} carte(s) qui seront également supprimées.`;
    }

    if (confirm(confirmMessage)) {
        boardData.lists = boardData.lists.filter(l => l.id !== listId);
        syncBoardData();
        renderBoard();
    }
}

function editListTitle(listElement, listId) {
    const titleElement = listElement.querySelector('.list-header .list-title');
    const currentText = titleElement.textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'list-title-edit-input';

    titleElement.style.display = 'none';
    titleElement.parentNode.insertBefore(input, titleElement);
    input.focus();
    input.select();

    function saveTitle() {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== currentText) {
            const list = boardData.lists.find(l => l.id == listId);
            if (list) {
                list.title = newTitle;
                titleElement.textContent = newTitle;
                syncBoardData();
            }
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

function editCardTitle() {
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

// ==================== TAG MANAGEMENT EXTENDED ====================

function editTag(tagId) {
    hideTagSelector();

    const tag = availableTags.find(t => t.id === tagId);
    if (!tag) return;

    const dialog = document.createElement('div');
    dialog.className = 'tag-selector';
    dialog.style.zIndex = 2001;
    dialog.innerHTML = `
        <div class="tag-selector-header">
            <h3>Modifier l'étiquette</h3>
            <button class="tag-selector-close" onclick="document.body.removeChild(this.closest('.tag-selector'))">×</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
            <input type="text" id="editTagLabel" class="tag-search-input" value="${tag.label}" placeholder="Nom de l'étiquette">
            <div>
                <label>Couleur du fond :</label>
                <input type="color" id="editTagBg" value="${tag.color}" style="margin-left:8px;">
            </div>
            <div>
                <label>Couleur du texte :</label>
                <input type="color" id="editTagText" value="${tag.textColor}" style="margin-left:8px;">
            </div>
            <button class="create-new-tag-btn" id="confirmEditTag">Enregistrer</button>
        </div>
    `;

    document.body.appendChild(dialog);

    document.getElementById('confirmEditTag').onclick = function() {
        const label = document.getElementById('editTagLabel').value.trim();
        const color = document.getElementById('editTagBg').value;
        const textColor = document.getElementById('editTagText').value;
        if (!label) {
            alert('Veuillez entrer un nom pour l\'étiquette.');
            return;
        }
        tag.label = label;
        tag.color = color;
        tag.textColor = textColor;
        syncTagsToBoardData();
        document.body.removeChild(dialog);
        showTagSelector();
        renderBoard();
    };
}

function deleteTag(tagId) {
    if (!confirm('Supprimer cette étiquette ?')) return;
    
    // Retirer le tag de toutes les cartes
    boardData.lists.forEach(list => {
        list.cards.forEach(card => {
            if (card.tags) {
                card.tags = card.tags.filter(tid => tid !== tagId);
            }
        });
    });
    
    // Retirer le tag de la liste des tags
    availableTags = availableTags.filter(t => t.id !== tagId);
    syncTagsToBoardData();
    showTagSelector();
    renderBoard();
}

function showCreateTagDialog() {
    hideTagSelector();

    const dialog = document.createElement('div');
    dialog.className = 'tag-selector';
    dialog.style.zIndex = 2001;
    dialog.innerHTML = `
        <div class="tag-selector-header">
            <h3>Nouvelle étiquette</h3>
            <button class="tag-selector-close" onclick="document.body.removeChild(this.closest('.tag-selector'))">×</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
            <input type="text" id="newTagLabel" class="tag-search-input" placeholder="Nom de l'étiquette">
            <div>
                <label>Couleur du fond :</label>
                <input type="color" id="newTagBg" value="#0079bf" style="margin-left:8px;">
            </div>
            <div>
                <label>Couleur du texte :</label>
                <input type="color" id="newTagText" value="#ffffff" style="margin-left:8px;">
            </div>
            <button class="create-new-tag-btn" id="confirmCreateTag">Créer</button>
        </div>
    `;

    document.body.appendChild(dialog);

    document.getElementById('confirmCreateTag').onclick = function() {
        const label = document.getElementById('newTagLabel').value.trim();
        const color = document.getElementById('newTagBg').value;
        const textColor = document.getElementById('newTagText').value;
        if (!label) {
            alert('Veuillez entrer un nom pour l\'étiquette.');
            return;
        }
        const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 20) + '-' + Date.now();
        availableTags.push({ id, label, color, textColor });
        syncTagsToBoardData();
        document.body.removeChild(dialog);
        showTagSelector();
        renderBoard();
    };
}

function syncTagsToBoardData() {
    boardData.tags = availableTags;
    syncBoardData();
}

function syncTagsFromBoardData() {
    if (Array.isArray(boardData.tags)) {
        availableTags = boardData.tags;
        localStorage.setItem('availableTags', JSON.stringify(availableTags));
    }
}

// ==================== EVENT ATTACHMENT ====================

function attachEvents() {
    // Événements pour les cartes
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', function (e) {
            e.stopPropagation();
            const cardId = this.dataset.cardId;
            const listId = this.closest('.list').dataset.listId;
            openCardModal(cardId, listId);
        });

        // Drag and drop
        card.addEventListener('dragstart', function (e) {
            draggedCard = this;
            draggedFromList = this.closest('.list').dataset.listId;
            this.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            isDraggingCard = true;
            if (!dragAutoScroll.rafId) dragAutoScroll.rafId = requestAnimationFrame(autoScrollLoop);
        });

        card.addEventListener('dragend', function (e) {
            this.classList.remove('dragging');
            draggedCard = null;
            draggedFromList = null;
            isDraggingCard = false;
            if (dragAutoScroll.rafId) {
                cancelAnimationFrame(dragAutoScroll.rafId);
                dragAutoScroll.rafId = null;
            }
        });
    });

    // Événements pour l'édition des titres de listes
    document.querySelectorAll('.list-header .editable-list-title').forEach(titleElement => {
        titleElement.addEventListener('dblclick', function (e) {
            e.stopPropagation();
            const listElement = this.closest('.list');
            const listId = listElement.dataset.listId;
            editListTitle(listElement, listId);
        });
    });

    // Événements pour les listes (drag and drop)
    document.querySelectorAll('.list').forEach(list => {
        const listContent = list.querySelector('.list-content');
        
        list.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            if (draggedCard) {
                const afterElement = getDragAfterElement(listContent, e.clientY);
                const dragIndicator = getOrCreateDropIndicator(list);
                
                if (afterElement == null) {
                    listContent.appendChild(dragIndicator);
                } else {
                    listContent.insertBefore(dragIndicator, afterElement);
                }
                
                dragIndicator.classList.add('active');
            }
        });

        list.addEventListener('dragleave', function (e) {
            if (!this.contains(e.relatedTarget)) {
                const dragIndicator = this.querySelector('.drop-indicator');
                if (dragIndicator) {
                    dragIndicator.classList.remove('active');
                }
            }
        });

        list.addEventListener('drop', function (e) {
            e.preventDefault();
            
            const dragIndicator = this.querySelector('.drop-indicator');
            if (dragIndicator) {
                dragIndicator.remove();
            }

            if (draggedCard) {
                const cardId = draggedCard.dataset.cardId;
                const toListId = this.dataset.listId;
                const afterElement = getDragAfterElement(listContent, e.clientY);
                
                moveCardToPosition(cardId, draggedFromList, toListId, afterElement);
            }
        });
    });

    // Événements pour les boutons d'ajout de cartes
    document.querySelectorAll('.add-card-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            addCard(this);
        });
    });
}

// ==================== MODAL INITIALIZATION ====================

function initializeModalEvents() {
    const closeModal = document.getElementById('closeModal');
    const cardModal = document.getElementById('cardModal');
    const saveDescription = document.getElementById('saveDescription');
    const deleteCardBtn = document.getElementById('deleteCardBtn');
    const modalTitle = document.getElementById('modalTitle');

    if (closeModal) {
        closeModal.addEventListener('click', closeCardModal);
    }

    if (cardModal) {
        cardModal.addEventListener('click', function (e) {
            if (e.target === this) {
                closeCardModal();
            }
        });
    }

    if (saveDescription) {
        saveDescription.addEventListener('click', saveCardChanges);
    }

    if (deleteCardBtn) {
        deleteCardBtn.addEventListener('click', function () {
            if (currentCard && confirm('Êtes-vous sûr de vouloir supprimer cette carte ?')) {
                const targetList = boardData.lists.find(l => l.id === currentListId);
                targetList.cards = targetList.cards.filter(c => c.id != currentCard.id);
                closeCardModal();
                syncBoardData();
                renderBoard();
            }
        });
    }

    if (modalTitle) {
        modalTitle.addEventListener('dblclick', editCardTitle);
    }

    // Menu d'actions
    const moreBtn = document.getElementById('cardMoreActionsBtn');
    if (moreBtn) {
        moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (document.querySelector('.card-modal-action-menu')) {
                closeModalActionMenu();
            } else {
                openModalActionMenu();
            }
        });
    }

    // Fermer le menu quand la modal se ferme
    const closeModalOriginal = closeCardModal;
    closeCardModal = function() {
        closeModalActionMenu();
        closeModalOriginal();
    };

    // Auto-save pour les champs personnalisés
    ['etatField', 'infoSuppField1', 'infoSuppField2', 'localisationField', 'vehiculeField', 'tdField', 'convoiField'].forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('change', saveCardChanges);
            field.addEventListener('input', saveCardChanges);
        }
    });
    
    const etatField = document.getElementById('etatField');
    if (etatField) {
        if (etatField.value) {
            const etatInfo = getEtatLabel(etatField.value);
            etatField.style.backgroundColor = `${etatInfo.color}E6`;
            etatField.style.color = etatInfo.textColor;
        }
        
        etatField.addEventListener('change', function() {
            if (this.value) {
                const etatInfo = getEtatLabel(this.value);
                this.style.backgroundColor = `${etatInfo.color}E6`;
                this.style.color = etatInfo.textColor;
            } else {
                this.style.backgroundColor = '';
                this.style.color = '';
            }
        });
    }
}

function closeModalActionMenu() {
    document.querySelectorAll('.card-modal-action-menu').forEach(m => m.remove());
    document.removeEventListener('keydown', modalMenuKeyHandler);
}
function modalMenuKeyHandler(e){ if(e.key==='Escape') closeModalActionMenu(); }

function openModalActionMenu() {
    if (!currentCard) return;
    closeModalActionMenu();
    const btn = document.getElementById('cardMoreActionsBtn');
    if (!btn) return;
    const list = boardData.lists.find(l => l.cards.some(c => c.id === currentCard.id));
    const listId = list?.id;
    const compactLabel = currentCard.isCompact ? '🗗 Étendre la carte' : '⤡ Compacter la carte';

    const menu = document.createElement('div');
    menu.className = 'card-modal-action-menu';
    menu.innerHTML = `
        <div class="menu-title">Actions</div>
        <button data-act="duplicate">📄 Dupliquer</button>
        <button data-act="compact">${compactLabel}</button>
        <button data-act="labels">🏷️ Gérer les étiquettes</button>
        <button data-act="copy-title">📋 Copier le titre</button>
        <button data-act="delete" class="danger">🗑️ Supprimer</button>
    `;
    btn.parentElement.appendChild(menu);

    menu.querySelectorAll('button').forEach(b => {
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            const act = b.dataset.act;
            if (act === 'duplicate') {
                duplicateCurrentFromModal(listId);
            } else if (act === 'compact') {
                toggleCardCompact(currentCard.id, listId);
            } else if (act === 'labels') {
                if (!document.getElementById('cardModal').classList.contains('active')) {
                    openCardModal(currentCard.id, listId);
                }
                setTimeout(showTagSelector, 30);
            } else if (act === 'copy-title') {
                navigator.clipboard.writeText(currentCard.text || '').then(()=> {
                    b.textContent = '✅ Copié';
                    setTimeout(()=> b.textContent='📋 Copier le titre',1200);
                });
            } else if (act === 'delete') {
                document.getElementById('deleteCardBtn')?.click();
            }
            if (act !== 'copy-title') closeModalActionMenu();
        });
    });

    setTimeout(() => {
        document.addEventListener('click', outsideModalMenu, { once: true });
    }, 0);
    function outsideModalMenu(ev) {
        if (!menu.contains(ev.target) && ev.target !== btn) closeModalActionMenu();
    }
    document.addEventListener('keydown', modalMenuKeyHandler);
}

function duplicateCurrentFromModal(listId) {
    if (!currentCard || !listId) return;
    const list = boardData.lists.find(l => l.id === listId);
    if (!list) return;
    const idx = list.cards.findIndex(c => c.id === currentCard.id);
    if (idx === -1) return;
    const clone = JSON.parse(JSON.stringify(currentCard));
    clone.id = generateId();
    clone.text = (clone.text || '');
    list.cards.splice(idx + 1, 0, clone);
    syncBoardData();
    renderBoard();
}

// ==================== INITIALIZATION ====================

function initialize() {
    renderBoard();
    initializeModalEvents();

    const addListBtn = document.querySelector('.add-list-btn');
    if (addListBtn) {
        addListBtn.replaceWith(addListBtn.cloneNode(true));
        document.querySelector('.add-list-btn').addEventListener('click', addList);
    }

    // Initialiser les événements fullscreen
    const fullscreen = document.getElementById('imageFullscreen');
    const closeBtn = fullscreen?.querySelector('.close-fullscreen');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeFullscreenImage);
    }

    if (fullscreen) {
        fullscreen.addEventListener('click', (e) => {
            if (e.target === fullscreen) closeFullscreenImage();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeFullscreenImage();
    });
}

// === Auto-scroll pendant drag ===
let isDraggingCard = false;
let dragPointer = { x: 0, y: 0 };
let dragAutoScroll = { rafId: null };

document.addEventListener('dragover', e => {
    if (isDraggingCard) {
        dragPointer.x = e.clientX;
        dragPointer.y = e.clientY;
    }
});

function autoScrollLoop() {
    if (!isDraggingCard) return;

    const boardContainer = document.querySelector('.board-container');
    if (boardContainer) {
        const rect = boardContainer.getBoundingClientRect();
        const hEdge = 80;
        if (dragPointer.x - rect.left < hEdge) boardContainer.scrollLeft -= 20;
        else if (rect.right - dragPointer.x < hEdge) boardContainer.scrollLeft += 20;
    }

    const under = document.elementFromPoint(dragPointer.x, dragPointer.y);
    const listContent = under?.closest('.list')?.querySelector('.list-content');
    if (listContent) {
        const lr = listContent.getBoundingClientRect();
        const vEdge = 60;
        if (dragPointer.y - lr.top < vEdge) listContent.scrollTop -= 18;
        else if (lr.bottom - dragPointer.y < vEdge) listContent.scrollTop += 18;
    }

    dragAutoScroll.rafId = requestAnimationFrame(autoScrollLoop);
}

// ==================== UTILITY FUNCTIONS ====================

// Nettoyer les verrous en cas de problème
function cleanupStaleCreations() {
    const activeInputs = document.querySelectorAll('.edit-input');
    const activeListIds = new Set();
    
    activeInputs.forEach(input => {
        const listId = input.closest('.list')?.dataset.listId;
        if (listId) {
            activeListIds.add(listId);
        }
    });

    for (const listId of activeCardCreations) {
        if (!activeListIds.has(listId)) {
            activeCardCreations.delete(listId);
        }
    }
}

// Nettoyer périodiquement
setInterval(cleanupStaleCreations, 10000);

// ==================== GLOBAL EXPORTS ====================

// Rendre les fonctions globales pour les onclick dans le HTML
window.toggleCardCompact = toggleCardCompact;
window.deleteList = deleteList;
window.removeTag = removeTag;
window.showTagSelector = showTagSelector;
window.hideTagSelector = hideTagSelector;
window.toggleTagFromCheckbox = toggleTagFromCheckbox;
window.editTag = editTag;
window.deleteTag = deleteTag;
window.showCreateTagDialog = showCreateTagDialog;
window.openFullscreenImage = openFullscreenImage;
window.closeFullscreenImage = closeFullscreenImage;
window.openModalActionMenu = openModalActionMenu;
window.updateSingleCardDOM = updateSingleCardDOM;

// ==================== DOM READY ====================

document.addEventListener('DOMContentLoaded', initialize);