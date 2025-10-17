// --- Animation feedback ---
function showAnimation(type = 'success', message = '') {
    return new Promise((resolve) => {
        const container = document.getElementById('feedbackAnimation');
        container.innerHTML = ''; // reset

        const content = document.createElement('div');
        content.className = 'feedback-inner';

        if (type === 'success') {
            content.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2" width="100" height="100">
                    <circle class="path circle" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-miterlimit="10" cx="65.1" cy="65.1" r="60"/>
                    <polyline class="path check" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" points="100.2,40.2 51.5,88.8 29.8,67.5 "/>
                </svg>
                <p class="success">${message || 'Opération réussie !'}</p>
            `;
        } else {
            content.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2" width="100" height="100">
                    <circle class="path circle" fill="none" stroke="#D06079" stroke-width="8" stroke-miterlimit="10" cx="65.1" cy="65.1" r="60"/>
                    <line class="path line" fill="none" stroke="#D06079" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" x1="34.4" y1="37.9" x2="95.8" y2="92.3"/>
                    <line class="path line" fill="none" stroke="#D06079" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" x1="95.8" y1="38" x2="34.4" y2="92.2"/>
                </svg>
                <p class="error">${message || "Erreur lors de l'opération"}</p>
            `;
        }

        container.appendChild(content);
        container.style.display = 'flex';

        setTimeout(() => {
            container.style.display = 'none';
            container.innerHTML = '';
            resolve();
        }, 1800);
    });
}

// --- Confirm popups ---
function showConfirm(message = 'Confirmer ?', timeout = 0) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customConfirm');
        const msg = document.getElementById('confirmMessage');
        const cancelBtn = document.getElementById('confirmCancelBtn');
        const okBtn = document.getElementById('confirmOkBtn');

        msg.textContent = message;
        overlay.style.display = 'flex';

        function cleanup() {
            overlay.style.display = 'none';
            cancelBtn.removeEventListener('click', onCancel);
            okBtn.removeEventListener('click', onOk);
        }

        function onCancel() { cleanup(); resolve(false); }
        function onOk() { cleanup(); resolve(true); }

        cancelBtn.addEventListener('click', onCancel);
        okBtn.addEventListener('click', onOk);

        if (timeout > 0) {
            setTimeout(() => { cleanup(); resolve(false); }, timeout);
        }
    });
}

// --- Gestion des catégories ---
let editingCategoryId = null;
let isSubmitting = false;
let modalMode = 'create'; // 'create' or 'edit'

// --- Edit modal mode (popup) ---
let editingCategoryIdModal = null;
function openEditModal(cat) {
    modalMode = 'edit';
    editingCategoryIdModal = cat.id;
    document.getElementById('edit_title').value = cat.title || '';
    document.getElementById('edit_emoji').value = cat.emoji || '';
    document.getElementById('edit_prefix').value = cat.prefix || '';
    // set selected category/channel in modal select (if present)
    const editTargetSelect = document.getElementById('edit_targetCategorySelect');
    if (editTargetSelect) {
        editTargetSelect.value = cat.target_channel_id || '';
    }
    document.getElementById('edit_description').value = cat.description || '';
    document.getElementById('edit_welcomeMessage').value = cat.welcome_message || '';
    document.getElementById('edit_categoryEmbedColor').value = cat.embed_color || '#00ff00';
    document.getElementById('edit_visibleCheckbox').checked = !!cat.visible;
    // populate selected roles in modal
    const container = document.getElementById('edit_selectedRolesContainer');
    container.innerHTML = '';
    (cat.roles || []).forEach(id => {
        // try to get name from select
        const select = document.getElementById('edit_rolesSelect');
        let name = id;
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value === id) { name = select.options[i].text; break; }
        }
        container.appendChild(createRoleChip(id, name));
    });
    document.getElementById('editSaveBtn').textContent = 'Enregistrer';
    document.getElementById('editCategoryTitle').textContent = 'Modifier la catégorie';
    document.getElementById('editCategoryModal').style.display = 'flex';
}

function closeEditModal() {
    editingCategoryIdModal = null;
    document.getElementById('editCategoryForm').reset();
    document.getElementById('editCategoryModal').style.display = 'none';
}

