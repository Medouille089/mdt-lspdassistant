import { boardData, currentCard, currentListId, setCurrentCard, setCurrentListId, availableTags } from './state.js';
import { saveCardChanges, editCardTitle, toggleCardCompact } from './card.js';
import { getEtatLabel, generateId } from './utils.js';
import { renderBoard } from './board.js';
import { renderCardTags, hideTagSelector, showTagSelector } from './tags.js';
import { submitOperation } from './socket.js';
import { handleRookiePatrolDeletion } from './rookieTracker.js';

export function openCardModal(cardId, listId) {
    const list = boardData.lists.find(l => l.id == listId);
    if (!list) return;
    const card = list.cards.find(c => c.id == cardId);
    if (!card) return;

    setCurrentCard(card);
    setCurrentListId(listId);

    // Remplir les champs
    document.getElementById('modalTitle').textContent = card.text;

    // Initialiser la description
    initializeDescription(card.description || '');

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

    // S'assurer qu'on commence en mode affichage (après l'activation du modal)
    setTimeout(() => {
        // Initialiser la description avec celle de la carte
        const descriptionContainer = document.getElementById('descriptionContainer');
        if (descriptionContainer) {
            initializeDescription(card.description);
        }
    }, 10);
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
                    style="max-width: 100%; max-height: 300px; object-fit: contain; border-radius: 8px; cursor: zoom-in;"
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
export function closeCardModal() {
    document.getElementById('cardModal').classList.remove('active');
    hideTagSelector();
    setCurrentCard(null);
    setCurrentListId(null);
}

let isEditingDescription = false;

function initializeDescription(description) {
    const container = document.getElementById('descriptionContainer');
    if (!container) return;

    isEditingDescription = false;
    const maxLength = 150; // Caractères avant "Afficher plus"

    if (!description || description.trim() === '') {
        container.innerHTML = `
            <div class="description-text clickable" onclick="startEditDescription()">
                <span class="no-description">Cliquez pour ajouter une description...</span>
            </div>
        `;
        return;
    }

    const text = description.trim();

    if (text.length <= maxLength) {
        // Description courte - affichage complet et cliquable
        container.innerHTML = `
            <div class="description-text clickable" onclick="startEditDescription()">
                ${formatDescriptionText(text)}
            </div>
        `;
    } else {
        // Description longue - système "Afficher plus"
        const truncatedText = text.substring(0, maxLength);
        container.innerHTML = `
            <div class="description-text" id="descriptionPreview">
                ${formatDescriptionText(truncatedText)}...
                <span class="show-more-link" onclick="event.stopPropagation(); toggleDescriptionView(true)">Afficher plus</span>
            </div>
            <div class="description-text clickable" id="descriptionFull" style="display: none;" onclick="startEditDescription()">
                ${formatDescriptionText(text)}
                <span class="show-less-link" onclick="event.stopPropagation(); toggleDescriptionView(false)">Afficher moins</span>
            </div>
        `;
    }
}

function formatDescriptionText(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
}

function toggleDescriptionView(showFull) {
    const preview = document.getElementById('descriptionPreview');
    const full = document.getElementById('descriptionFull');

    if (showFull) {
        preview.style.display = 'none';
        full.style.display = 'block';
    } else {
        preview.style.display = 'block';
        full.style.display = 'none';
    }
}

function startEditDescription() {
    if (isEditingDescription) return;

    const container = document.getElementById('descriptionContainer');
    const currentDesc = currentCard ? currentCard.description || '' : '';

    isEditingDescription = true;
    container.innerHTML = `
        <textarea class="description-textarea" id="descriptionTextarea" placeholder="Ajouter une description...">${currentDesc}</textarea>
        <div class="description-actions">
            <button class="save-btn" onclick="saveDescription()">Enregistrer</button>
            <button class="cancel-btn" onclick="cancelEditDescription()">Annuler</button>
        </div>
    `;

    document.getElementById('descriptionTextarea').focus();
}

function saveDescription() {
    const textarea = document.getElementById('descriptionTextarea');
    if (!textarea || !currentCard) return;

    const newDescription = textarea.value;
    currentCard.description = newDescription;

    // Sauvegarder les changements
    saveCardChanges();

    // Revenir à l'affichage avec la nouvelle description
    isEditingDescription = false;
    initializeDescription(newDescription);
}

function cancelEditDescription() {
    const currentDesc = currentCard ? currentCard.description || '' : '';
    initializeDescription(currentDesc);
}

// Fonction globale pour le toggle
window.toggleDescriptionView = function (showFull) {
    const preview = document.getElementById('descriptionPreview');
    const full = document.getElementById('descriptionFull');

    if (preview && full) {
        if (showFull) {
            preview.style.display = 'none';
            full.style.display = 'block';
        } else {
            preview.style.display = 'block';
            full.style.display = 'none';
        }
    }
};

// Fonctions globales pour les onclick
window.startEditDescription = startEditDescription;
window.saveDescription = saveDescription;
window.cancelEditDescription = cancelEditDescription;

export function initializeModalEvents() {
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

    // Note: La gestion de la description est maintenant faite via les fonctions globales

    if (deleteCardBtn) {
        deleteCardBtn.addEventListener('click', function () {
            if (currentCard && confirm('Êtes-vous sûr de vouloir supprimer cette carte ?')) {
                const targetList = boardData.lists.find(l => l.id === currentListId);
                if (targetList) {
                    handleRookiePatrolDeletion(currentCard.id, { force: Boolean(currentCard.text?.includes('+')) });
                    targetList.cards = targetList.cards.filter(c => c.id !== currentCard.id);
                }
                closeCardModal();
                submitOperation('DELETE_CARD', { listId: currentListId, cardId: currentCard.id });
                renderBoard();
            }
        });
    }

    if (modalTitle) {
        modalTitle.addEventListener('dblclick', editCardTitle);
    }

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

    const closeModalOriginal = closeCardModal;
    closeCardModal = function () {
        closeModalActionMenu();
        closeModalOriginal();
    };

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

        etatField.addEventListener('change', function () {
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

function modalMenuKeyHandler(e) { if (e.key === 'Escape') closeModalActionMenu(); }

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
        <button data-act="copy-title">📋 Copier le titre</button>
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
                setTimeout(showTagSelector, 30);
            } else if (act === 'copy-title') {
                navigator.clipboard.writeText(currentCard.text || '').then(() => {
                    b.textContent = '✅ Copié';
                    setTimeout(() => b.textContent = '📋 Copier le titre', 1200);
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
    submitOperation('CREATE_CARD', { listId, card: clone, position: idx + 1 });
    renderBoard();
}