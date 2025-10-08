const deepClone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value ?? null)));

class OperationsManager {
    constructor() {
        this.boardState = { lists: [], tags: [] };
        this.boardVersion = 0;
        this.operationHistory = [];
    }

    loadBoardState(boardData) {
        this.boardState = this.normalizeBoard(boardData);
        this.boardVersion = 0;
        this.operationHistory = [];
    }

    getBoardState() {
        return {
            boardData: this.cloneBoard(this.boardState),
            version: this.boardVersion
        };
    }

    applyOperation(operation) {
        const initialVersion = this.boardVersion;
        const rebased = typeof operation?.baseVersion === 'number' && operation.baseVersion !== initialVersion;

        const validation = this.validateOperation(operation);
        if (!validation.valid) {
            return { success: false, error: validation.error, version: this.boardVersion, rebased };
        }

        let result;
        switch (operation.type) {
            case 'CREATE_LIST':
                result = this.applyCreateList(operation.data);
                break;
            case 'UPDATE_LIST':
                result = this.applyUpdateList(operation.data);
                break;
            case 'DELETE_LIST':
                result = this.applyDeleteList(operation.data);
                break;
            case 'CREATE_CARD':
                result = this.applyCreateCard(operation.data);
                break;
            case 'UPDATE_CARD':
                result = this.applyUpdateCard(operation.data);
                break;
            case 'DELETE_CARD':
                result = this.applyDeleteCard(operation.data);
                break;
            case 'MOVE_CARD':
                result = this.applyMoveCard(operation.data);
                break;
            case 'SET_CARD_ORDER':
                result = this.applySetCardOrder(operation.data);
                break;
            case 'UPSERT_TAG':
                result = this.applyUpsertTag(operation.data);
                break;
            case 'DELETE_TAG':
                result = this.applyDeleteTag(operation.data);
                break;
            case 'REORDER_TAGS':
                result = this.applyReorderTags(operation.data);
                break;
            default:
                result = { success: false, error: `Type d'opération inconnu: ${operation.type}` };
                break;
        }

        if (result.success) {
            this.boardVersion++;
            this.operationHistory.push({
                ...operation,
                appliedVersion: this.boardVersion,
                timestamp: Date.now()
            });
        }

        return { ...result, version: this.boardVersion, rebased };
    }

    validateOperation(operation) {
        if (!operation?.id || !operation.type || !operation.data) {
            return { valid: false, error: 'Opération incomplète' };
        }

        switch (operation.type) {
            case 'CREATE_LIST':
                return this.validateCreateList(operation.data);
            case 'UPDATE_LIST':
                return this.validateUpdateList(operation.data);
            case 'DELETE_LIST':
                return this.validateDeleteList(operation.data);
            case 'CREATE_CARD':
                return this.validateCreateCard(operation.data);
            case 'UPDATE_CARD':
                return this.validateUpdateCard(operation.data);
            case 'DELETE_CARD':
                return this.validateDeleteCard(operation.data);
            case 'MOVE_CARD':
                return this.validateMoveCard(operation.data);
            case 'SET_CARD_ORDER':
                return this.validateSetCardOrder(operation.data);
            case 'UPSERT_TAG':
                return this.validateUpsertTag(operation.data);
            case 'DELETE_TAG':
                return this.validateDeleteTag(operation.data);
            case 'REORDER_TAGS':
                return this.validateReorderTags(operation.data);
            default:
                return { valid: false, error: 'Type invalide' };
        }
    }

    validateCreateList(data) {
        if (!data?.list?.id) return { valid: false, error: 'Liste invalide' };
        if (this.boardState.lists.some(l => l.id === data.list.id)) {
            return { valid: false, error: 'Liste existe déjà' };
        }
        return { valid: true };
    }

    validateUpdateList(data) {
        if (!data?.listId || !data.updates) return { valid: false, error: 'Données de mise à jour invalides' };
        if (!this.findList(data.listId)) return { valid: false, error: `Liste ${data.listId} introuvable` };
        return { valid: true };
    }

    validateDeleteList(data) {
        if (!data?.listId) return { valid: false, error: 'Identifiant de liste manquant' };
        if (!this.findList(data.listId)) return { valid: false, error: `Liste ${data.listId} introuvable` };
        return { valid: true };
    }