async function fetchCategories() {
    const res = await fetch('/api/ticket-categories');
    const categories = await res.json();
    const container = document.getElementById('categoriesContainer');
    container.innerHTML = '';
    categories.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'category';
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.innerHTML = `
            <strong>${cat.emoji || ''} ${cat.title}</strong> <span class="small">(#${cat.id})</span><br>
            <div class="small">${cat.description || ''}</div>
            <div class="small">Prefix: ${cat.prefix || '-'} | Catégorie cible: ${cat.target_channel_id || '-'}</div>
            <div class="small">Roles: ${(cat.roles || []).join(', ')}</div>
            <div class="small">Visible: ${cat.visible ? 'oui' : 'non'}</div>
        `;
        const actions = document.createElement('div');
        actions.style.textAlign = 'right';

        // toggle visible
        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.checked = !!cat.visible;
        toggle.addEventListener('change', async () => {
            try {
                const r = await fetch(`/api/ticket-categories/${cat.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ visible: toggle.checked })
                });
                if (!r.ok) throw new Error('Erreur serveur');
                await showAnimation('success', 'Visibilité mise à jour');
            } catch (e) {
                await showAnimation('error', 'Impossible de mettre à jour');
                toggle.checked = !toggle.checked; // revert
            } finally {
                fetchCategories();
            }
        });

        // delete button
        const del = document.createElement('button');
        del.textContent = '✖';
        del.title = 'Supprimer la catégorie';
        del.style.marginLeft = '8px';
        del.addEventListener('click', async () => {
            const confirmed = await showConfirm(`Supprimer la catégorie « ${cat.title} » ?`);
            if (!confirmed) return;

            try {
                const r = await fetch(`/api/ticket-categories/${cat.id}`, { method: 'DELETE' });
                if (r.status === 204) {
                    await showAnimation('success', 'Catégorie supprimée');
                    fetchCategories();
                } else {
                    const txt = await r.text();
                    throw new Error(txt || 'Erreur');
                }
            } catch (e) {
                await showAnimation('error', 'Erreur lors de la suppression');
            }
        });

        // edit button
        const edit = document.createElement('button');
        edit.textContent = '✎';
        edit.title = 'Éditer (charge dans le formulaire)';
        edit.style.marginLeft = '8px';
        edit.addEventListener('click', () => {
            // open modal for editing instead of loading into create form
            openEditModal(cat);
        });

        actions.appendChild(toggle);
        actions.appendChild(edit);
        actions.appendChild(del);
        div.appendChild(meta);
        div.appendChild(actions);
        container.appendChild(div);
    });
}

async function fetchChannels() {
    const res = await fetch('/api/discord-channels');
    const channels = await res.json();
    const select = document.getElementById('panelChannel');
    select.innerHTML = '';
    // helper to detect category-type channels (supports numeric or string types)
    function isCategoryType(t) {
        if (typeof t === 'number') return t === 4; // discord numeric type for category
        if (!t) return false;
        const s = String(t).toLowerCase();
        return s === 'guild_category' || s === 'category' || s.includes('category');
    }

    // optionally populate the edit modal's category select
    const editCatSelect = document.getElementById('edit_targetCategorySelect');
    if (editCatSelect) {
        editCatSelect.innerHTML = '';
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '— Aucune —';
        editCatSelect.appendChild(emptyOpt);
    }

    channels.forEach(ch => {
        // if category-type, add only to editCatSelect
        if (isCategoryType(ch.type)) {
            if (editCatSelect) {
                const copt = document.createElement('option');
                copt.value = ch.id;
                copt.textContent = ch.name;
                editCatSelect.appendChild(copt);
            }
            return; // skip adding to panelChannel
        }

        // otherwise consider it a text channel and add to the panelChannel select
    const opt = document.createElement('option');
    opt.value = ch.id;
    opt.textContent = ch.name;
    select.appendChild(opt);
    });
}

async function fetchRoles() {
    const res = await fetch('/api/discord-roles');
    const roles = await res.json();
    // populate both main select (if present) and modal select
    const selectMain = document.getElementById('rolesSelect');
    const selectModal = document.getElementById('edit_rolesSelect');
    [selectMain, selectModal].forEach(sel => {
        if (!sel) return;
        sel.innerHTML = '';
        // placeholder
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '— Sélectionner un rôle —';
        placeholder.disabled = true;
        placeholder.selected = true;
        sel.appendChild(placeholder);
        roles.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.name;
            sel.appendChild(opt);
        });
    });
}

// Tag UI pour roles (modal)
function createRoleChip(id, name) {
    const span = document.createElement('span');
    span.className = 'tag';
    span.dataset.id = id;
    span.textContent = name;
    const rem = document.createElement('span');
    rem.className = 'remove';
    rem.textContent = '✖';
    rem.addEventListener('click', () => {
        span.remove();
    });
    span.appendChild(rem);
    return span;
}

// add role immediately when selecting it in modal
const editRolesSelect = document.getElementById('edit_rolesSelect');
if (editRolesSelect) {
    editRolesSelect.addEventListener('change', () => {
        const sel = editRolesSelect;
        const id = sel.value;
        const name = sel.options[sel.selectedIndex]?.text;
        if (!id) return;
        const container = document.getElementById('edit_selectedRolesContainer');
        if (container.querySelector(`[data-id="${id}"]`)) {
            sel.selectedIndex = 0; // reset to placeholder
            return;
        }
        container.appendChild(createRoleChip(id, name || id));
        sel.selectedIndex = 0; // reset to placeholder after add
    });
}

function collectSelectedRoleIdsFromModal() {
    return Array.from(document.getElementById('edit_selectedRolesContainer').children).map(ch => ch.dataset.id);
}

// Création / édition de catégorie
// wire open create modal
document.getElementById('openCreateModal').addEventListener('click', () => {
    modalMode = 'create';
    editingCategoryIdModal = null;
    // reset modal fields
    document.getElementById('editCategoryForm').reset();
    document.getElementById('edit_selectedRolesContainer').innerHTML = '';
    document.getElementById('editSaveBtn').textContent = 'Créer';
    document.getElementById('editCategoryTitle').textContent = 'Créer une catégorie';
    document.getElementById('editCategoryModal').style.display = 'flex';
});

// adapt edit modal submit to handle create/edit
document.getElementById('editCategoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    // title and emoji required
    const title = document.getElementById('edit_title').value.trim();
    // sanitize emoji field: keep only first emoji
    function extractFirstEmoji(str) {
        // regex for most emoji sequences (including flags, modifiers)
        const emojiRegex = /\p{Extended_Pictographic}(?:\uFE0F|\u200D[\p{Extended_Pictographic}])*/u;
        const m = str.match(emojiRegex);
        return m ? m[0] : '';
    }
    let emoji = document.getElementById('edit_emoji').value.trim();
    emoji = extractFirstEmoji(emoji);
    document.getElementById('edit_emoji').value = emoji;
    if (!title || !emoji) { await showAnimation('error', 'Titre & Emoji requis'); return; }
    if (isSubmitting) return;

    const payload = {
        title,
        emoji,
        description: document.getElementById('edit_description').value || '',
        roles: collectSelectedRoleIdsFromModal(),
    target_channel_id: (document.getElementById('edit_targetCategorySelect') ? document.getElementById('edit_targetCategorySelect').value : null) || null,
        prefix: document.getElementById('edit_prefix').value || '',
        welcome_message: document.getElementById('edit_welcomeMessage').value || '',
        embed_color: document.getElementById('edit_categoryEmbedColor').value || '#00ff00',
        visible: document.getElementById('edit_visibleCheckbox').checked
    };

    isSubmitting = true;
    const saveBtn = document.getElementById('editSaveBtn');
    saveBtn.disabled = true;
    try {
        if (modalMode === 'edit' && editingCategoryIdModal) {
            const confirmed = await showConfirm('Confirmer la modification ?');
            if (!confirmed) return;
            const r = await fetch(`/api/ticket-categories/${editingCategoryIdModal}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            if (!r.ok) throw new Error('Erreur mise à jour');
            await showAnimation('success', 'Catégorie mise à jour');
        } else {
            const confirmed = await showConfirm('Confirmer la création ?');
            if (!confirmed) return;
            const r = await fetch('/api/ticket-categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!r.ok) throw new Error('Erreur création');
            await showAnimation('success', 'Catégorie créée');
        }
        closeEditModal();
        fetchCategories();
    } catch (err) {
        await showAnimation('error', err.message || 'Erreur');
    } finally {
        isSubmitting = false;
        saveBtn.disabled = false;
    }
});

// emoji input sanitation on change/blur
const emojiInput = document.getElementById('edit_emoji');
if (emojiInput) {
    function keepFirstEmoji(str) {
        const m = str.match(/\p{Extended_Pictographic}(?:\uFE0F|\u200D[\p{Extended_Pictographic}])*/u);
        return m ? m[0] : '';
    }
    // sanitize continuously to enforce only one emoji
    emojiInput.addEventListener('input', () => {
        const val = emojiInput.value || '';
        const e = keepFirstEmoji(val);
        emojiInput.value = e;
    });
    emojiInput.addEventListener('blur', () => {
        emojiInput.value = keepFirstEmoji(emojiInput.value || '');
    });
}

// Envoi du panel
document.getElementById('sendPanel').addEventListener('click', async () => {
    const confirmed = await showConfirm('send');
    if (!confirmed) return;

    const channel_id = document.getElementById('panelChannel').value;
    const embed = {
        title: document.getElementById('embedTitle').value,
        description: document.getElementById('embedDescription').value,
        color: document.getElementById('panelEmbedColor').value,
    };
    const res = await fetch('/api/send-panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id, embed })
    });

    if (res.ok) {
        await showAnimation('success', 'Panel envoyé avec succès');
    } else {
        await showAnimation('error', 'Erreur lors de l’envoi du panel');
    }
});

// --- Initial load ---
fetchCategories();
fetchChannels();
fetchRoles();
// ensure accessible focus order
document.querySelectorAll('input,select,textarea,button').forEach(el => { if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0'); });

// Edit modal event handlers
document.getElementById('editCancelBtn').addEventListener('click', () => closeEditModal());
// footer cancel
const footerCancel = document.getElementById('editCancelBtnFooter');
if (footerCancel) footerCancel.addEventListener('click', () => closeEditModal());
