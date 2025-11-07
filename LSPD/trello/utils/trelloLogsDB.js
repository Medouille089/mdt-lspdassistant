const pool = require("../../../config/db");

/**
 * Récupère les informations de l'utilisateur depuis Discord
 * @param {string} userId - ID Discord de l'utilisateur
 * @returns {Promise<{displayName: string, userId: string}>}
 */
async function getUserInfo(userId) {
    try {
        if (!userId) {
            return { displayName: "Système", userId: "N/A" };
        }

        const bot = require("../../../config/bot");
        if (bot && bot.isReady()) {
            try {
                const { GUILD_ID } = require("../../../config/env");
                const guild = await bot.guilds.fetch(GUILD_ID);
                const member = await guild.members.fetch(userId);
                
                return {
                    displayName: member.displayName || member.user.username,
                    userId: userId
                };
            } catch (err) {
                console.warn("⚠️  Impossible de récupérer le membre Discord:", userId);
            }
        }

        return { displayName: "Utilisateur Inconnu", userId: userId };
    } catch (error) {
        console.error("❌ Erreur lors de la récupération des infos utilisateur:", error);
        return { displayName: "Erreur", userId: userId || "N/A" };
    }
}

/**
 * Enregistre un log dans la base de données et l'émet via WebSocket
 * @param {string} logType - Type de log (CREATE_CARD, UPDATE_CARD, etc.)
 * @param {string} userId - ID Discord de l'utilisateur
 * @param {string} userName - Nom d'affichage de l'utilisateur
 * @param {string} actionDescription - Description de l'action
 * @param {Object} details - Détails de l'action (format JSON)
 * @param {string} color - Couleur pour l'affichage (format hex)
 */
