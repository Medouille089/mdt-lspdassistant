import { boardData, scrollState, activeCardCreations, availableTags } from './state.js';
import { captureScrollState, restoreScrollState, getCardTags, generateCustomFieldsHtml, extractShortId, generateId } from './utils.js';
import { syncBoardData } from './socket.js';
import { attachCardEvents } from './card.js';
import { attachDragDropEvents } from './dragdrop.js';
import { initializeModalEvents, openCardModal } from './modal.js';

export function renderBoard(preserveScroll = true) {
    if (preserveScroll) captureScrollState(scrollState);
    const board = document.querySelector('.board');

    // Sauvegarder les états des inputs actifs
    const activeInputs = new Map();
    document.querySelectorAll('.simple-card-creator').forEach(creator => {
        const listId = creator.closest('.list')?.dataset.listId;
        if (listId && activeCardCreations.has(listId)) {
            const textarea = creator.querySelector('.edit-input');
            const imagePreview = creator.querySelector('.image-preview-container');
            activeInputs.set(listId, {
                value: textarea?.value || '',
                focused: document.activeElement === textarea,
                hasImage: imagePreview?.style.display === 'flex',
                imageHtml: imagePreview?.querySelector('.image-preview')?.innerHTML || ''
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
                <button class="list-menu-btn" data-list-id="${list.id}">⋯</button>
            </div>
            <div class="list-content">
                ${cardsHtml}
                <button class="add-card-btn">+ Ajouter une carte</button>
            </div>
        `;
        board.appendChild(listEl);
    });

    attachEvents();

    // Restaurer les créateurs de cartes actifs APRÈS le rendu
    requestAnimationFrame(() => {
        if (preserveScroll) restoreScrollState(scrollState);

        // Restaurer les créateurs de cartes
        activeInputs.forEach((inputData, listId) => {
            const list = document.querySelector(`.list[data-list-id="${listId}"]`);
            if (list && !list.querySelector('.simple-card-creator')) {
                const addButton = list.querySelector('.add-card-btn');
                if (addButton) {
                    // Recréer le créateur de carte
                    recreateCardCreator(addButton, listId, inputData);
                }
            }
        });
    });
}

function renderCard(card, listId) {
    const cardTags = getCardTags(card, availableTags);
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
            </div>
        </div>
    `;
}

export function updateSingleCardDOM(cardId, listId) {
    const list = boardData.lists.find(l => l.id == listId);
    if (!list) return;
    const card = list.cards.find(c => c.id == cardId);
    if (!card) return;

    const listContentEl = document.querySelector(`.list[data-list-id="${listId}"] .list-content`);
    const prevScrollTop = listContentEl ? listContentEl.scrollTop : 0;

    const tmp = document.createElement('div');
    tmp.innerHTML = renderCard(card, listId).trim();
    const newCardEl = tmp.firstElementChild;
    const oldCardEl = document.querySelector(`.card[data-card-id="${cardId}"]`);
    if (oldCardEl && newCardEl) {
        oldCardEl.replaceWith(newCardEl);
        newCardEl.addEventListener('click', function (e) {
            e.stopPropagation();
            openCardModal(cardId, listId);
        });
    }

    if (listContentEl) listContentEl.scrollTop = prevScrollTop;
}

function attachEvents() {
    attachCardEvents();
    attachDragDropEvents();

    // Événements pour l'édition des titres de listes
    document.querySelectorAll('.list-header .editable-list-title').forEach(titleElement => {
        titleElement.addEventListener('dblclick', function (e) {
            e.stopPropagation();
            const listElement = this.closest('.list');
            const listId = listElement.dataset.listId;
            editListTitle(listElement, listId);
        });
    });

    // Événements pour les menus de tri des listes
    document.querySelectorAll('.list-menu-btn').forEach(menuBtn => {
        menuBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            const listId = this.dataset.listId;
            openListSortMenu(this, listId);
        });
    });
}

export function initialize() {
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

export function openFullscreenImage(src, alt = '') {
    const fullscreen = document.getElementById('imageFullscreen');
    const fullscreenImg = document.getElementById('fullscreenImg');
    fullscreenImg.src = src;
    fullscreenImg.alt = alt;
    fullscreen.style.display = 'flex';
}

export function closeFullscreenImage() {
    const fullscreen = document.getElementById('imageFullscreen');
    fullscreen.style.display = 'none';
}

function recreateCardCreator(button, listId, inputData) {
    if (!activeCardCreations.has(listId)) {
        activeCardCreations.add(listId);
    }

    const cardCreator = document.createElement('div');
    cardCreator.className = 'simple-card-creator';
    cardCreator.innerHTML = `
        <textarea class="edit-input" placeholder="Entrez le titre de la carte...">${inputData.value}</textarea>
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
        <div class="image-preview-container" style="display: ${inputData.hasImage ? 'flex' : 'none'};">
            <div class="image-preview">${inputData.imageHtml}</div>
            <button class="remove-image">✕</button>
        </div>
    `;

    button.style.display = 'none';
    const listContent = button.parentElement;
    listContent.insertBefore(cardCreator, button);

    // Réattacher les événements
    import('./card.js').then(cardModule => {
        cardModule.setupCardCreator(cardCreator, listId, button);

        // Restaurer le focus si nécessaire
        if (inputData.focused) {
            const textarea = cardCreator.querySelector('.edit-input');
            if (textarea) {
                textarea.focus();
                // Positionner le curseur à la fin du texte
                textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            }
        }
    });
}

function openListSortMenu(button, listId) {
    // Fermer tout menu existant
    closeListSortMenu();

    const menu = document.createElement('div');
    menu.className = 'list-sort-menu';
    menu.innerHTML = `
        <div class="list-sort-menu-header">
            <div class="list-sort-menu-title">Trier les cartes</div>
        </div>
        <button class="list-sort-option" data-sort="alpha-asc">
            Titre (A-Z)
        </button>
        <button class="list-sort-option" data-sort="alpha-desc">
            Titre (Z-A)
        </button>
    `;

    // Positionner le menu
    const listHeader = button.closest('.list-header');
    listHeader.style.position = 'relative';
    listHeader.appendChild(menu);

    // Ajouter les gestionnaires d'événements
    menu.querySelectorAll('.list-sort-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const sortType = option.dataset.sort;
            sortListCards(listId, sortType);
            closeListSortMenu();
        });
    });

    // Fermer le menu en cliquant ailleurs
    setTimeout(() => {
        document.addEventListener('click', closeListSortMenu, { once: true });
    }, 0);

    // Fermer avec Escape
    document.addEventListener('keydown', handleEscapeKey);
}

function closeListSortMenu() {
    document.querySelectorAll('.list-sort-menu').forEach(menu => menu.remove());
    document.removeEventListener('keydown', handleEscapeKey);
}

function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        closeListSortMenu();
    }
}

function sortListCards(listId, sortType) {
    const list = boardData.lists.find(l => l.id == listId);
    if (!list) return;

    const cards = [...list.cards];

    switch (sortType) {
        case 'alpha-asc':
            cards.sort((a, b) => (a.text || '').localeCompare(b.text || ''));
            break;
        case 'alpha-desc':
            cards.sort((a, b) => (b.text || '').localeCompare(a.text || ''));
            break;
    }

    list.cards = cards;
    syncBoardData();
    renderBoard();
}
