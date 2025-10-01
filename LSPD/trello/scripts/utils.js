export const generateId = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);

// Patterns pour extraction automatique de tags
export const AUTO_TAG_PATTERNS = {
    'officer': /Officier 2/i,
    'k9': /K9/i,
    'metropolitan': /Metropolitan Division/i,
    'traffic': /Trafic Division/i,
    'dispatch': /Dispatch/i,
    'terrain': /Lead Terrain|Négociateur/i,
    'army': /US Army/i,
    'ppa': /PPA [12]/i
};

export const extractAutoTags = (text) => {
    return Object.entries(AUTO_TAG_PATTERNS)
        .filter(([_, pattern]) => pattern.test(text))
        .map(([tagId]) => tagId);
};

export function getCardTags(card, availableTagsList) {
    if (!card || !card.tags || !Array.isArray(card.tags)) {
        return [];
    }

    // Trier les étiquettes de la carte selon l'ordre global des étiquettes disponibles
    const sortedTags = [];
    
    // D'abord, ajouter les étiquettes dans l'ordre des availableTags
    availableTagsList.forEach(availableTag => {
        if (card.tags.includes(availableTag.id)) {
            sortedTags.push(availableTag.id);
        }
    });
    
    // Ensuite, ajouter les étiquettes qui ne sont plus dans availableTags (pour la compatibilité)
    card.tags.forEach(tagId => {
        if (!sortedTags.includes(tagId)) {
            sortedTags.push(tagId);
        }
    });

    return sortedTags;
}

// Labels et styles
export const ETAT_LABELS = {
    '10-98': { text: '✅ 10-98', color: '#164b35', textColor: '#b2ead3' },
    '10-56': { text: '🚓 10-56', color: '#5d1f1a', textColor: '#e68680' },
    '10-40': { text: '🗓️ 10-40', color: '#123263', textColor: '#789fdb' },
    '10-37': { text: '🏠 10-37', color: '#123263', textColor: '#789fdb' },
    '10-38': { text: '🚓 10-38', color: '#123263', textColor: '#789fdb' },
    '10-23': { text: '🛑 10-23', color: '#48245d', textColor: '#c691e4' },
    'code5': { text: '👁️ CODE 5', color: '#693200', textColor: '#fbc828' },
    '10-60': { text: '🟡 CODE 5 - 10-60', color: '#693200', textColor: '#fbc828' },
    '10-31': { text: '💥 Code 5 - 10-31', color: '#693200', textColor: '#fbc828' },
    '10-6': { text: '🚫 10-6 Procédures', color: '#5d1f1a', textColor: '#e68680' },
    '10-06': { text: '❓ 10-06 Divers', color: '#5d1f1a', textColor: '#e68680' },
    'bijouterie': { text: '💎 Bijouterie', color: '#5d1f1a', textColor: '#e68680' },
    '10-91': { text: '💲 10-91', color: '#5d1f1a', textColor: '#e68680' },
    'blesse': { text: '🩹 Blessé', color: '#48245d', textColor: '#c691e4' },
    '10-99': { text: '🔴 10-99', color: '#48245d', textColor: '#c691e4' },
    'pasajour': { text: '❗ PAS A JOUR', color: '#5d1f1a', textColor: '#e68680' }
};

export const getEtatLabel = (etat) => ETAT_LABELS[etat] || { text: etat, color: '#6c757d', textColor: '#ffffff' };

export const COMPACT_CARD_COLORS = [
    { id: 'gray', label: 'Gris', color: '#63666b' },
    { id: 'blue', label: 'Bleu', color: '#1558bc' },
    { id: 'red', label: 'Rouge', color: '#ae2e24' },
    { id: 'green', label: 'Vert', color: '#216e4e' },
    { id: 'purple', label: 'Violet', color: '#803fa5' },
    { id: 'bluegray', label: 'BleuGris', color: '#206a83' }
];

export function generateCustomFieldsHtml(card) {
    if (!card) return '';

    const fields = [];

    if (card.etat) {
        const etatInfo = getEtatLabel(card.etat);
        fields.push({
            label: 'ETATS',
            value: card.etatLabel || etatInfo.text,
            className: `status-${card.etat}`,
            color: etatInfo.color,
            textColor: etatInfo.textColor
        });
    }

    const simpleFields = [
        { key: 'localisation', label: 'Localisation', className: 'location-field' },
        { key: 'vehicule', label: 'Véhicule', className: 'vehicle-field' },
        { key: 'td', label: 'TD', className: 'shift-field' },
        { key: 'convoi', label: 'Convoi', className: 'convoi-field' },
        { key: 'infoSupp', label: 'INFO SUPP', className: 'info-field' },
        { key: 'infoSuppPlus', label: 'INFO SUPP+', className: 'info-field' }
    ];

    simpleFields.forEach(({ key, label, className }) => {
        if (card[key]) {
            fields.push({ label, value: card[key], className });
        }
    });

    if (fields.length === 0) return '';

    return `
        <div class="card-custom-fields">
            ${fields.map(field => {
                const colorStyle = field.color ? 
                    `background-color: ${field.color}E6; color: ${field.textColor};` : '';
                return `
                    <div class="card-field ${field.className}" title="${field.label}: ${field.value}" style="${colorStyle}">
                        <span class="card-field-label">${field.label}:</span>
                        <span class="card-field-value">${field.value}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Utilitaires de scroll
export function captureScrollState(scrollState) {
    const boardContainer = document.querySelector('.board-container');
    if (boardContainer) scrollState.boardX = boardContainer.scrollLeft;
    scrollState.lists = {};
    document.querySelectorAll('.list').forEach(listEl => {
        const id = listEl.dataset.listId;
        const scroller = listEl.querySelector('.list-content');
        if (id && scroller) scrollState.lists[id] = scroller.scrollTop;
    });
}

export function restoreScrollState(scrollState) {
    const boardContainer = document.querySelector('.board-container');
    if (boardContainer) boardContainer.scrollLeft = scrollState.boardX || 0;
    Object.entries(scrollState.lists || {}).forEach(([id, top]) => {
        const listEl = document.querySelector(`.list[data-list-id="${id}"] .list-content`);
        if (listEl) listEl.scrollTop = top;
    });
}
