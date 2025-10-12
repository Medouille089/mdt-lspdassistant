// LSPD/trello/trelloSocket.js
const { saveBoardData } = require("./trelloDatabase");
const { OperationsManager } = require("../scripts/OperationsManager");
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