    validateCreateCard(data) {
        const list = this.findList(data?.listId);
        if (!list) return { valid: false, error: `Liste ${data?.listId} introuvable` };
        if (!data?.card?.id) return { valid: false, error: 'Carte invalide' };
        if (this.findCardById(data.card.id)) return { valid: false, error: 'Carte existe déjà' };
        return { valid: true };
    }

    validateUpdateCard(data) {
        const cardInfo = this.findCardInList(data?.listId, data?.cardId);
        if (!cardInfo) return { valid: false, error: `Carte ${data?.cardId} introuvable` };
        if (!data?.updates || typeof data.updates !== 'object') {
            return { valid: false, error: 'Updates invalides' };
        }
        return { valid: true };
    }

    validateDeleteCard(data) {
        if (!this.findCardInList(data?.listId, data?.cardId)) {
            return { valid: false, error: `Carte ${data?.cardId} introuvable` };
        }
        return { valid: true };
    }

    validateMoveCard(data) {
        const fromList = this.findList(data?.fromListId);
        const toList = this.findList(data?.toListId);
        if (!fromList) return { valid: false, error: `Liste source ${data?.fromListId} introuvable` };
        if (!toList) return { valid: false, error: `Liste destination ${data?.toListId} introuvable` };
        const cardInFromList = fromList.cards.some((c) => c.id === data?.cardId);
        const cardExistsAnywhere = cardInFromList || !!this.findCardById(data?.cardId);
        if (!cardExistsAnywhere) {
            return { valid: false, error: `Carte ${data?.cardId} introuvable` };
        }
        return { valid: true };
    }

    validateSetCardOrder(data) {
        if (!this.findList(data?.listId)) {
            return { valid: false, error: `Liste ${data?.listId} introuvable` };
        }
        if (!Array.isArray(data?.orderedCardIds)) {
            return { valid: false, error: 'Ordre de cartes invalide' };
        }
        return { valid: true };
    }

    validateUpsertTag(data) {
        if (!data?.tag?.id) return { valid: false, error: 'Étiquette invalide' };
        return { valid: true };
    }

    validateDeleteTag(data) {
        if (!data?.tagId) return { valid: false, error: 'Identifiant d\'étiquette manquant' };
        if (!this.boardState.tags.some(t => t.id === data.tagId)) {
            return { valid: false, error: `Étiquette ${data.tagId} introuvable` };
        }
        return { valid: true };
    }

    validateReorderTags(data) {
        if (!Array.isArray(data?.orderedTagIds)) {
            return { valid: false, error: 'Ordre d\'étiquettes invalide' };
        }
        return { valid: true };
    }

    applyCreateList(data) {
        const list = this.sanitizeList(data.list);
        const position = this.clampPosition(
            Number.isInteger(data?.position) ? data.position : this.boardState.lists.length,
            this.boardState.lists.length
        );

        this.boardState.lists.splice(position, 0, list);

        return {
            success: true,
            diff: {
                type: 'CREATE_LIST',
                data: { list: this.cloneList(list), position }
            }
        };
    }

    applyUpdateList(data) {
        const list = this.findList(data.listId);
        Object.entries(data.updates || {}).forEach(([key, value]) => {
            if (key === 'id' || key === 'cards') return;
            if (value === null) delete list[key];
            else list[key] = value;
        });

        return {
            success: true,
            diff: {
                type: 'UPDATE_LIST',
                data: { list: this.cloneList(list), updates: data.updates }
            }
        };
    }

    applyDeleteList(data) {
        const index = this.boardState.lists.findIndex(l => l.id === data.listId);
        if (index !== -1) this.boardState.lists.splice(index, 1);
        return { success: true, diff: { type: 'DELETE_LIST', data: { listId: data.listId } } };
    }

    applyCreateCard(data) {
        const list = this.findList(data.listId);
        const card = this.sanitizeCard(data.card, this.boardState.tags);
        const position = this.clampPosition(
            Number.isInteger(data?.position) ? data.position : list.cards.length,
            list.cards.length
        );

        list.cards.splice(position, 0, card);

        return {
            success: true,
            diff: {
                type: 'CREATE_CARD',
                data: { listId: data.listId, card: this.cloneCard(card), position }
            }
        };
    }

