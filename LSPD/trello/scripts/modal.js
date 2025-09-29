import { boardData, currentCard, currentListId, setCurrentCard, setCurrentListId, availableTags } from './state.js';
import { syncBoardData } from './socket.js';
import { saveCardChanges, editCardTitle, toggleCardCompact } from './card.js';
import { getEtatLabel, generateId } from './utils.js';
import { renderBoard } from './board.js';
import { renderCardTags, hideTagSelector, showTagSelector } from './tags.js';

export function openCardModal(cardId, listId) {
    const list = boardData.lists.find(l => l.id == listId);
    if (!list) return;
    const card = list.cards.find(c => c.id == cardId);
    if (!card) return;

    setCurrentCard(card);
    setCurrentListId(listId);

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

export function closeCardModal() {
    document.getElementById('cardModal').classList.remove('active');
    hideTagSelector();
    setCurrentCard(null);
    setCurrentListId(null);
}

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
