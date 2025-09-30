import { setBoardData, setIsLocalUpdate, boardData, isLocalUpdate, activeCardCreations, currentCard, currentListId, scrollState } from './state.js';
import { renderBoard, updateSingleCardDOM } from './board.js';
import { syncTagsFromBoardData } from './tags.js';
import { captureScrollState } from './utils.js';

export const socket = io();

let syncTimeout;

socket.on('boardSync', (serverBoardData) => {
    setBoardData(serverBoardData);
    syncTagsFromBoardData();
    
    // Ne pas interrompre les créations de cartes en cours
    if (isLocalUpdate && activeCardCreations.size > 0) {
        setIsLocalUpdate(false);
        // Faire un rendu mais en préservant les créateurs actifs
        renderBoard(true);
        return;
    }
    
    // Si update locale et une carte est ouverte, on évite un render global pour ne pas faire sauter le scroll
    if (isLocalUpdate && currentCard && currentListId && document.getElementById('cardModal')?.classList.contains('active')) {
        setIsLocalUpdate(false);
        // Mise à jour partielle uniquement
        updateSingleCardDOM(currentCard.id, currentListId);
        return;
    }
    
    setIsLocalUpdate(false);
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => renderBoard(true), 100);
});

export function syncBoardData() {
    setIsLocalUpdate(true);
    captureScrollState(scrollState);
    socket.emit('boardUpdate', boardData);
}
