import { boardData, draggedCard, draggedFromList, setDraggedCard, setDraggedFromList, canManageLists } from './state.js';
import { submitOperation } from './socket.js';
import { renderBoard } from './board.js';

let isDraggingCard = false;
let isDraggingList = false;
let draggedList = null;
let dragPointer = { x: 0, y: 0 };
let dragAutoScroll = { rafId: null };

// Variables pour Pointer Events (FiveM compatible)
let pointerDraggedCard = null;
let pointerDraggedFromList = null;
let pointerOffsetX = 0;
let pointerOffsetY = 0;
let dragClone = null;
let dropIndicator = null;
let isDraggingWithPointer = false;
let pointerDownPos = { x: 0, y: 0 };
let dragStarted = false;
const DRAG_THRESHOLD = 5; // pixels de mouvement avant de démarrer le drag

document.addEventListener('dragover', e => {
    if (isDraggingCard || isDraggingList) {
        dragPointer.x = e.clientX;
        dragPointer.y = e.clientY;
    }
});

function autoScrollLoop() {
    if (!isDraggingCard && !isDraggingWithPointer) return;

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
    // NOUVEAU: Utiliser Pointer Events pour FiveM (CEF compatible)
    document.querySelectorAll('.card').forEach(card => {
        // Désactiver le drag HTML5 natif qui ne fonctionne pas dans FiveM
        card.setAttribute('draggable', 'false');
        
        card.addEventListener('pointerdown', function (e) {
            // Ignorer clic droit et clic du milieu
            if (e.button !== 0) return;
            
            // Ne pas démarrer le drag si on clique sur un bouton ou input
            if (e.target.closest('button, input, select, textarea, .modal')) return;
            
            // NE PAS preventDefault ici pour permettre les clics normaux
            
            const rect = this.getBoundingClientRect();
            pointerOffsetX = e.clientX - rect.left;
            pointerOffsetY = e.clientY - rect.top;
            pointerDownPos = { x: e.clientX, y: e.clientY };
            
            pointerDraggedCard = this;
            pointerDraggedFromList = this.closest('.list').dataset.listId;
            dragStarted = false;
            
            // Capture du pointer pour continuer à recevoir les événements
            this.setPointerCapture(e.pointerId);
        });
        
        card.addEventListener('pointermove', function (e) {
            if (!pointerDraggedCard) return;
            
            // Vérifier si on a bougé assez pour commencer le drag
            const dx = e.clientX - pointerDownPos.x;
            const dy = e.clientY - pointerDownPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Si on n'a pas encore démarré le drag et qu'on n'a pas bougé assez, on ne fait rien
            if (!dragStarted && distance < DRAG_THRESHOLD) return;
            
            // Premier mouvement > seuil : démarrer le drag
            if (!dragStarted) {
                e.preventDefault();
                dragStarted = true;
                
                const rect = pointerDraggedCard.getBoundingClientRect();
                
                // Créer un clone pour le drag
                dragClone = pointerDraggedCard.cloneNode(true);
                dragClone.style.position = 'fixed';
                dragClone.style.width = rect.width + 'px';
                dragClone.style.height = rect.height + 'px';
                dragClone.style.left = rect.left + 'px';
                dragClone.style.top = rect.top + 'px';
                dragClone.style.opacity = '0.8';
                dragClone.style.pointerEvents = 'none';
                dragClone.style.zIndex = '10000';
                dragClone.style.transform = 'rotate(3deg)';
                dragClone.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)';
                dragClone.classList.add('dragging-clone');
                document.body.appendChild(dragClone);
                
                // Rendre la carte originale semi-transparente
                pointerDraggedCard.style.opacity = '0.3';
                
                isDraggingWithPointer = true;
                
                if (!dragAutoScroll.rafId) dragAutoScroll.rafId = requestAnimationFrame(autoScrollLoop);
            }
            
            if (!isDraggingWithPointer) return;
            
            e.preventDefault();
            
            dragPointer.x = e.clientX;
            dragPointer.y = e.clientY;
            
            // Déplacer le clone
            if (dragClone) {
                dragClone.style.left = (e.clientX - pointerOffsetX) + 'px';
                dragClone.style.top = (e.clientY - pointerOffsetY) + 'px';
            }
            
            // Trouver la liste sous le curseur
            const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
            const targetList = elementBelow?.closest('.list');
            
            if (targetList) {
                const listContent = targetList.querySelector('.list-content');
                const afterElement = getPointerDragAfterElement(listContent, e.clientY);
                
                // Créer ou déplacer l'indicateur de drop
                if (!dropIndicator) {
                    dropIndicator = document.createElement('div');
                    dropIndicator.className = 'drop-indicator active';
                    dropIndicator.style.height = '8px';
                    dropIndicator.style.background = 'linear-gradient(90deg, #0079bf, #00a8ff)';
                    dropIndicator.style.borderRadius = '4px';
                    dropIndicator.style.margin = '4px 0';
                    dropIndicator.style.pointerEvents = 'none';
                }
                
                if (afterElement) {
                    listContent.insertBefore(dropIndicator, afterElement);
                } else {
                    const addBtn = listContent.querySelector('.add-card-btn');
                    if (addBtn) {
                        listContent.insertBefore(dropIndicator, addBtn);
                    } else {
                        listContent.appendChild(dropIndicator);
                    }
                }
            }
        });
        
        card.addEventListener('pointerup', function (e) {
            if (!pointerDraggedCard) return;
            
            // Si on n'a jamais démarré le drag (mouvement < seuil), c'est un simple clic
            // On laisse l'événement click se propager normalement
            if (!dragStarted) {
                pointerDraggedCard = null;
                pointerDraggedFromList = null;
                this.releasePointerCapture(e.pointerId);
                return;
            }
            
            e.preventDefault();
            
            // Trouver la liste cible
            const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
            const targetList = elementBelow?.closest('.list');
            
            if (targetList && pointerDraggedCard) {
                const toListId = targetList.dataset.listId;
                const listContent = targetList.querySelector('.list-content');
                const afterElement = getPointerDragAfterElement(listContent, e.clientY);
                
                const cardId = pointerDraggedCard.dataset.cardId;
                const fromListId = pointerDraggedFromList;
                
                // Effectuer le déplacement
                moveCardToPosition(cardId, fromListId, toListId, afterElement);
            }
            
            // Nettoyer
            if (dragClone) {
                dragClone.remove();
                dragClone = null;
            }
            
            if (dropIndicator) {
                dropIndicator.remove();
                dropIndicator = null;
            }
            
            if (pointerDraggedCard) {
                pointerDraggedCard.style.opacity = '';
            }
            
            pointerDraggedCard = null;
            pointerDraggedFromList = null;
            isDraggingWithPointer = false;
            dragStarted = false;
            
            if (dragAutoScroll.rafId) {
                cancelAnimationFrame(dragAutoScroll.rafId);
                dragAutoScroll.rafId = null;
            }
            
            this.releasePointerCapture(e.pointerId);
        });
        
        card.addEventListener('pointercancel', function (e) {
            // Même nettoyage qu'au pointerup
            if (dragClone) {
                dragClone.remove();
                dragClone = null;
            }
            
            if (dropIndicator) {
                dropIndicator.remove();
                dropIndicator = null;
            }
            
            if (pointerDraggedCard) {
                pointerDraggedCard.style.opacity = '';
            }
            
            pointerDraggedCard = null;
            pointerDraggedFromList = null;
            isDraggingWithPointer = false;
            dragStarted = false;
            
            if (dragAutoScroll.rafId) {
                cancelAnimationFrame(dragAutoScroll.rafId);
                dragAutoScroll.rafId = null;
            }
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

// Fonction similaire pour les pointer events (ignore le clone)
function getPointerDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.card:not(.dragging-clone)')].filter(el => el !== pointerDraggedCard);
    
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
