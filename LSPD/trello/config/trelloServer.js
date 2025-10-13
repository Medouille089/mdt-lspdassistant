// LSPD/trello/trelloServer.js
const path = require("path");
const { initDatabase, loadBoardData, isDatabaseEnabled } = require("./trelloDatabase");
const { initTrelloSocket, operationsManager } = require("./trelloSocket");
const { startNightlyResetScheduler } = require("./trelloResetScheduler");

let boardData = { lists: [], tags: [] };

async function initTrello(app, io) {
    // Init DB
    await initDatabase();

    // Load data
    boardData = await loadBoardData();
    operationsManager.loadBoardState(boardData);
    boardData = operationsManager.getBoardState().boardData;

    // Init socket
    initTrelloSocket(io);

    // Start nightly reset scheduler
    startNightlyResetScheduler();

    // Routes
    app.get("/trello", (req, res) => {
        res.sendFile(path.join(__dirname, "index.html"));
    });

    app.get("/trello/health", async (req, res) => {
        res.json({
            status: "OK",
            mode: isDatabaseEnabled() ? "PostgreSQL" : "Mémoire locale",
            timestamp: new Date().toISOString(),
        });
    });
}

module.exports = { initTrello };
