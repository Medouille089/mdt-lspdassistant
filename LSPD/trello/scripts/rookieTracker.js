import { boardData, availableTags, addRookiePatrol, getRookiePatrols, setRookiePatrols, updateRookiePatrolDeletion, removeRookiePatrol, canCleanRookiePatrols } from './state.js';
import { getCardTags } from './utils.js';
import { saveRookiePatrol, cleanDeletedPatrols as cleanDeletedPatrolsAPI, markPatrolAsDeleted } from '../routes/rookiePatrolsAPI.js';

const MIN_ACTIVE_DURATION_SECONDS = 10 * 60; // 10 minutes

function parseActiveDurationSeconds(activeDuration) {
    if (activeDuration == null) return null;

    if (typeof activeDuration === 'number') {
        return activeDuration >= 0 ? activeDuration : null;
    }

    if (typeof activeDuration === 'object') {
        if (activeDuration === null) return null;

        const days = Number.parseInt(activeDuration.days ?? activeDuration.day ?? 0, 10) || 0;
        const hours = Number.parseInt(activeDuration.hours ?? activeDuration.hour ?? 0, 10) || 0;
        const minutes = Number.parseInt(activeDuration.minutes ?? activeDuration.minute ?? 0, 10) || 0;
        const seconds = Number.parseInt(activeDuration.seconds ?? activeDuration.second ?? 0, 10) || 0;
        const millis = Number.parseInt(activeDuration.milliseconds ?? activeDuration.millis ?? 0, 10) || 0;

        const totalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds + Math.floor(millis / 1000);
        return totalSeconds >= 0 ? totalSeconds : null;
    }

    const durationString = activeDuration.toString().trim();
    if (!durationString) return null;

    const isoMatch = durationString.match(/^P(T.*)$/i);
    if (isoMatch) {
        try {
            const asMillis = parseISODurationToMillis(durationString);
            if (Number.isFinite(asMillis)) {
                const seconds = Math.floor(asMillis / 1000);
                return seconds >= 0 ? seconds : null;
            }
        } catch (error) {
            console.warn('Impossible de parser la durée ISO:', durationString, error);
        }
    }

    let totalSeconds = 0;

    const dayMatch = durationString.match(/(\d+)\s+days?/i);
    if (dayMatch) {
        totalSeconds += parseInt(dayMatch[1], 10) * 86400;
    }

    const timeMatch = durationString.match(/(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?$/);
    if (timeMatch) {
        totalSeconds += parseInt(timeMatch[1], 10) * 3600;
        totalSeconds += parseInt(timeMatch[2], 10) * 60;
        totalSeconds += parseInt(timeMatch[3], 10);
    }

    if (!timeMatch && !dayMatch) {
        const numeric = Number(durationString);
        if (Number.isFinite(numeric)) {
            totalSeconds += numeric;
        }
    }

    return Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : null;
}

function parseISODurationToMillis(isoDuration) {
    // Supporte des formats simples comme PT15M, PT25M30S, PT1H, etc.
    const regex = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i;
    const match = isoDuration.match(regex);
    if (!match) return NaN;

    const days = Number(match[1] || 0);
    const hours = Number(match[2] || 0);
    const minutes = Number(match[3] || 0);
    const seconds = Number(match[4] || 0);

    return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
}

function getActiveDurationSeconds(patrol) {
    let durationSeconds = parseActiveDurationSeconds(patrol?.activeDuration ?? patrol?.active_duration);

    if (durationSeconds == null && patrol?.timestamp && (patrol?.deletedAt || patrol?.deleted_at)) {
        const start = new Date(patrol.timestamp);
        const end = new Date(patrol.deletedAt ?? patrol.deleted_at ?? Date.now());
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
            durationSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
        }
    }

    return durationSeconds;
}

function formatDurationFromSeconds(totalSeconds) {
    if (totalSeconds == null) return '';

    const totalMinutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const totalHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const segments = [];
    if (totalHours > 0) {
        segments.push(`${totalHours}h`);
    }
    if (minutes > 0) {
        segments.push(`${minutes}m`);
    }
    if (segments.length === 0) {
        segments.push(seconds > 0 ? `${seconds}s` : '<1m');
    }

    return `Durée : ${segments.join(' ')}`;
}

