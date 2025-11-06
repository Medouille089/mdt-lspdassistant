const { EmbedBuilder } = require("discord.js");

// Système de debounce pour regrouper les modifications
const updateQueue = {
    cards: new Map(), // cardId -> { timer, oldValues, latestCard, listName, userId }
    lists: new Map()  // listId -> { timer, oldValues, latestList, userId }
};

const UPDATE_DEBOUNCE_MS = 10000; // 10 secondes pour regrouper les modifications

/**
 * Récupère l'ID du salon de logs Trello depuis la config
 */
async function getLogsChannelId() {
    try {
        const { getConfig } = require("../../../config/config");
        const config = await getConfig();
        return config.logs_trello || "1435938086650515476"; // Fallback sur l'ID par défaut
    } catch (error) {
        console.error("❌ Erreur lors de la récupération de la config logs_trello:", error);
    }
}

/**
 * Récupère le client Discord depuis le bot
 */
function getBot() {
    try {
        return require("../../../config/bot");
    } catch (error) {
        console.error("❌ Erreur lors de la récupération du bot:", error);
        return null;
    }
}

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

        // Récupérer via le bot Discord
        const bot = getBot();
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
 * Envoie un log Discord pour la création d'une liste Trello
 * @param {Object} list - La liste créée
 * @param {string} userId - ID Discord de l'utilisateur qui a créé la liste
 */
async function logCreateList(list, userId) {
    try {
        const bot = getBot();
        if (!bot || !bot.isReady()) {
            console.warn("⚠️  Bot Discord non disponible pour les logs Trello");
            return;
        }

        const channelId = await getLogsChannelId();
        const channel = await bot.channels.fetch(channelId);
        if (!channel) {
            console.error("❌ Salon de logs Trello introuvable:", channelId);
            return;
        }

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

        const embed = new EmbedBuilder()
            .setTitle("Création de Liste")
            .setDescription(`${userInfo.displayName} a créé une liste`)
            .setColor(0x0b1b5a)
            .addFields(
                { name: "Informations", value: `> Nom: ${list.title || list.name || "Sans nom"}\n> Date: \`${dateStr}\``, inline: false },
                { name: "ID's", value: `> <@${userInfo.userId}>\n> (\`${userInfo.userId}\`)`, inline: false }
            )
            .setFooter({ 
                text: 'LSPD Assistant', 
                iconURL: bot.user.displayAvatarURL()
            })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi du log de création de liste:", error);
    }
}

/**
 * Envoie un log Discord pour la création d'une carte Trello
 * @param {Object} card - La carte créée
 * @param {string} listName - Nom de la liste contenant la carte
 * @param {string} userId - ID Discord de l'utilisateur qui a créé la carte
 */
async function logCreateCard(card, listName, userId) {
    try {
        const bot = getBot();
        if (!bot || !bot.isReady()) {
            console.warn("⚠️  Bot Discord non disponible pour les logs Trello");
            return;
        }

        const channelId = await getLogsChannelId();
        const channel = await bot.channels.fetch(channelId);
        if (!channel) {
            console.error("❌ Salon de logs Trello introuvable:", channelId);
            return;
        }

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
        const cardName = card.text || card.title || card.name || "Sans nom";
        
        const embed = new EmbedBuilder()
            .setTitle("Création de Card")
            .setDescription(`${userInfo.displayName} a créé une card`)
            .setColor(0x0b1b5a)
            .addFields(
                { name: "Informations", value: `> Nom: ${cardName}\n> Liste: ${listName || "Inconnue"}\n> Date: \`${dateStr}\``, inline: false },
                { name: "ID's", value: `> <@${userInfo.userId}>\n> (\`${userInfo.userId}\`)`, inline: false }
            )
            .setFooter({ 
                text: 'LSPD Assistant', 
                iconURL: bot.user.displayAvatarURL()
            })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi du log de création de carte:", error);
    }
}

/**
 * Envoie un log Discord pour la suppression d'une carte Trello
 * @param {Object} card - La carte supprimée
 * @param {string} listName - Nom de la liste contenant la carte
 * @param {string} userId - ID Discord de l'utilisateur qui a supprimé la carte
 */
