// LSPD/scripts/admin-delits.js

document.addEventListener('DOMContentLoaded', async () => {
    const delitsTbody = document.getElementById('delitsTbody');
    const searchInput = document.getElementById('searchInput');
    const saveDelitBtn = document.getElementById('saveDelitBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const delitForm = document.getElementById('delitForm');
    const formTitle = document.getElementById('formTitle');
    const loader = document.getElementById('loaderOverlay');
    const backlinkBtn = document.getElementById('backlinkBtn');
    const typeFilter = document.getElementById('typeFilter');

    let allDelits = [];
    let isEditing = false;

    if (backlinkBtn) {
        backlinkBtn.addEventListener('click', () => window.history.back());
    }

    // Charger les délits
    async function loadDelits() {
        loader.style.display = 'flex';
        try {
            const res = await fetch('/api/getDelits');
            if (!res.ok) throw new Error('Erreur lors du chargement');
            allDelits = await res.json();
            filterAndRender();
        } catch (err) {
            console.error(err);
            alert('Erreur lors du chargement des délits');
        } finally {
            loader.style.display = 'none';
        }
    }

    function renderDelits(delits) {
        delitsTbody.innerHTML = '';

        // Tri par type : Contravention > Délit mineur > Délit majeur > Crime
        const typeOrder = {
            'contravention': 1,
            'délit mineur': 2,
            'délit majeur': 3,
            'crime': 4
        };

        const sortedDelits = [...delits].sort((a, b) => {
            const orderA = typeOrder[a.type?.toLowerCase()] || 99;
            const orderB = typeOrder[b.type?.toLowerCase()] || 99;
            
            if (orderA !== orderB) return orderA - orderB;
            // Si même type, tri par code article ou nom
            return (a.code_article || '').localeCompare(b.code_article || '') || a.chef_accusation.localeCompare(b.chef_accusation);
        });

        sortedDelits.forEach(delit => {
            const tr = document.createElement('tr');
            
            let typeClass = '';
            const type = delit.type?.toLowerCase() || '';
            if (type.includes('contravention')) typeClass = 'type-contravention';
            else if (type.includes('mineur')) typeClass = 'type-delit-mineur';
            else if (type.includes('majeur')) typeClass = 'type-delit-majeur';
            else if (type.includes('crime')) typeClass = 'type-crime';

            tr.innerHTML = `
                <td>${delit.code_article || '-'}</td>
                <td><strong>${delit.chef_accusation}</strong><br><small style="color: #666;">${delit.commentaire || ''}</small></td>
                <td><span class="type-badge ${typeClass}">${delit.type}</span></td>
                <td>${delit.amende || '-'}</td>
                <td>${delit.peine || '-'}</td>
                <td class="td-actions">
                    <div class="actions-container">
                        <button class="btn-action edit edit-btn" title="Modifier" data-id="${delit.id}">
                            <span class="material-symbols-rounded">edit</span>
                        </button>
                        <button class="btn-action delete delete-btn" title="Supprimer" data-id="${delit.id}">
                            <span class="material-symbols-rounded">delete</span>
                        </button>
                    </div>
                </td>
            `;
            delitsTbody.appendChild(tr);
        });

        // Attach events
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => startEdit(btn.dataset.id));
        });
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => confirmDelete(btn.dataset.id));
        });
    }

    // Recherche et Filtre
    function filterAndRender() {
        const query = searchInput.value.toLowerCase();
        const typeValue = typeFilter.value;

        const filtered = allDelits.filter(d => {
            const matchesSearch = d.chef_accusation.toLowerCase().includes(query) || 
                                 (d.code_article && d.code_article.toLowerCase().includes(query)) ||
                                 d.type.toLowerCase().includes(query);
            
            const matchesType = typeValue === 'all' || d.type === typeValue;

            return matchesSearch && matchesType;
        });

        renderDelits(filtered);
    }

    searchInput.addEventListener('input', filterAndRender);
    typeFilter.addEventListener('change', filterAndRender);

    // Ajouter / Modifier
    saveDelitBtn.addEventListener('click', async () => {
        const id = document.getElementById('delitId').value;
        const payload = {
            chef_accusation: document.getElementById('chef_accusation').value,
            code_article: document.getElementById('code_article').value,
            type: document.getElementById('type').value,
            amende: document.getElementById('amende').value,
            peine: document.getElementById('peine').value,
            commentaire: document.getElementById('commentaire').value
        };

        if (!payload.chef_accusation || !payload.type) {
            alert('Le chef d\'accusation et le type sont obligatoires');
            return;
        }

        loader.style.display = 'flex';
        try {
            const url = isEditing ? `/api/delits/${id}` : '/api/delits';
            const method = isEditing ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Erreur lors de l\'enregistrement');
            
            resetForm();
            await loadDelits();
        } catch (err) {
            console.error(err);
            alert('Erreur lors de l\'enregistrement');
        } finally {
            loader.style.display = 'none';
        }
    });

    function startEdit(id) {
        const delit = allDelits.find(d => d.id == id);
        if (!delit) return;

        isEditing = true;
        formTitle.textContent = 'Modifier le délit';
        document.getElementById('delitId').value = delit.id;
        document.getElementById('chef_accusation').value = delit.chef_accusation;
        document.getElementById('code_article').value = delit.code_article || '';
        document.getElementById('type').value = delit.type;
        document.getElementById('amende').value = delit.amende;
        document.getElementById('peine').value = delit.peine;
        document.getElementById('commentaire').value = delit.commentaire || '';

        saveDelitBtn.textContent = 'Mettre à jour';
        cancelEditBtn.style.display = 'inline-block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    cancelEditBtn.addEventListener('click', resetForm);

    function resetForm() {
        isEditing = false;
        formTitle.textContent = 'Ajouter un nouveau délit';
        document.getElementById('delitId').value = '';
        document.getElementById('chef_accusation').value = '';
        document.getElementById('code_article').value = '';
        document.getElementById('type').value = 'Contravention';
        document.getElementById('amende').value = '';
        document.getElementById('peine').value = '';
        document.getElementById('commentaire').value = '';
        saveDelitBtn.textContent = 'Enregistrer';
        cancelEditBtn.style.display = 'none';
    }

    // Suppression
    let delitToDelete = null;
    const confirmPopup = document.getElementById('confirmPopup');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

    function confirmDelete(id) {
        delitToDelete = id;
        confirmPopup.style.display = 'flex';
    }

    cancelDeleteBtn.addEventListener('click', () => {
        confirmPopup.style.display = 'none';
        delitToDelete = null;
    });

    confirmDeleteBtn.addEventListener('click', async () => {
        if (!delitToDelete) return;
        confirmPopup.style.display = 'none';
        loader.style.display = 'flex';
        try {
            const res = await fetch(`/api/delits/${delitToDelete}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Erreur lors de la suppression');
            await loadDelits();
        } catch (err) {
            console.error(err);
            alert('Erreur lors de la suppression');
        } finally {
            loader.style.display = 'none';
            delitToDelete = null;
        }
    });

    // Initialisation
    loadDelits();
});