async function saveLog(logType, userId, userName, actionDescription, details, color = '0x0b1b5a') {
    try {

        // Date Paris pour la base, format PostgreSQL
        const nowParis = new Date().toLocaleString("sv-SE", {
            timeZone: "Europe/Paris"
        }); // sv-SE = 'YYYY-MM-DD HH:mm:ss'
        const createdAt = nowParis.replace('T', ' ');

        const result = await pool.query(
            `INSERT INTO trello_logs (log_type, user_id, user_name, action_description, details, color, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [logType, userId, userName, actionDescription, JSON.stringify(details), color, createdAt]
        );

        // Émettre le nouveau log via WebSocket
        const newLog = result.rows[0];
        const { getIO } = require("../config/trelloServer");
        const io = getIO();

        if (io) {
            // Récupérer la photo de profil si disponible
            try {
                const photoResult = await pool.query(
                    'SELECT photo_url FROM lspd_agent_profiles WHERE discord_id = $1',
                    [userId]
                );
                newLog.photo_url = photoResult.rows[0]?.photo_url || null;
            } catch (err) {
                console.warn("⚠️  Erreur récupération photo profil:", err.message);
            }
            
            io.emit('trelloLog', newLog);
        }
    } catch (error) {
        console.error("❌ Erreur lors de l'enregistrement du log Trello:", error);
    }
}

/**
 * Enregistre la création d'une liste
 */
async function logCreateList(list, userId) {
    try {
        const userInfo = await getUserInfo(userId);
        const now = new Date();
        const dateStr = now.toLocaleString("fr-FR", {
            timeZone: "Europe/Paris",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });

        await saveLog(
            'CREATE_LIST',
            userInfo.userId,
            userInfo.displayName,
            `${userInfo.displayName} a créé une liste`,
            {
                listName: list.title || list.name || "Sans nom",
                date: dateStr
            },
            '0x0b1b5a'
        );
    } catch (error) {
        console.error("❌ Erreur log création liste:", error);
    }
}

/**
 * Enregistre la création d'une carte
 */
async function logCreateCard(card, listName, userId) {
    try {
        const userInfo = await getUserInfo(userId);
        const now = new Date();
        const dateStr = now.toLocaleString("fr-FR", {
            timeZone: "Europe/Paris",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });

        await saveLog(
            'CREATE_CARD',
            userInfo.userId,
            userInfo.displayName,
            `${userInfo.displayName} a créé une card`,
            {
                cardName: card.text || card.title || card.name || "Sans nom",
                listName: listName || "Inconnue",
                date: dateStr
            },
            '0x0b1b5a'
        );
    } catch (error) {
        console.error("❌ Erreur log création carte:", error);
    }
}

/**
 * Enregistre la suppression d'une carte
 */
async function logDeleteCard(card, listName, userId) {
    try {
        const userInfo = await getUserInfo(userId);
        const now = new Date();
        const dateStr = now.toLocaleString("fr-FR", {
            timeZone: "Europe/Paris",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });

        const cardDetails = {
            cardName: card.text || card.title || card.name || "Sans nom",
            listName: listName || "Inconnue",
            date: dateStr,
            fields: []
        };

        // Ajouter tous les champs de la card
        if (card.description?.trim()) cardDetails.fields.push({ label: 'Description', value: card.description.substring(0, 100) });
        if (card.etat?.trim()) cardDetails.fields.push({ label: 'État', value: card.etat });
        if (card.infoSupp?.trim()) cardDetails.fields.push({ label: 'Info Supp', value: card.infoSupp });
        if (card.infoSuppPlus?.trim()) cardDetails.fields.push({ label: 'Info Supp+', value: card.infoSuppPlus });
        if (card.localisation?.trim()) cardDetails.fields.push({ label: 'Localisation', value: card.localisation });
        if (card.vehicule?.trim()) cardDetails.fields.push({ label: 'Véhicule', value: card.vehicule });
        if (card.td?.trim()) cardDetails.fields.push({ label: 'TD', value: card.td });
        if (card.convoi?.trim()) cardDetails.fields.push({ label: 'Convoi', value: card.convoi });
        if (card.tags?.length > 0) {
            const tagNames = card.tags.map(t => t.name || t).filter(Boolean).join(', ');
            if (tagNames) cardDetails.fields.push({ label: 'Étiquettes', value: tagNames });
        }
        if (card.type === 'image') cardDetails.fields.push({ label: 'Type', value: 'Image' });

        await saveLog(
            'DELETE_CARD',
            userInfo.userId,
            userInfo.displayName,
            `${userInfo.displayName} a supprimé une card`,
            cardDetails,
            '0xFF0000'
        );
    } catch (error) {
        console.error("❌ Erreur log suppression carte:", error);
    }
}

/**
 * Enregistre la suppression d'une liste
 */
async function logDeleteList(list, userId) {
    try {
        const userInfo = await getUserInfo(userId);
        const now = new Date();
        const dateStr = now.toLocaleString("fr-FR", {
            timeZone: "Europe/Paris",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });

        const cards = list.cards || [];
        const cardsList = cards.map((card, index) => ({
            index: index + 1,
            name: card.text || card.title || card.name || "Sans nom"
        }));

        await saveLog(
            'DELETE_LIST',
            userInfo.userId,
            userInfo.displayName,
            `${userInfo.displayName} a supprimé une liste`,
            {
                listName: list.title || list.name || "Sans nom",
                cardCount: cards.length,
                cards: cardsList,
                date: dateStr
            },
            '0xFF0000'
        );
    } catch (error) {
        console.error("❌ Erreur log suppression liste:", error);
    }
}

/**
 * Enregistre la modification d'une carte (avec debounce)
 */
const updateQueue = {
    cards: new Map(),
    lists: new Map()
};
const UPDATE_DEBOUNCE_MS = 10000;

async function logUpdateCard(card, oldValues, updates, listName, userId) {
    try {
        const cardId = card.id;
        
        if (!updateQueue.cards.has(cardId)) {
            updateQueue.cards.set(cardId, {
                timer: null,
                oldValues: { ...oldValues },
                latestCard: { ...card },
                listName,
                userId
            });
        } else {
            const queueItem = updateQueue.cards.get(cardId);
            queueItem.latestCard = { ...card };
            queueItem.listName = listName;
            
            if (queueItem.timer) {
                clearTimeout(queueItem.timer);
            }
        }
        
        const queueItem = updateQueue.cards.get(cardId);
        queueItem.timer = setTimeout(async () => {
            await sendCardUpdateLog(cardId);
        }, UPDATE_DEBOUNCE_MS);
        
    } catch (error) {
        console.error("❌ Erreur log modification carte:", error);
    }
}

async function sendCardUpdateLog(cardId) {
    const queueItem = updateQueue.cards.get(cardId);
    if (!queueItem) return;
    
    try {
        const { oldValues, latestCard, listName, userId } = queueItem;
        const userInfo = await getUserInfo(userId);
        const now = new Date();
        const dateStr = now.toLocaleString("fr-FR", {
            timeZone: "Europe/Paris",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
        
        const fieldNames = {
            text: 'Nom',
            description: 'Description',
            etat: 'État',
            infoSupp: 'Info Supp',
            infoSuppPlus: 'Info Supp+',
            localisation: 'Localisation',
            vehicule: 'Véhicule',
            td: 'TD',
            convoi: 'Convoi',
            tags: 'Étiquettes'
        };
        
        const changes = [];
        Object.keys(oldValues).forEach(key => {
            if (key === 'updated_at' || key === 'id') return;
            
            const fieldName = fieldNames[key] || key;
            const oldValue = oldValues[key];
            const newValue = latestCard[key];
            
            if (key === 'tags') {
                const oldTags = Array.isArray(oldValue) ? oldValue.map(t => t.name || t).filter(Boolean).join(', ') : '';
                const newTags = Array.isArray(newValue) ? newValue.map(t => t.name || t).filter(Boolean).join(', ') : '';
                if (oldTags !== newTags) {
                    changes.push({ field: fieldName, oldValue: oldTags || '(vide)', newValue: newTags || '(vide)' });
                }
            } else {
                const oldVal = oldValue || '';
                const newVal = newValue || '';
                if (oldVal !== newVal) {
                    const oldDisplay = oldVal.length > 50 ? oldVal.substring(0, 50) + '...' : oldVal;
                    const newDisplay = newVal.length > 50 ? newVal.substring(0, 50) + '...' : newVal;
                    changes.push({ field: fieldName, oldValue: oldDisplay || '(vide)', newValue: newDisplay || '(vide)' });
                }
            }
        });
        
        if (changes.length > 0) {
            await saveLog(
                'UPDATE_CARD',
                userInfo.userId,
                userInfo.displayName,
                `${userInfo.displayName} a modifié une card`,
                {
                    cardName: latestCard.text || "Sans nom",
                    listName: listName || "Inconnue",
                    changes,
                    date: dateStr
                },
                '0x0b1b5a'
            );
        }
    } catch (error) {
        console.error("❌ Erreur envoi log modification carte:", error);
    } finally {
        updateQueue.cards.delete(cardId);
    }
}

/**
 * Enregistre la modification d'une liste (avec debounce)
 */
async function logUpdateList(list, oldValues, updates, userId) {
    try {
        const listId = list.id;
        
        if (!updateQueue.lists.has(listId)) {
            updateQueue.lists.set(listId, {
                timer: null,
                oldValues: { ...oldValues },
                latestList: { ...list },
                userId
            });
        } else {
            const queueItem = updateQueue.lists.get(listId);
            queueItem.latestList = { ...list };
            
            if (queueItem.timer) {
                clearTimeout(queueItem.timer);
            }
        }
        
        const queueItem = updateQueue.lists.get(listId);
        queueItem.timer = setTimeout(async () => {
            await sendListUpdateLog(listId);
        }, UPDATE_DEBOUNCE_MS);
        
    } catch (error) {
        console.error("❌ Erreur log modification liste:", error);
    }
}

async function sendListUpdateLog(listId) {
    const queueItem = updateQueue.lists.get(listId);
    if (!queueItem) return;
    
    try {
        const { oldValues, latestList, userId } = queueItem;
        const userInfo = await getUserInfo(userId);
        const now = new Date();
        const dateStr = now.toLocaleString("fr-FR", {
            timeZone: "Europe/Paris",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
        
        const fieldNames = { title: 'Nom', name: 'Nom' };
        const changes = [];
        
        Object.keys(oldValues).forEach(key => {
            if (key === 'id' || key === 'cards') return;
            
            const fieldName = fieldNames[key] || key;
            const oldValue = oldValues[key] || '';
            const newValue = latestList[key] || '';
            
            if (oldValue !== newValue) {
                changes.push({ field: fieldName, oldValue: oldValue || '(vide)', newValue: newValue || '(vide)' });
            }
        });
        
        if (changes.length > 0) {
            await saveLog(
                'UPDATE_LIST',
                userInfo.userId,
                userInfo.displayName,
                `${userInfo.displayName} a modifié une liste`,
                {
                    changes,
                    date: dateStr
                },
                '0x0b1b5a'
            );
        }
    } catch (error) {
        console.error("❌ Erreur envoi log modification liste:", error);
    } finally {
        updateQueue.lists.delete(listId);
    }
}

/**
 * Enregistre le déplacement d'une carte
 */
async function logMoveCard(card, fromListName, toListName, sameList, fromIndex, targetIndex, userId) {
    try {
        const userInfo = await getUserInfo(userId);
        const cardName = card.text || card.title || card.name || "Sans nom";
        
        let description;
        if (sameList) {
            if (targetIndex < fromIndex) {
                description = `${userInfo.displayName} a remonté la card <strong>${cardName}</strong> dans la liste <strong>${toListName || "Inconnue"}</strong>`;
            } else {
                description = `${userInfo.displayName} a descendu la card <strong>${cardName}</strong> dans la liste <strong>${toListName || "Inconnue"}</strong>`;
            }
        } else {
            description = `${userInfo.displayName} a déplacé la card <strong>${cardName}</strong> de la liste <strong>${fromListName || "Inconnue"}</strong> à la liste <strong>${toListName || "Inconnue"}</strong>`;
        }
        
        await saveLog(
            'MOVE_CARD',
            userInfo.userId,
            userInfo.displayName,
            description,
            {
                cardName,
                fromListName,
                toListName,
                sameList,
                direction: sameList ? (targetIndex < fromIndex ? 'up' : 'down') : 'cross-list'
            },
            '0x0b1b5a'
        );
    } catch (error) {
        console.error("❌ Erreur log déplacement carte:", error);
    }
}

/**
 * Enregistre la réinitialisation du Trello
 */
async function logTrelloReset() {
    try {
        const now = new Date();
        const dateStr = now.toLocaleString("fr-FR", {
            timeZone: "Europe/Paris",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
        
        await saveLog(
            'RESET',
            'SYSTEM',
            'LSPD Assistant',
            `Le Trello à été réinitialisé`,
            {
                date: dateStr
            },
            '0x00FF00'
        );
    } catch (error) {
        console.error("❌ Erreur log réinitialisation:", error);
    }
}

module.exports = {
    logCreateList,
    logCreateCard,
    logDeleteCard,
    logDeleteList,
    logUpdateCard,
    logUpdateList,
    logMoveCard,
    logTrelloReset
};