async function logDeleteCard(card, listName, userId) {
    try {
        const bot = getBot();
        if (!bot || !bot.isReady()) {
            console.warn("⚠️  Bot Discord non disponible pour les logs Trello");
            return;
        }

        const channelId = await getLogsChannelId();
        const channel = await bot.channels.fetch(channelId);
        if (!channel) {
            console.error("❌ Salon de logs Trello introuvable:", channelId);
            return;
        }

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
        const cardName = card.text || card.title || card.name || "Sans nom";
        
        // Construire les détails de la card
        let detailsLines = [
            `> Nom: ${cardName}`,
            `> Liste: ${listName || "Inconnue"}`
        ];
        
        if (card.description && card.description.trim()) {
            detailsLines.push(`> Description: ${card.description.substring(0, 100)}${card.description.length > 100 ? '...' : ''}`);
        }
        
        if (card.etat && card.etat.trim()) {
            detailsLines.push(`> État: ${card.etat}`);
        }
        
        if (card.infoSupp && card.infoSupp.trim()) {
            detailsLines.push(`> Info Supp: ${card.infoSupp}`);
        }
        
        if (card.infoSuppPlus && card.infoSuppPlus.trim()) {
            detailsLines.push(`> Info Supp+: ${card.infoSuppPlus}`);
        }
        
        if (card.localisation && card.localisation.trim()) {
            detailsLines.push(`> Localisation: ${card.localisation}`);
        }
        
        if (card.vehicule && card.vehicule.trim()) {
            detailsLines.push(`> Véhicule: ${card.vehicule}`);
        }
        
        if (card.td && card.td.trim()) {
            detailsLines.push(`> TD: ${card.td}`);
        }
        
        if (card.convoi && card.convoi.trim()) {
            detailsLines.push(`> Convoi: ${card.convoi}`);
        }
        
        if (card.tags && card.tags.length > 0) {
            const tagNames = card.tags.map(t => t.name || t).filter(Boolean).join(', ');
            if (tagNames) {
                detailsLines.push(`> Étiquettes: ${tagNames}`);
            }
        }
        
        if (card.type === 'image' && card.image) {
            detailsLines.push(`> Type: Image`);
        }
        
        detailsLines.push(`> Date: \`${dateStr}\``);
        
        const embed = new EmbedBuilder()
            .setTitle("Suppression de Card")
            .setDescription(`${userInfo.displayName} a supprimé une card`)
            .setColor(0xFF0000)
            .addFields(
                { name: "Informations", value: detailsLines.join('\n'), inline: false },
                { name: "ID's", value: `> <@${userInfo.userId}>\n> (\`${userInfo.userId}\`)`, inline: false }
            )
            .setFooter({ 
                text: 'LSPD Assistant', 
                iconURL: bot.user.displayAvatarURL()
            })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi du log de suppression de carte:", error);
    }
}

/**
 * Envoie un log Discord pour la suppression d'une liste Trello
 * @param {Object} list - La liste supprimée
 * @param {string} userId - ID Discord de l'utilisateur qui a supprimé la liste
 */
async function logDeleteList(list, userId) {
    try {
        const bot = getBot();
        if (!bot || !bot.isReady()) {
            console.warn("⚠️  Bot Discord non disponible pour les logs Trello");
            return;
        }

        const channelId = await getLogsChannelId();
        const channel = await bot.channels.fetch(channelId);
        if (!channel) {
            console.error("❌ Salon de logs Trello introuvable:", channelId);
            return;
        }

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
        
        const listName = list.title || list.name || "Sans nom";
        const cards = list.cards || [];
        
        let detailsLines = [
            `> Nom: ${listName}`,
            `> Nombre de cards: ${cards.length}`
        ];
        
        if (cards.length > 0) {
            detailsLines.push(`>`);
            detailsLines.push(`> Cards supprimées:`);
            cards.forEach((card, index) => {
                const cardName = card.text || card.title || card.name || "Sans nom";
                detailsLines.push(`> ${index + 1}. ${cardName}`);
            });
            detailsLines.push(`>`);
        }
        
        detailsLines.push(`> Date: \`${dateStr}\``);
        
        const embed = new EmbedBuilder()
            .setTitle("Suppression de Liste")
            .setDescription(`${userInfo.displayName} a supprimé une liste`)
            .setColor(0xFF0000)
            .addFields(
                { name: "Informations", value: detailsLines.join('\n'), inline: false },
                { name: "ID's", value: `> <@${userInfo.userId}>\n> (\`${userInfo.userId}\`)`, inline: false }
            )
            .setFooter({ 
                text: 'LSPD Assistant', 
                iconURL: bot.user.displayAvatarURL()
            })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi du log de suppression de liste:", error);
    }
}

