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
        board.appendChild(listEl);
    });

    attachEvents();
    
    requestAnimationFrame(() => {
        if (preserveScroll) restoreScrollState(scrollState);
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
                <button class="compact-card-btn" onclick="toggleCardCompact('${card.id}', '${listId}')" title="Compacter la carte">⤡</button>
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
