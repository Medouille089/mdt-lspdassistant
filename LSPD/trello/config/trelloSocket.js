// LSPD/trello/trelloSocket.js
const { saveBoardData } = require("./trelloDatabase");
const { OperationsManager } = require("../scripts/OperationsManager");
const operationsManager = new OperationsManager();

let boardData = { lists: [], tags: [] };

// File d'attente pour les opérations
let operationQueue = Promise.resolve();
let processingOperations = 0;

function initTrelloSocket(io) {
    io.on("connection", async (socket) => {
        console.log("🔌 Nouvelle connexion Trello");

        const { boardData: currentBoard, version } = operationsManager.getBoardState();
        socket.emit("boardSync", { boardData: currentBoard, version });

        socket.on("operation", (operation, ack = () => { }) => {
            // Ajouter l'opération à la file d'attente
            operationQueue = operationQueue
                .then(async () => {
                    processingOperations++;

                    try {
                        const result = operationsManager.applyOperation(operation);

                        if (!result.success) {
                            ack({ success: false, error: result.error });
                            return;
                        }

                        const { boardData: updatedBoard, version: updatedVersion } = operationsManager.getBoardState();
                        boardData = updatedBoard;

                        // Sauvegarder de manière asynchrone (avec debounce intégré)
                        saveBoardData(updatedBoard).catch(err => {
                            console.error('❌ Erreur sauvegarde:', err.message);
                        });

                        ack({ success: true, version: updatedVersion });
                        socket.broadcast.emit("boardSync", { diff: result.diff, version: updatedVersion });

                    } catch (err) {
                        console.error('❌ Erreur traitement opération:', err);
                        ack({ success: false, error: err.message });
                    } finally {
                        processingOperations--;
                    }
                })
                .catch(err => {
                    console.error('❌ Erreur dans la file d\'opérations:', err);
                    processingOperations--;
                });
        });

        socket.on("requestBoardState", () => {
            const { boardData: currentBoard, version } = operationsManager.getBoardState();
            socket.emit("boardSync", { boardData: currentBoard, version });
        });

        socket.on("disconnect", () => {
            console.log("🔌 Connexion Trello fermée");
        });
    });

    // Log de monitoring
    setInterval(() => {
        if (processingOperations > 0) {
            console.log(`⏳ Opérations en cours: ${processingOperations}`);
        }
    }, 5000);
}

module.exports = { initTrelloSocket, operationsManager };
