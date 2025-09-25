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
function showConfirm(type = 'delete') {
    return new Promise((resolve) => {
        const overlay = document.getElementById(`customConfirm${type.charAt(0).toUpperCase() + type.slice(1)}`);
        overlay.style.display = 'flex';

        const cancelBtn = overlay.querySelector('.btn-blue');
        const confirmBtn = overlay.querySelector('.btn-red');

        function cleanup() {
            overlay.style.display = 'none';
            cancelBtn.removeEventListener('click', onCancel);
            confirmBtn.removeEventListener('click', onConfirm);
        }

        function onCancel() {
            cleanup();
            resolve(false);
        }
        function onConfirm() {
            cleanup();
            resolve(true);
        }

        cancelBtn.addEventListener('click', onCancel);
        confirmBtn.addEventListener('click', onConfirm);
    });
}

// --- Gestion des catégories ---
let editingCategoryId = null;

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
            <div class="small">Prefix: ${cat.prefix || '-'} | Salon cible: ${cat.target_channel_id || '-'}</div>
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
            await fetch(`/api/ticket-categories/${cat.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visible: toggle.checked })
            });
            fetchCategories();
        });

        // delete button
        const del = document.createElement('button');
        del.textContent = '✖';
        del.title = 'Supprimer la catégorie';
        del.style.marginLeft = '8px';
        del.addEventListener('click', async () => {
            const confirmed = await showConfirm('delete');
            if (!confirmed) return;

            const r = await fetch(`/api/ticket-categories/${cat.id}`, { method: 'DELETE' });
            if (r.status === 204) {
                await showAnimation('success', 'Catégorie supprimée avec succès');
                fetchCategories();
            } else {
                await showAnimation('error', 'Erreur lors de la suppression');
            }
        });

        // edit button
        const edit = document.createElement('button');
        edit.textContent = '✎';
        edit.title = 'Éditer (charge dans le formulaire)';
        edit.style.marginLeft = '8px';
        edit.addEventListener('click', () => loadCategoryToForm(cat));

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
    channels.forEach(ch => {
        const opt = document.createElement('option');
        opt.value = ch.id;
        opt.textContent = `${ch.name} (${ch.type})`;
        select.appendChild(opt);
    });
}

async function fetchRoles() {
    const res = await fetch('/api/discord-roles');
    const roles = await res.json();
    const select = document.getElementById('rolesSelect');
    select.innerHTML = '';
    roles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.name;
        select.appendChild(opt);
    });
}

// Tag UI pour roles
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

document.getElementById('addRoleBtn').addEventListener('click', () => {
    const sel = document.getElementById('rolesSelect');
    const id = sel.value;
    const name = sel.options[sel.selectedIndex].text;
    if (!id) return;
    const container = document.getElementById('selectedRolesContainer');
    if (container.querySelector(`[data-id="${id}"]`)) return;
    container.appendChild(createRoleChip(id, name));
});

function collectSelectedRoleIds() {
    return Array.from(document.getElementById('selectedRolesContainer').children).map(ch => ch.dataset.id);
}

// Création / édition de catégorie
document.getElementById('categoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        title: document.getElementById('title').value,
        emoji: document.getElementById('emoji').value,
        description: document.getElementById('description').value,
        roles: collectSelectedRoleIds(),
        target_channel_id: document.getElementById('targetChannel').value || null,
        prefix: document.getElementById('prefix').value || '',
        welcome_message: document.getElementById('welcomeMessage').value || '',
        embed_color: document.getElementById('categoryEmbedColor').value || '#00ff00',
        visible: document.getElementById('visibleCheckbox').checked
    };

    if (editingCategoryId) {
        const confirmed = await showConfirm('modify');
        if (!confirmed) return;

        const res = await fetch(`/api/ticket-categories/${editingCategoryId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        await showAnimation(res.ok ? 'success' : 'error', res.ok ? 'Catégorie mise à jour !' : 'Erreur mise à jour');
    } else {
        const confirmed = await showConfirm('add');
        if (!confirmed) return;

        const res = await fetch('/api/ticket-categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        await showAnimation(res.ok ? 'success' : 'error', res.ok ? 'Catégorie créée !' : 'Erreur création');
    }

    document.getElementById('categoryForm').reset();
    document.getElementById('selectedRolesContainer').innerHTML = '';
    document.querySelector('#categoryForm button[type="submit"]').textContent = 'Créer catégorie';
    editingCategoryId = null;
    fetchCategories();
});

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

function loadCategoryToForm(cat) {
    editingCategoryId = cat.id;
    document.getElementById('title').value = cat.title || '';
    document.getElementById('emoji').value = cat.emoji || '';
    document.getElementById('prefix').value = cat.prefix || '';
    document.getElementById('targetChannel').value = cat.target_channel_id || '';
    document.getElementById('description').value = cat.description || '';
    document.getElementById('welcomeMessage').value = cat.welcome_message || '';
    document.getElementById('categoryEmbedColor').value = cat.embed_color || '#00ff00';
    document.getElementById('visibleCheckbox').checked = !!cat.visible;

    const container = document.getElementById('selectedRolesContainer');
    container.innerHTML = '';
    (cat.roles || []).forEach(async id => {
        const select = document.getElementById('rolesSelect');
        let name = id;
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value === id) { name = select.options[i].text; break; }
        }
        container.appendChild(createRoleChip(id, name));
    });

    document.querySelector('#categoryForm button[type="submit"]').textContent = 'Mettre à jour catégorie';
}

// --- Initial load ---
fetchCategories();
fetchChannels();
fetchRoles();