    applyUpdateCard(data) {
        const { list, card } = this.findCardInList(data.listId, data.cardId);
        this.updateCardProperties(card, data.updates);

        return {
            success: true,
            diff: {
                type: 'UPDATE_CARD',
                data: { listId: list.id, card: this.cloneCard(card) }
            }
        };
    }

    applyDeleteCard(data) {
        const list = this.findList(data.listId);
        const index = list.cards.findIndex(c => c.id === data.cardId);
        if (index !== -1) list.cards.splice(index, 1);

        return {
            success: true,
            diff: {
                type: 'DELETE_CARD',
                data: { listId: data.listId, cardId: data.cardId }
            }
        };
    }

    applyMoveCard(data) {
        const requestedFromList = this.findList(data.fromListId);
        const toList = this.findList(data.toListId);

        if (!requestedFromList || !toList) {
            return { success: false, error: `Listes ${data.fromListId} ou ${data.toListId} introuvables` };
        }

        let sourceList = requestedFromList;
        let fromIndex = sourceList.cards.findIndex((c) => c.id === data.cardId);

        if (fromIndex === -1) {
            const fallback = this.findCardById(data.cardId);
            if (fallback) {
                sourceList = fallback.list;
                fromIndex = sourceList.cards.findIndex((c) => c.id === data.cardId);
            }
        }

        if (fromIndex === -1) {
            return { success: false, error: `Carte ${data.cardId} introuvable` };
        }

        const [card] = sourceList.cards.splice(fromIndex, 1);
        if (!card?.id) {
            return { success: false, error: `Données invalides pour la carte ${data.cardId}` };
        }

        const targetIndex = this.clampPosition(
            Number.isInteger(data?.targetIndex) ? data.targetIndex : toList.cards.length,
            toList.cards.length
        );

        const duplicateIndex = toList.cards.findIndex((existing) => existing.id === card.id);
        if (duplicateIndex !== -1) {
            toList.cards.splice(duplicateIndex, 1);
        }

        toList.cards.splice(targetIndex, 0, card);

        return {
            success: true,
            diff: {
                type: 'MOVE_CARD',
                data: {
                    cardId: data.cardId,
                    fromListId: sourceList.id,
                    toListId: toList.id,
                    targetIndex,
                    card: this.cloneCard(card)
                }
            }
        };
    }

    applySetCardOrder(data) {
        const list = this.findList(data.listId);
        if (!list) {
            return { success: false, error: `Liste ${data.listId} introuvable` };
        }
        const orderedIds = data.orderedCardIds;
        if (!Array.isArray(orderedIds)) {
            return { success: false, error: 'Ordre de cartes invalide' };
        }
        const seenIds = new Set();
        const matchedIds = new Set();

        const orderedCards = orderedIds
            .filter((id) => {
                if (seenIds.has(id)) return false;
                seenIds.add(id);
                return true;
            })
            .map((id) => {
                const card = list.cards.find((candidate) => candidate.id === id);
                if (card) matchedIds.add(id);
                return card || null;
            })
            .filter(Boolean);

        const remainingCards = list.cards.filter((card) => !matchedIds.has(card.id));

        list.cards = [...orderedCards, ...remainingCards];
        const finalOrder = list.cards.map((card) => card.id);

        return {
            success: true,
            diff: {
                type: 'SET_CARD_ORDER',
                data: { listId: data.listId, orderedCardIds: finalOrder }
            }
        };
    }

    applyUpsertTag(data) {
        const tag = this.sanitizeTag(data.tag);
        const existingIndex = this.boardState.tags.findIndex(t => t.id === tag.id);

        if (existingIndex === -1) {
            const position = this.clampPosition(
                Number.isInteger(data?.position) ? data.position : this.boardState.tags.length,
                this.boardState.tags.length
            );
            this.boardState.tags.splice(position, 0, tag);
        } else {
            const replacement = this.cloneTag({ ...this.boardState.tags[existingIndex], ...tag });
            this.boardState.tags.splice(existingIndex, 1, replacement);
            if (Number.isInteger(data?.position)) {
                const [moved] = this.boardState.tags.splice(existingIndex, 1);
                const position = this.clampPosition(data.position, this.boardState.tags.length);
                this.boardState.tags.splice(position, 0, moved);
            }
        }

        return {
            success: true,
            diff: {
                type: 'UPSERT_TAG',
                data: { tag: this.cloneTag(tag), position: data.position }
            }
        };
    }