/**
 * Envoie le log groupé d'une modification de carte
 */
async function sendCardUpdateLog(cardId) {
    const queueItem = updateQueue.cards.get(cardId);
    if (!queueItem) return;
    
    try {
        const bot = getBot();
        if (!bot || !bot.isReady()) {
            console.warn("⚠️  Bot Discord non disponible pour les logs Trello");
            return;
        }

        const channelId = await getLogsChannelId();
        const channel = await bot.channels.fetch(channelId);
        if (!channel) {
            console.error("❌ Salon de logs Trello introuvable:", channelId);
            return;
        }

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
        
        // Mapper les noms de champs
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
        
        let detailsLines = [
            `> Card: ${latestCard.text || "Sans nom"}`,
            `> Liste: ${listName || "Inconnue"}`
        ];
        
        // Comparer les valeurs initiales avec les valeurs finales
        let hasChanges = false;
        Object.keys(oldValues).forEach(key => {
            if (key === 'updated_at' || key === 'id') return;
            
            const fieldName = fieldNames[key] || key;
            const oldValue = oldValues[key];
            const newValue = latestCard[key];
            
            // Traitement spécial pour les tags
            if (key === 'tags') {
                const oldTags = Array.isArray(oldValue) ? oldValue.map(t => t.name || t).filter(Boolean).join(', ') : '';
                const newTags = Array.isArray(newValue) ? newValue.map(t => t.name || t).filter(Boolean).join(', ') : '';
                if (oldTags !== newTags) {
                    detailsLines.push(`> ${fieldName}: ${oldTags || '(vide)'} → ${newTags || '(vide)'}`);
                    hasChanges = true;
                }
            } else {
                // Comparaison simple pour les autres champs
                const oldVal = oldValue || '';
                const newVal = newValue || '';
                if (oldVal !== newVal) {
                    const oldDisplay = oldVal.length > 50 ? oldVal.substring(0, 50) + '...' : oldVal;
                    const newDisplay = newVal.length > 50 ? newVal.substring(0, 50) + '...' : newVal;
                    detailsLines.push(`> ${fieldName}: ${oldDisplay || '(vide)'} → ${newDisplay || '(vide)'}`);
                    hasChanges = true;
                }
            }
        });
        
        if (!hasChanges) {
            return; // Pas de changements à logger
        }
        
        detailsLines.push(`> Date: \`${dateStr}\``);
        
        const embed = new EmbedBuilder()
            .setTitle("Modification de Card")
            .setDescription(`${userInfo.displayName} a modifié une card`)
            .setColor(0x0b1b5a)
            .addFields(
                { name: "Informations", value: detailsLines.join('\n'), inline: false },
                { name: "ID's", value: `> <@${userInfo.userId}>\n> (\`${userInfo.userId}\`)`, inline: false }
            )
            .setFooter({ 
                text: 'LSPD Assistant', 
                iconURL: bot.user.displayAvatarURL()
            })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi du log de modification de carte:", error);
    } finally {
        updateQueue.cards.delete(cardId);
    }
}

/**
 * Envoie le log groupé d'une modification de liste
 */
