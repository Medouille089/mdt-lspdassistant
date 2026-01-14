let allTags = [];

document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('loaderOverlay');
    loader.style.display = 'flex';

    try {
        await loadAllTags();
        setupEventListeners();
    } catch (err) {
        console.error('Erreur initialisation:', err);
        showNotification('Erreur lors du chargement des tags', 'error');
    } finally {
        loader.style.display = 'none';
    }
});

async function loadAllTags() {
    try {
        const res = await fetch('/api/tags'); // Fetch all tags
        if (!res.ok) throw new Error('Erreur chargement tags');
        allTags = await res.json();
        renderTagList();
    } catch (err) {
        console.error(err);
        throw err;
    }
}

function renderTagList() {
    const list = document.getElementById('adminTagList');
    const searchTerm = document.getElementById('searchTags').value.toLowerCase();
    
    list.innerHTML = '';

    const filteredTags = allTags.filter(tag => 
        tag.name.toLowerCase().includes(searchTerm) || 
        tag.type.toLowerCase().includes(searchTerm)
    );

    if (filteredTags.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #888; margin-top: 20px;">Aucun tag trouvé</p>';
        return;
    }

    filteredTags.forEach(tag => {
        const item = document.createElement('div');
        item.className = 'admin-tag-item';
        item.innerHTML = `
            <div class="admin-tag-info">
                <div class="tag-color-preview" style="background-color: ${tag.color}"></div>
                <div>
                    <div class="tag-name">${tag.name}</div>
                    <div class="tag-type-badge">${tag.type === 'citoyen' ? 'Citoyen' : 'Rapport'}</div>
                </div>
            </div>
            <div class="admin-tag-actions">
                <span class="material-symbols-rounded btn-delete-tag" title="Supprimer" data-id="${tag.id}">delete</span>
            </div>
        `;

        item.querySelector('.btn-delete-tag').addEventListener('click', () => deleteTag(tag.id, tag.name));
        list.appendChild(item);
    });
}

function setupEventListeners() {
    // Formulaire de création
    document.getElementById('createTagForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('tagName').value.trim();
        const type = document.getElementById('tagType').value;
        const color = document.getElementById('tagColor').value;

        if (!name) return;

        try {
            const res = await fetch('/api/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, type, color })
            });

            if (res.ok) {
                const newTag = await res.json();
                allTags.unshift(newTag);
                renderTagList();
                document.getElementById('createTagForm').reset();
                document.getElementById('colorHex').textContent = '#3498DB';
                showNotification('Tag créé avec succès', 'success');
            } else {
                const err = await res.json();
                showNotification(err.error || 'Erreur lors de la création', 'error');
            }
        } catch (err) {
            console.error(err);
            showNotification('Erreur serveur', 'error');
        }
    });

    // Recherche
    document.getElementById('searchTags').addEventListener('input', renderTagList);
}

async function deleteTag(id, name) {
    showConfirm(`Êtes-vous sûr de vouloir supprimer le tag "${name}" ? Cela le retirera de toutes les entités associées.`, (result) => {
        if (!result) return;

        deleteTagConfirmed(id);
    }, { yesText: 'Supprimer', noText: 'Annuler' });
}

async function deleteTagConfirmed(id) {
    try {
        const res = await fetch(`/api/tags/${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            allTags = allTags.filter(t => t.id !== id);
            renderTagList();
            showNotification('Tag supprimé', 'success');
        } else {
            showNotification('Erreur lors de la suppression', 'error');
        }
    } catch (err) {
        console.error(err);
        showNotification('Erreur serveur', 'error');
    }
}

function showNotification(message, type = 'success') {
    if (window.showNotification) {
        window.showNotification(message, type);
    } else if (window.showCustomNotification) {
        window.showCustomNotification(message, type);
    } else {
        // Fallback si aucune fonction n'est disponible
        console.log(message);
    }
}
