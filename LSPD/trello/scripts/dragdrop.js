import { boardData, draggedCard, draggedFromList, setDraggedCard, setDraggedFromList, canManageLists } from './state.js';
import { submitOperation } from './socket.js';
import { renderBoard } from './board.js';

let isDraggingCard = false;
let isDraggingList = false;
let draggedList = null;
let dragPointer = { x: 0, y: 0 };
let dragAutoScroll = { rafId: null };

document.addEventListener('dragover', e => {
    if (isDraggingCard || isDraggingList) {
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

export function attachDragDropEvents() {
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('dragstart', function (e) {
            setDraggedCard(this);
            setDraggedFromList(this.closest('.list').dataset.listId);
            this.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            isDraggingCard = true;
            if (!dragAutoScroll.rafId) dragAutoScroll.rafId = requestAnimationFrame(autoScrollLoop);
        });

        card.addEventListener('dragend', function (e) {
            this.classList.remove('dragging');
            setDraggedCard(null);
            setDraggedFromList(null);
            isDraggingCard = false;
            if (dragAutoScroll.rafId) {
                cancelAnimationFrame(dragAutoScroll.rafId);
                dragAutoScroll.rafId = null;
            }
            document.querySelectorAll('.list').forEach(list => {
                list.classList.remove('drag-over');
            });
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

    // Événements pour drag and drop des listes
    document.querySelectorAll('.list').forEach(list => {
        const listHeader = list.querySelector('.list-header');
        
        if (!listHeader) return;
        
        // Vérifier les permissions avant d'activer le drag
        if (!canManageLists()) {
            listHeader.removeAttribute('draggable');
            listHeader.style.cursor = 'default';
            return;
        }
        
        listHeader.addEventListener('dragstart', function (e) {
            // Si on clique sur le bouton menu ou le titre editable, ne pas démarrer le drag
            if (e.target.closest('.list-menu-btn') || e.target.closest('.editable-list-title')) {
                e.preventDefault();
                return;
            }
            
            draggedList = list;
            list.classList.add('dragging-list');
            e.dataTransfer.effectAllowed = 'move';
            isDraggingList = true;
            
            // Créer une image de drag personnalisée
            const dragImage = list.cloneNode(true);
            dragImage.style.opacity = '0.5';
            dragImage.style.position = 'absolute';
            dragImage.style.top = '-9999px';
            document.body.appendChild(dragImage);
            e.dataTransfer.setDragImage(dragImage, 0, 0);
            setTimeout(() => document.body.removeChild(dragImage), 0);
        });

        listHeader.addEventListener('dragend', function (e) {
            if (draggedList) {
                draggedList.classList.remove('dragging-list');
                draggedList = null;
            }
            isDraggingList = false;
            
            // Nettoyer les indicateurs
            document.querySelectorAll('.list-drop-indicator').forEach(ind => ind.remove());
        });
    });

    // Événements pour la zone de board (pour placer les listes)
    const board = document.querySelector('.board');
    if (board) {
        board.addEventListener('dragover', function (e) {
            if (!isDraggingList || !draggedList) return;
            
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const afterElement = getListAfterElement(board, e.clientX);
            const indicator = getOrCreateListDropIndicator();
            
            if (afterElement == null) {
                // Ajouter à la fin (avant le bouton add-list)
                const addListBtn = board.querySelector('.add-list-btn');
                if (addListBtn) {
                    board.insertBefore(indicator, addListBtn);
                } else {
                    board.appendChild(indicator);
                }
            } else {
                board.insertBefore(indicator, afterElement);
            }
            
            indicator.classList.add('active');
        });

        board.addEventListener('drop', function (e) {
            if (!isDraggingList || !draggedList) return;
            
            e.preventDefault();
            
            const listId = draggedList.dataset.listId;
            const afterElement = getListAfterElement(board, e.clientX);
            
            moveListToPosition(listId, afterElement);
            
            // Nettoyer l'indicateur
            document.querySelectorAll('.list-drop-indicator').forEach(ind => ind.remove());
        });
    }
}

function getListAfterElement(board, x) {
    const draggableElements = [...board.querySelectorAll('.list:not(.dragging-list)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function getOrCreateListDropIndicator() {
    let indicator = document.querySelector('.list-drop-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'list-drop-indicator';
    }
    return indicator;
}

function moveListToPosition(listId, afterElement) {
    const listIndex = boardData.lists.findIndex(l => l.id == listId);
    if (listIndex === -1) return;
    
    const list = boardData.lists[listIndex];
    
    // Calculer l'index d'insertion AVANT de retirer la liste
    let insertIndex = boardData.lists.length;
    if (afterElement) {
        const afterListId = afterElement.dataset.listId;
        const afterListIndex = boardData.lists.findIndex(l => l.id == afterListId);
        if (afterListIndex !== -1) {
            insertIndex = afterListIndex;
            // Si on déplace vers la droite, ajuster l'index car on va retirer la liste avant
            if (listIndex < afterListIndex) {
                insertIndex--;
            }
        }
    }
    
    // Retirer la liste de sa position actuelle
    boardData.lists.splice(listIndex, 1);
    
    // Insérer à la nouvelle position
    boardData.lists.splice(insertIndex, 0, list);
    
    const orderedListIds = boardData.lists.map(l => l.id);
    submitOperation('REORDER_LISTS', { orderedListIds });
    renderBoard();
}

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
    submitOperation('MOVE_CARD', { cardId, fromListId, toListId, targetIndex: insertIndex });
    renderBoard();
}