async function sendListUpdateLog(listId) {
    const queueItem = updateQueue.lists.get(listId);
    if (!queueItem) return;
    
    try {
        const bot = getBot();
        if (!bot || !bot.isReady()) {
            console.warn("⚠️  Bot Discord non disponible pour les logs Trello");
            return;
        }

        const channelId = await getLogsChannelId();
        const channel = await bot.channels.fetch(channelId);
        if (!channel) {
            console.error("❌ Salon de logs Trello introuvable:", channelId);
            return;
        }

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
        
        // Mapper les noms de champs
        const fieldNames = {
            title: 'Nom',
            name: 'Nom'
        };
        
        let detailsLines = [];
        
        // Comparer les valeurs initiales avec les valeurs finales
        let hasChanges = false;
        Object.keys(oldValues).forEach(key => {
            if (key === 'id' || key === 'cards') return;
            
            const fieldName = fieldNames[key] || key;
            const oldValue = oldValues[key];
            const newValue = latestList[key];
            
            const oldVal = oldValue || '';
            const newVal = newValue || '';
            if (oldVal !== newVal) {
                detailsLines.push(`> ${fieldName}: ${oldVal || '(vide)'} → ${newVal || '(vide)'}`);
                hasChanges = true;
            }
        });
        
        if (!hasChanges) {
            return; // Pas de changements à logger
        }
        
        detailsLines.push(`> Date: \`${dateStr}\``);
        
        const embed = new EmbedBuilder()
            .setTitle("Modification de Liste")
            .setDescription(`${userInfo.displayName} a modifié une liste`)
            .setColor(0x0b1b5a)
            .addFields(
                { name: "Informations", value: detailsLines.join('\n'), inline: false },
                { name: "ID's", value: `> <@${userInfo.userId}>\n> (\`${userInfo.userId}\`)`, inline: false }
            )
            .setFooter({ 
                text: 'LSPD Assistant', 
                iconURL: bot.user.displayAvatarURL()
            })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi du log de modification de liste:", error);
    } finally {
        updateQueue.lists.delete(listId);
    }
}

/**
 * Enregistre une modification de carte avec debounce
 * @param {Object} card - La carte modifiée (avec nouvelles valeurs)
 * @param {Object} oldValues - Les anciennes valeurs
 * @param {Object} updates - Les champs modifiés
 * @param {string} listName - Nom de la liste contenant la carte
 * @param {string} userId - ID Discord de l'utilisateur qui a modifié la carte
 */
async function logUpdateCard(card, oldValues, updates, listName, userId) {
    try {
        const cardId = card.id;
        
        // Si c'est la première modification de cette card, on capture les valeurs initiales
        if (!updateQueue.cards.has(cardId)) {
            updateQueue.cards.set(cardId, {
                timer: null,
                oldValues: { ...oldValues }, // Valeurs initiales
                latestCard: { ...card },
                listName,
                userId
            });
        } else {
            // Sinon on met juste à jour les dernières valeurs
            const queueItem = updateQueue.cards.get(cardId);
            queueItem.latestCard = { ...card };
            queueItem.listName = listName;
            
            // Annuler le timer précédent
            if (queueItem.timer) {
                clearTimeout(queueItem.timer);
            }
        }
        
        // Définir un nouveau timer
        const queueItem = updateQueue.cards.get(cardId);
        queueItem.timer = setTimeout(() => {
            sendCardUpdateLog(cardId);
        }, UPDATE_DEBOUNCE_MS);
        
    } catch (error) {
        console.error("❌ Erreur lors de l'enregistrement du log de modification de carte:", error);
    }
}

/**
 * Enregistre une modification de liste avec debounce
 * @param {Object} list - La liste modifiée (avec nouvelles valeurs)
 * @param {Object} oldValues - Les anciennes valeurs
 * @param {Object} updates - Les champs modifiés
 * @param {string} userId - ID Discord de l'utilisateur qui a modifié la liste
 */
