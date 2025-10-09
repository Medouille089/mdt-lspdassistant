import { boardData, availableTags, addRookiePatrol, getRookiePatrols } from './state.js';
import { getCardTags } from './utils.js';

/**
 * Crée le HTML d'une carte comme dans le board (inspiré de renderCard)
 */
function renderPatrolCard(patrol) {
    const timestamp = patrol.timestamp 
        ? new Date(patrol.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : '';
    
    // Créer la description avec les infos des rookies
    let description = `🎓 Rookie${patrol.rookieCount > 1 ? 's' : ''} en patrouille:\n`;
    
    patrol.rookies.forEach(r => {
        const fullName = r.name.includes('|') 
            ? r.name.split('|')[1]?.trim() 
            : r.name;
        const nameParts = fullName?.split(' ') || [];
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        description += `\n👮 Badge ${r.badge}\n`;
        description += `   Prénom: ${firstName}\n`;
        if (lastName) {
            description += `   Nom: ${lastName}\n`;
        }
        if (r.tags.length > 0) {
            description += `   Tags: ${r.tags.join(', ')}\n`;
        }
    });
    
    return `
        <div class="card patrol-rookie-card" data-patrol-id="${patrol.cardId}">
            ${timestamp ? `<span class="card-timestamp" title="Heure de détection">${timestamp}</span>` : ''}
            <div class="card-content">
                <div class="card-title">🚓 ${patrol.patrolName}</div>
                <div class="card-description">
                    ${description.split('\n').map(line => `<div>${line || '&nbsp;'}</div>`).join('')}
                </div>
                <div class="card-badges">
                    <span class="patrol-badge rookie-count">${patrol.rookieCount} rookie${patrol.rookieCount > 1 ? 's' : ''}</span>
                    <span class="patrol-badge total-count">${patrol.totalCount} agents</span>
                </div>
            </div>
        </div>
    `;
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
        
        addRookiePatrol({
            cardId: card.id,
            patrolName: patrolText,
            listName: list?.title || 'Unknown',
            listId: listId,
            badges: patrolBadges,
            rookies: rookiesInPatrol,
            allMembers: allMembersInPatrol,
            rookieCount: rookiesInPatrol.length,
            totalCount: patrolBadges.length
        });
        
        console.log(`🎓 Patrouille avec rookie détectée: ${patrolText}`, {
            rookies: rookiesInPatrol.map(r => r.badge).join(', '),
            total: patrolBadges.length
        });
    }
}

/**
 * Scanne toutes les cartes existantes pour détecter les patrouilles avec rookies
 */
export function scanAllPatrolsForRookies() {
    console.log('🔍 Scan des patrouilles avec rookies...');
    
    let foundCount = 0;
    
    boardData.lists.forEach(list => {
        list.cards.forEach(card => {
            if (card.text?.includes('+')) {
                checkPatrolForRookies(card, list.id);
                foundCount++;
            }
        });
    });
    
    console.log(`✅ Scan terminé. ${foundCount} patrouilles analysées.`);
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
    const button = document.getElementById('rookiePatrolsBtn');
    
    // Créer le menu
    const menu = document.createElement('div');
    menu.className = 'rookie-patrols-menu';
    menu.innerHTML = `
        <div class="rookie-patrols-menu-header">
            <div class="rookie-patrols-menu-title">🎓 Patrouilles avec Rookies</div>
        </div>
        <div class="rookie-patrols-stats">
            <span class="stat-badge">${patrols.length} patrouilles</span>
            <span class="stat-badge">${patrols.reduce((sum, p) => sum + p.rookieCount, 0)} rookies</span>
        </div>
        <div class="rookie-patrols-list">
            ${patrols.length === 0 ? '<div class="no-patrols">Aucune patrouille détectée</div>' : 
                patrols.slice().reverse().slice(0, 10).map(patrol => renderPatrolCard(patrol)).join('')
            }
        </div>
        ${patrols.length > 10 ? `<div class="rookie-patrols-footer">+ ${patrols.length - 10} autres...</div>` : ''}
    `;
    
    // Positionner le menu sous le bouton
    const buttonContainer = button.parentElement;
    buttonContainer.style.position = 'relative';
    buttonContainer.appendChild(menu);
    
    // Animation d'entrée
    setTimeout(() => menu.classList.add('show'), 10);
    
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