function shouldDisplayPatrol(patrol) {
    if (!patrol.deletedAt) {
        return true;
    }

    const durationSeconds = getActiveDurationSeconds(patrol);
    if (durationSeconds == null) {
        return false;
    }

    return durationSeconds >= MIN_ACTIVE_DURATION_SECONDS;
}

/**
 * Crée le HTML d'une carte comme dans le board (inspiré de renderCard)
 */

function renderPatrolCard(patrol) {
    const timestamp = patrol.timestamp 
        ? new Date(patrol.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : '';
    
    // Vérifier si la carte existe encore dans le board
    const cardStillExists = checkIfCardExists(patrol.cardId);
    const deletedClass = cardStillExists ? '' : 'patrol-deleted';
    const deletedBadge = cardStillExists ? '' : '<span class="patrol-badge deleted-badge">🗑️ Supprimée</span>';
    const durationSeconds = getActiveDurationSeconds(patrol);
    const durationLabel = !cardStillExists ? formatDurationFromSeconds(durationSeconds) : '';
    const durationBadge = durationLabel ? `<span class="patrol-badge duration-badge">${durationLabel}</span>` : '';
    
    // Créer la description avec les infos des rookies
    let description = `🎓 Rookie${patrol.rookieCount > 1 ? 's' : ''} en patrouille:\n`;
    
    patrol.rookies.forEach(r => {
        const fullName = r.name.includes('|') 
            ? r.name.split('|')[1]?.trim() 
            : r.name;
        const nameParts = fullName?.split(' ') || [];
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        description += `\n👮 ${r.badge}\n`;
        description += `   Prénom: ${firstName}\n`;
        if (lastName) {
            description += `   Nom: ${lastName}\n`;
        }
    });
    
    return `
        <div class="card patrol-rookie-card ${deletedClass}" data-patrol-id="${patrol.cardId}">
            ${timestamp ? `<span class="card-timestamp" title="Heure de détection">${timestamp}</span>` : ''}
            <div class="card-content">
                <div class="card-title">🚓 ${patrol.patrolName}</div>
                <div class="card-description">
                    ${description.split('\n').map(line => `<div>${line || '&nbsp;'}</div>`).join('')}
                </div>
                <div class="card-badges">
                    ${deletedBadge}
                    ${durationBadge}
                    <span class="patrol-badge rookie-count">${patrol.rookieCount} rookie${patrol.rookieCount > 1 ? 's' : ''}</span>
                    <span class="patrol-badge total-count">${patrol.totalCount} agents</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Vérifie si une carte existe encore dans le board
 */
function checkIfCardExists(cardId) {
    for (const list of boardData.lists) {
        if (list.cards.some(card => card.id === cardId)) {
            return true;
        }
    }
    return false;
}

/**
 * Extrait les matricules d'une carte de patrouille
 * Exemples: "A | 52 + 23" -> ["52", "23"]
 *          "B | 45 + 12 + 78" -> ["45", "12", "78"]
 */
function extractBadgesFromPatrol(patrolText) {
    // Regex pour capturer les numéros après le | et séparés par +
    const match = patrolText.match(/\|\s*(.+)/);
    if (!match) return [];
    
    const badgesPart = match[1];
    const badges = badgesPart.split('+').map(b => b.trim()).filter(b => /^\d+$/.test(b));
    
    return badges;
}

/**
 * Récupère toutes les cartes d'agents avec leurs matricules et tags
 * Une carte d'agent contient juste un matricule et des tags
 */
function getAgentCards() {
    const agents = [];
    
    boardData.lists.forEach(list => {
        list.cards.forEach(card => {
            // Une carte agent est typiquement juste un numéro (matricule)
            const text = card.text?.trim();
            if (!text) return;
            
            // Vérifier si c'est juste un matricule (nombre simple)
            // ou un format comme "03 | Nom" 
            let badge = null;
            
            // Format: "03 | Shaila Di Martina"
            const nameMatch = text.match(/^(\d+)\s*\|/);
            if (nameMatch) {
                badge = nameMatch[1];
            } else if (/^\d+$/.test(text)) {
                // Juste un numéro
                badge = text;
            }
            
            if (badge) {
                const tags = getCardTags(card, availableTags);
                const tagNames = tags.map(tagId => {
                    const tag = availableTags.find(t => t.id === tagId);
                    return tag ? tag.label : '';
                }).filter(Boolean);
                
                agents.push({
                    badge,
                    cardId: card.id,
                    cardText: text,
                    tags: tagNames,
                    isRookie: tagNames.some(t => 
                        t.toLowerCase().includes('rookie') || 
                        t.toLowerCase().includes('probationary') ||
                        t.toLowerCase().includes('stagiaire')
                    )
                });
            }
        });
    });
    
    return agents;
}

/**
 * Vérifie si une carte de patrouille contient des rookies
 */
export function checkPatrolForRookies(card, listId) {
    const patrolText = card.text?.trim();
    if (!patrolText) return;
    
    // Vérifier si c'est une carte de patrouille (contient des +)
    if (!patrolText.includes('+')) return;
    
    const patrolBadges = extractBadgesFromPatrol(patrolText);
    if (patrolBadges.length === 0) return;
    
    // Récupérer toutes les cartes d'agents
    const agents = getAgentCards();
    
    // Trouver les rookies dans cette patrouille
    const rookiesInPatrol = [];
    const allMembersInPatrol = [];
    
    patrolBadges.forEach(badge => {
        const agent = agents.find(a => a.badge === badge);
        if (agent) {
            allMembersInPatrol.push({
                badge: agent.badge,
                name: agent.cardText,
                tags: agent.tags
            });
            
            if (agent.isRookie) {
                rookiesInPatrol.push({
                    badge: agent.badge,
                    name: agent.cardText,
                    tags: agent.tags
                });
            }
        }
    });
    
    // Si on a trouvé au moins un rookie, enregistrer la patrouille
    if (rookiesInPatrol.length > 0) {
        const list = boardData.lists.find(l => l.id === listId);
        
        const patrolData = {
            cardId: card.id,
            patrolName: patrolText,
            listName: list?.title || 'Unknown',
            listId: listId,
            badges: patrolBadges,
            rookies: rookiesInPatrol,
            allMembers: allMembersInPatrol,
            rookieCount: rookiesInPatrol.length,
            totalCount: patrolBadges.length
        };
        
        // Ajouter en mémoire locale
        addRookiePatrol(patrolData);
        
        // Sauvegarder en base de données
        saveRookiePatrol(patrolData).catch(err => {
            console.error('Erreur lors de la sauvegarde en BDD:', err);
        });
    }
}

/**
 * Scanne toutes les cartes existantes pour détecter les patrouilles avec rookies
 */
export function scanAllPatrolsForRookies() {    
    let foundCount = 0;
    
    boardData.lists.forEach(list => {
        list.cards.forEach(card => {
            if (card.text?.includes('+')) {
                checkPatrolForRookies(card, list.id);
                foundCount++;
            }
        });
    });
}

export async function handleRookiePatrolDeletion(cardId, options = {}) {
    if (!cardId) return;

    const force = Boolean(options.force);
    const patrolExists = getRookiePatrols().some(p => p.cardId === cardId);
    if (!force && !patrolExists) return;

    try {
        const updated = await markPatrolAsDeleted(cardId);
        if (updated) {
            updateRookiePatrolDeletion(cardId, updated);
        } else if (patrolExists) {
            updateRookiePatrolDeletion(cardId, { deletedAt: new Date().toISOString() });
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la patrouille rookie supprimée:', error);
    }

    const patrol = getRookiePatrols().find(p => p.cardId === cardId);
    if (!patrol) return;

    let durationSeconds = getActiveDurationSeconds(patrol);

    if (durationSeconds != null && durationSeconds < MIN_ACTIVE_DURATION_SECONDS) {
        try {
            await cleanDeletedPatrolsAPI([cardId]);
        } catch (error) {
            console.error('Erreur lors de la suppression de la patrouille rookie courte:', error);
        }
        removeRookiePatrol(cardId);
    }
}

/**
 * Affiche un dropdown menu avec l'historique des patrouilles avec rookies
 */
export function showRookiePatrolsModal() {
    // Fermer le menu s'il est déjà ouvert
    const existingMenu = document.querySelector('.rookie-patrols-menu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }
    
    const patrols = getRookiePatrols();
    const displayedPatrols = patrols.filter(shouldDisplayPatrol);
    const button = document.getElementById('rookiePatrolsBtn');
    
    // Compter les patrouilles actives et supprimées
    const activePatrols = displayedPatrols.filter(p => checkIfCardExists(p.cardId));
    const deletedPatrols = displayedPatrols.filter(p => !checkIfCardExists(p.cardId));
    const canCleanDeleted = canCleanRookiePatrols();
    
    // Créer le menu
    const menu = document.createElement('div');
    menu.className = 'rookie-patrols-menu';
    menu.innerHTML = `
        <div class="rookie-patrols-menu-header">
            <div class="rookie-patrols-menu-title">🎓 Patrouilles avec Rookies</div>
        </div>
        <div class="rookie-patrols-stats">
            <span class="stat-badge">${displayedPatrols.length} total</span>
            <span class="stat-badge active-badge">${activePatrols.length} actives</span>
            ${deletedPatrols.length > 0 ? `<span class="stat-badge deleted-badge-stat">${deletedPatrols.length} supprimées</span>` : ''}
            <span class="stat-badge">${displayedPatrols.reduce((sum, p) => sum + p.rookieCount, 0)} rookies</span>
        </div>
        <div class="rookie-patrols-list">
            ${displayedPatrols.length === 0 ? '<div class="no-patrols">Aucune patrouille détectée</div>' : 
                displayedPatrols.slice(0, 10).map(patrol => renderPatrolCard(patrol)).join('')
            }
        </div>
        ${displayedPatrols.length > 10 ? `<div class="rookie-patrols-footer info-footer">Affichage des 10 dernières patrouilles sur ${displayedPatrols.length}</div>` : ''}
        ${displayedPatrols.length > 0 ? `
            <div class="rookie-patrols-actions">
                ${deletedPatrols.length > 0 && canCleanDeleted ? `<button class="action-btn clean-deleted-btn" id="cleanDeletedPatrolsBtn">🗑️ Nettoyer les supprimées</button>` : ''}
            </div>
        ` : ''}
    `;
    
    // Positionner le menu sous le bouton
    const buttonContainer = button.parentElement;
    buttonContainer.style.position = 'relative';
    buttonContainer.appendChild(menu);
    
    // Animation d'entrée
    setTimeout(() => menu.classList.add('show'), 10);
    
    // Gestionnaire pour nettoyer les patrouilles supprimées
    const cleanDeletedBtn = menu.querySelector('#cleanDeletedPatrolsBtn');
    if (cleanDeletedBtn) {
        cleanDeletedBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Voulez-vous supprimer définitivement les ${deletedPatrols.length} patrouille(s) supprimée(s) de l'historique ?`)) {
                try {
                    const deletedCardIds = deletedPatrols.map(p => p.cardId);
                    await cleanDeletedPatrolsAPI(deletedCardIds);
                    
                    // Mettre à jour le state local
                    setRookiePatrols(activePatrols);
                    
                    menu.remove();
                    // Rouvrir le menu pour voir les changements
                    setTimeout(() => showRookiePatrolsModal(), 100);
                } catch (error) {
                    alert('Erreur lors du nettoyage des patrouilles');
                }
            }
        });
    }

    // Fermer en cliquant ailleurs
    setTimeout(() => {
        document.addEventListener('click', function clickOutside(e) {
            if (!menu.contains(e.target) && e.target !== button) {
                menu.remove();
                document.removeEventListener('click', clickOutside);
            }
        });
    }, 100);
    
    // Fermer avec Escape
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            menu.remove();
            document.removeEventListener('keydown', escHandler);
        }
    });
}
