// LSPD/trello/trelloSocket.js
const { saveBoardData } = require("./trelloDatabase");
const { OperationsManager } = require("../scripts/OperationsManager");
const { logCreateList, logCreateCard, logDeleteCard, logDeleteList, logUpdateCard, logUpdateList, logMoveCard } = require("../utils/trelloLogsDB");
const operationsManager = new OperationsManager();

let boardData = { lists: [], tags: [] };
let ioInstance = null;

// File d'attente pour les opérations
let operationQueue = Promise.resolve();
let processingOperations = 0;

async function handleOperation(operation) {
    processingOperations++;
    try {
        const result = operationsManager.applyOperation(operation);

        if (!result.success) {
            return result;
        }

        const { boardData: updatedBoard, version: updatedVersion } = operationsManager.getBoardState();
        boardData = updatedBoard;

        // Sauvegarder de manière asynchrone (avec debounce intégré)
        saveBoardData(updatedBoard).catch(err => {
            console.error('❌ Erreur sauvegarde:', err.message);
        });

        // Logs Discord pour les créations
        const userId = operation.userId;
        if (result.success && userId) {
            if (operation.type === 'CREATE_LIST') {
                const list = operation.data?.list;
                if (list) {
                    logCreateList(list, userId).catch(err => {
                        console.error('❌ Erreur log Discord CREATE_LIST:', err.message);
                    });
                }
            } else if (operation.type === 'CREATE_CARD') {
                const card = operation.data?.card;
                const listId = operation.data?.listId;
                if (card && listId) {
                    // Trouver le nom de la liste
                    const list = updatedBoard.lists.find(l => l.id === listId);
                    const listName = list ? (list.title || list.name) : 'Inconnue';
                    logCreateCard(card, listName, userId).catch(err => {
                        console.error('❌ Erreur log Discord CREATE_CARD:', err.message);
                    });
                }
            } else if (operation.type === 'UPDATE_CARD') {
                const card = result.diff?.data?.card;
                const oldValues = result.diff?.data?.oldValues;
                const updates = result.diff?.data?.updates;
                const listName = result.diff?.data?.listName;
                if (card && oldValues && updates) {
                    logUpdateCard(card, oldValues, updates, listName, userId).catch(err => {
                        console.error('❌ Erreur log Discord UPDATE_CARD:', err.message);
                    });
                }
            } else if (operation.type === 'DELETE_CARD') {
                const card = result.diff?.data?.card;
                const listName = result.diff?.data?.listName;
                if (card) {
                    logDeleteCard(card, listName, userId).catch(err => {
                        console.error('❌ Erreur log Discord DELETE_CARD:', err.message);
                    });
                }
            } else if (operation.type === 'UPDATE_LIST') {
                const list = result.diff?.data?.list;
                const oldValues = result.diff?.data?.oldValues;
                const updates = result.diff?.data?.updates;
                if (list && oldValues && updates) {
                    logUpdateList(list, oldValues, updates, userId).catch(err => {
                        console.error('❌ Erreur log Discord UPDATE_LIST:', err.message);
                    });
                }
            } else if (operation.type === 'DELETE_LIST') {
                const list = result.diff?.data?.list;
                if (list) {
                    logDeleteList(list, userId).catch(err => {
                        console.error('❌ Erreur log Discord DELETE_LIST:', err.message);
                    });
                }
            } else if (operation.type === 'MOVE_CARD') {
                const card = result.diff?.data?.card;
                const fromListName = result.diff?.data?.fromListName;
                const toListName = result.diff?.data?.toListName;
                const sameList = result.diff?.data?.sameList;
                const fromIndex = result.diff?.data?.fromIndex;
                const targetIndex = result.diff?.data?.targetIndex;
                if (card) {
                    logMoveCard(card, fromListName, toListName, sameList, fromIndex, targetIndex, userId).catch(err => {
                        console.error('❌ Erreur log Discord MOVE_CARD:', err.message);
                    });
                }
            }
        }

        return {
            ...result,
            version: updatedVersion
        };
    } catch (error) {
        console.error('❌ Erreur traitement opération:', error);
        return { success: false, error: error.message };
    } finally {
        processingOperations--;
    }
}

function processOperation(operation) {
    return new Promise((resolve) => {
        operationQueue = operationQueue
            .then(() => handleOperation(operation))
            .then(resolve)
            .catch(err => {
                console.error('❌ Erreur dans la file d\'opérations:', err);
                resolve({ success: false, error: err.message });
            });
    });
}

function initTrelloSocket(io) {
    ioInstance = io;

    io.on("connection", async (socket) => {

        const { boardData: currentBoard, version } = operationsManager.getBoardState();
        socket.emit("boardSync", { boardData: currentBoard, version });

        socket.on("operation", (operation, ack = () => { }) => {
            processOperation(operation).then(result => {
                if (!result.success) {
                    ack({ success: false, error: result.error });
                    return;
                }

                ack({ success: true, version: result.version, rebased: result.rebased });
                socket.broadcast.emit("boardSync", { diff: result.diff, version: result.version });
            });
        });

        socket.on("requestBoardState", () => {
            const { boardData: currentBoard, version } = operationsManager.getBoardState();
            socket.emit("boardSync", { boardData: currentBoard, version });
        });

        socket.on("disconnect", () => {
        });
    });

    // Log de monitoring
    setInterval(() => {
        if (processingOperations > 0) {
        }
    }, 5000);
}

function createServerOperation(type, data = {}) {
    const { version } = operationsManager.getBoardState();
    return {
        id: `srv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        data,
        baseVersion: version
    };
}

async function applyServerOperation(operation) {
    const result = await processOperation(operation);

    if (result.success && ioInstance) {
        ioInstance.emit("boardSync", { diff: result.diff, version: result.version });
    }

    return result;
}

module.exports = { initTrelloSocket, operationsManager, applyServerOperation, createServerOperation };
