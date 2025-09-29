import { setBoardData, setIsLocalUpdate, boardData, isLocalUpdate, activeCardCreations, currentCard, currentListId, scrollState } from './state.js';
import { renderBoard, updateSingleCardDOM } from './board.js';
import { syncTagsFromBoardData } from './tags.js';
import { captureScrollState } from './utils.js';

export const socket = io();

let syncTimeout;

socket.on('boardSync', (serverBoardData) => {
    setBoardData(serverBoardData);
    syncTagsFromBoardData();
    
    // Si update locale et une carte est ouverte, on évite un render global pour ne pas faire sauter le scroll
    if (isLocalUpdate && currentCard && currentListId && document.getElementById('cardModal')?.classList.contains('active')) {
        setIsLocalUpdate(false);
        // Mise à jour partielle uniquement
        updateSingleCardDOM(currentCard.id, currentListId);
        return;
    }
    
    if (isLocalUpdate && activeCardCreations.size > 0) {
        setIsLocalUpdate(false);
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