async function logUpdateList(list, oldValues, updates, userId) {
    try {
        const listId = list.id;
        
        // Si c'est la première modification de cette liste, on capture les valeurs initiales
        if (!updateQueue.lists.has(listId)) {
            updateQueue.lists.set(listId, {
                timer: null,
                oldValues: { ...oldValues }, // Valeurs initiales
                latestList: { ...list },
                userId
            });
        } else {
            // Sinon on met juste à jour les dernières valeurs
            const queueItem = updateQueue.lists.get(listId);
            queueItem.latestList = { ...list };
            
            // Annuler le timer précédent
            if (queueItem.timer) {
                clearTimeout(queueItem.timer);
            }
        }
        
        // Définir un nouveau timer
        const queueItem = updateQueue.lists.get(listId);
        queueItem.timer = setTimeout(() => {
            sendListUpdateLog(listId);
        }, UPDATE_DEBOUNCE_MS);
        
    } catch (error) {
        console.error("❌ Erreur lors de l'enregistrement du log de modification de liste:", error);
    }
}

/**
 * Envoie un log Discord pour le déplacement d'une carte Trello
 * @param {Object} card - La carte déplacée
 * @param {string} fromListName - Nom de la liste d'origine
 * @param {string} toListName - Nom de la liste de destination
 * @param {boolean} sameList - Si le déplacement est dans la même liste
 * @param {number} fromIndex - Index d'origine de la carte
 * @param {number} targetIndex - Index de destination de la carte
 * @param {string} userId - ID Discord de l'utilisateur qui a déplacé la carte
 */
async function logMoveCard(card, fromListName, toListName, sameList, fromIndex, targetIndex, userId) {
    try {
        const bot = getBot();
        if (!bot || !bot.isReady()) {
            console.warn("⚠️  Bot Discord non disponible pour les logs Trello");
            return;
        }

        const channelId = await getLogsChannelId();
        const channel = await bot.channels.fetch(channelId);
        if (!channel) {
            console.error("❌ Salon de logs Trello introuvable:", channelId);
            return;
        }

        const userInfo = await getUserInfo(userId);
        
        const cardName = card.text || card.title || card.name || "Sans nom";
        
        let description;
        if (sameList) {
            // Déterminer si la card est remontée ou descendue
            if (targetIndex < fromIndex) {
                description = `${userInfo.displayName} a remonté la card **${cardName}** dans la liste **${toListName || "Inconnue"}**`;
            } else {
                description = `${userInfo.displayName} a descendu la card **${cardName}** dans la liste **${toListName || "Inconnue"}**`;
            }
        } else {
            description = `${userInfo.displayName} a déplacé la card **${cardName}** de la liste **${fromListName || "Inconnue"}** à la liste **${toListName || "Inconnue"}**`;
        }
        
        const embed = new EmbedBuilder()
            .setTitle("Mouvement de Card")
            .setDescription(description)
            .setColor(0x0b1b5a)
            .addFields(
                { name: "ID's", value: `> <@${userInfo.userId}>\n> (\`${userInfo.userId}\`)`, inline: false }
            )
            .setFooter({ 
                text: 'LSPD Assistant', 
                iconURL: bot.user.displayAvatarURL()
            })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi du log de déplacement de carte:", error);
    }
}

/**
 * Envoie un log Discord pour la réinitialisation automatique du Trello
 */
async function logTrelloReset() {
    try {
        const bot = getBot();
        if (!bot || !bot.isReady()) {
            console.warn("⚠️  Bot Discord non disponible pour les logs Trello");
            return;
        }

        const channelId = await getLogsChannelId();
        const channel = await bot.channels.fetch(channelId);
        if (!channel) {
            console.error("❌ Salon de logs Trello introuvable:", channelId);
            return;
        }

        const now = new Date();
        const dateStr = now.toLocaleString("fr-FR", {
            timeZone: "Europe/Paris",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
        
        const embed = new EmbedBuilder()
            .setTitle("Réinitialisation du Trello")
            .setDescription(`Le Trello à été réinitialisé (\`${dateStr}\`)`)
            .setColor(0x00FF00)
            .setFooter({ 
                text: 'LSPD Assistant', 
                iconURL: bot.user.displayAvatarURL()
            })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error("❌ Erreur lors de l'envoi du log de réinitialisation:", error);
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