    applyDeleteTag(data) {
        const index = this.boardState.tags.findIndex(t => t.id === data.tagId);
        if (index !== -1) this.boardState.tags.splice(index, 1);
        this.removeTagFromCards(data.tagId);

        return {
            success: true,
            diff: { type: 'DELETE_TAG', data: { tagId: data.tagId } }
        };
    }

    applyReorderTags(data) {
        const orderedIds = data.orderedTagIds;
        const orderedSet = new Set(orderedIds);

        const orderedTags = orderedIds
            .map(id => this.boardState.tags.find(tag => tag.id === id))
            .filter(Boolean);
        const remainingTags = this.boardState.tags.filter(tag => !orderedSet.has(tag.id));

        this.boardState.tags = [...orderedTags, ...remainingTags];

        return {
            success: true,
            diff: { type: 'REORDER_TAGS', data: { orderedTagIds: orderedIds } }
        };
    }

    cloneCard(card) {
        return deepClone(card) || { id: '' };
    }

    cloneList(list) {
        return {
            id: list.id,
            title: list.title || '',
            cards: Array.isArray(list.cards) ? list.cards.map((card) => this.cloneCard(card)) : []
        };
    }

    cloneTag(tag) {
        return deepClone(tag) || { id: '' };
    }

    normalizeBoard(boardData = {}) {
        const tags = Array.isArray(boardData?.tags) ? boardData.tags.map(tag => this.sanitizeTag(tag)) : [];
        const lists = Array.isArray(boardData?.lists)
            ? boardData.lists
                .filter(list => list?.id)
                .map(list => ({
                    id: list.id,
                    title: list.title || '',
                    cards: Array.isArray(list.cards)
                        ? list.cards.filter(card => card?.id).map(card => this.sanitizeCard(card, tags))
                        : []
                }))
            : [];
        return { lists, tags };
    }

    sanitizeList(list) {
        return {
            id: list.id,
            title: list.title || '',
            cards: Array.isArray(list.cards)
                ? list.cards.filter(card => card?.id).map(card => this.sanitizeCard(card, this.boardState.tags))
                : []
        };
    }

    sanitizeCard(card, knownTags) {
        const copy = deepClone(card) || {};
        copy.id = copy.id || '';
        copy.text = copy.text ?? '';
        copy.description = copy.description ?? '';
        copy.type = copy.type || 'text';
        copy.image = copy.image ?? null;
        copy.tags = Array.isArray(copy.tags)
            ? copy.tags.filter(id => knownTags.some(tag => tag.id === id))
            : [];
        return copy;
    }

    sanitizeTag(tag) {
        const copy = deepClone(tag) || {};
        copy.id = copy.id || '';
        copy.label = copy.label || '';
        copy.color = copy.color || '#63666b';
        copy.textColor = copy.textColor ?? null;
        return copy;
    }

    updateCardProperties(card, updates = {}) {
        Object.entries(updates).forEach(([key, value]) => {
            if (key === 'id' || key === 'listId') return;

            if (key === 'tags') {
                card.tags = Array.isArray(value)
                    ? value.filter(id => this.boardState.tags.some(tag => tag.id === id))
                    : [];
                return;
            }

            if (value === null) delete card[key];
            else card[key] = value;
        });
    }

    findList(listId) {
        return this.boardState.lists.find(list => list.id === listId);
    }

    findCardInList(listId, cardId) {
        const list = this.findList(listId);
        if (!list) return null;
        const card = list.cards.find(c => c.id === cardId);
        if (!card) return null;
        return { list, card };
    }

    findCardById(cardId) {
        for (const list of this.boardState.lists) {
            const card = list.cards.find(c => c.id === cardId);
            if (card) return { list, card };
        }
        return null;
    }

    removeTagFromCards(tagId) {
        this.boardState.lists.forEach(list => {
            list.cards.forEach(card => {
                if (Array.isArray(card.tags)) {
                    card.tags = card.tags.filter(id => id !== tagId);
                }
            });
        });
    }

    clampPosition(position, length) {
        if (!Number.isInteger(position)) return length;
        return Math.max(0, Math.min(position, length));
    }

    cloneBoard(board) {
        return deepClone(board) || { lists: [], tags: [] };
    }
}

module.exports = { OperationsManager };