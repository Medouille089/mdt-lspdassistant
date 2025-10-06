import { boardData, availableTags, setAvailableTags, currentCard, currentListId } from './state.js';
import { submitOperation } from './socket.js';
import { getCardTags, extractAutoTags } from './utils.js';
import { saveCardChanges } from './card.js';
import { renderBoard } from './board.js';

export function syncTagsFromBoardData() {
    if (Array.isArray(boardData.tags)) {
        setAvailableTags(boardData.tags);
    }
}

export function renderCardTags() {
    const tagsContainer = document.getElementById('tagsContainer');
    tagsContainer.innerHTML = '';

    const cardTags = getCardTags(currentCard, availableTags);

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
        <div class="tag-item-row" draggable="true" data-tag-id="${tag.id}">
            <span class="tag-drag-handle">⋮⋮</span>
            <label class="tag-row" style="background-color: ${tag.color}; color: ${tag.textColor}; display: flex; align-items: center; padding: 8px 12px; border-radius: 4px; gap: 8px; flex: 1; cursor: pointer;">
                <input type="checkbox" class="tag-checkbox" ${cardTags.includes(tag.id) ? 'checked' : ''} onchange="toggleTagFromCheckbox('${tag.id}', this.checked)" style="margin: 0; width: 20px; height: 20px;">
                <span class="tag-label" style="flex: 1; font-size: 14px; font-weight: 500;">${tag.label}</span>
            </label>
            <button class="tag-edit-btn" title="Modifier" onclick="editTag('${tag.id}')" style="background: none; border: none; padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                ✎
            </button>
            <button class="tag-delete-btn" title="Supprimer" onclick="deleteTag('${tag.id}')" style="background: none; border: none; padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                🗑️
            </button>
        </div>
    `;
}

function renderTagsList(availableTagsList, cardTags) {
    return availableTagsList.map(tag => renderTagRow(tag, cardTags)).join('');
}

export function showTagSelector() {
    const existingSelector = document.querySelector('.tag-selector');
    if (existingSelector) {
        existingSelector.remove();
        return;
    }

    const cardTags = getCardTags(currentCard, availableTags);
    const selector = document.createElement('div');
    selector.className = 'tag-selector';

    selector.innerHTML = `
        <div class="tag-selector-header">
            <h3>Étiquettes</h3>
            <button class="tag-selector-close" onclick="hideTagSelector()">×</button>
        </div>
        <div class="tags-list-section">
            <div class="tags-list" id="sortable-tags-list">
                ${renderTagsList(availableTags, cardTags)}
            </div>
        </div>
        <button class="create-new-tag-btn" onclick="showCreateTagDialog()">Créer une nouvelle étiquette</button>
    `;

    document.getElementById('tagsContainer').appendChild(selector);
    attachTagDragEvents();
}

export function hideTagSelector() {
    const selector = document.querySelector('.tag-selector');
    if (selector) selector.remove();
}

export function toggleTagFromCheckbox(tagId, isChecked) {
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

export function removeTag(tagId) {
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

export function editTag(tagId) {
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
        submitOperation('UPSERT_TAG', { tag: { ...tag }, position: availableTags.findIndex(t => t.id === tag.id) });
        document.body.removeChild(dialog);
        showTagSelector();
        renderBoard();
    };
}

export function deleteTag(tagId) {
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
    const newAvailableTags = availableTags.filter(t => t.id !== tagId);
    setAvailableTags(newAvailableTags);
    syncTagsToBoardData();
    submitOperation('DELETE_TAG', { tagId });
    showTagSelector();
    renderBoard();
}

export function showCreateTagDialog() {
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
        const newTag = { id, label, color, textColor };
        const newAvailableTags = [...availableTags, newTag];
        setAvailableTags(newAvailableTags);
        syncTagsToBoardData();
        submitOperation('UPSERT_TAG', { tag: newTag, position: newAvailableTags.length - 1 });
        document.body.removeChild(dialog);
        showTagSelector();
        renderBoard();
    };
}

function syncTagsToBoardData() {
    boardData.tags = availableTags.map(tag => ({ ...tag }));
    submitOperation();
}

function attachTagDragEvents() {
    const tagsList = document.getElementById('sortable-tags-list');
    if (!tagsList) return;

    let draggedElement = null;
    let draggedTagId = null;

    tagsList.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('tag-item-row')) {
            draggedElement = e.target;
            draggedTagId = e.target.dataset.tagId;
            e.target.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        }
    });

    tagsList.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('tag-item-row')) {
            e.target.classList.remove('dragging');
            // Nettoyer tous les indicateurs de drop
            tagsList.querySelectorAll('.tag-item-row').forEach(row => {
                row.classList.remove('drag-over');
            });
            draggedElement = null;
            draggedTagId = null;
        }
    });

    tagsList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(tagsList, e.clientY);
        
        // Nettoyer les anciens indicateurs
        tagsList.querySelectorAll('.tag-item-row').forEach(row => {
            row.classList.remove('drag-over');
        });

        if (afterElement == null) {
            // Ajouter à la fin
            const lastRow = tagsList.querySelector('.tag-item-row:last-child');
            if (lastRow && lastRow !== draggedElement) {
                lastRow.classList.add('drag-over');
            }
        } else if (afterElement !== draggedElement) {
            afterElement.classList.add('drag-over');
        }
    });

    tagsList.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!draggedElement || !draggedTagId) return;

        const afterElement = getDragAfterElement(tagsList, e.clientY);
        
        // Trouver les indices dans le tableau des étiquettes
        const draggedIndex = availableTags.findIndex(tag => tag.id === draggedTagId);
        if (draggedIndex === -1) return;

        let newIndex;
        if (afterElement == null) {
            // Déplacer à la fin
            newIndex = availableTags.length - 1;
        } else {
            const afterTagId = afterElement.dataset.tagId;
            const afterIndex = availableTags.findIndex(tag => tag.id === afterTagId);
            newIndex = Math.max(0, afterIndex);
        }

        // Réorganiser le tableau des étiquettes
        if (draggedIndex !== newIndex) {
            const [draggedTag] = availableTags.splice(draggedIndex, 1);
            availableTags.splice(newIndex, 0, draggedTag);
            syncTagsToBoardData();
            submitOperation('REORDER_TAGS', {
                orderedTagIds: availableTags.map(tag => tag.id)
            });
            
            // Mettre à jour l'affichage de toutes les cartes pour refléter le nouvel ordre
            updateAllCardsTagsDisplay();
            
            // Re-rendre la liste des étiquettes
            updateTagsList();
        }

        // Nettoyer les indicateurs
        tagsList.querySelectorAll('.tag-item-row').forEach(row => {
            row.classList.remove('drag-over');
        });
    });
}

function updateAllCardsTagsDisplay() {
    console.log('Mise à jour de l\'ordre des étiquettes sur toutes les cartes');
    
    // Mettre à jour l'affichage des étiquettes dans la modal si elle est ouverte
    if (currentCard && document.getElementById('cardModal').classList.contains('active')) {
        renderCardTags();
    }
    
    // Re-rendre tout le board pour mettre à jour l'affichage des étiquettes sur les cartes
    import('./board.js').then(boardModule => {
        boardModule.renderBoard(true); // Préserver le scroll
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.tag-item-row:not(.dragging)')];
    
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

function updateTagsList() {
    const cardTags = getCardTags(currentCard, availableTags);
    const tagsList = document.getElementById('sortable-tags-list');
    if (tagsList) {
        tagsList.innerHTML = renderTagsList(availableTags, cardTags);
        attachTagDragEvents();
    }
}
