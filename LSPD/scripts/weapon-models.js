document.addEventListener('DOMContentLoaded', () => {
    const openAddBtn = document.getElementById('openAddModel');
    const modal = document.getElementById('weaponModelModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalForm = document.getElementById('modalForm');
    const modelNameInput = document.getElementById('model_name_modal');
    const imageUrlInput = document.getElementById('image_url_modal');
    const modelIdInput = document.getElementById('model_id_modal');
    const saveModelBtn = document.getElementById('saveModelBtn');
    const cancelModelBtn = document.getElementById('cancelModelBtn');
    const modelsList = document.getElementById('modelsList');
    const loader = document.getElementById('loaderOverlay');

    async function loadModels(){
        modelsList.innerHTML = '<div style="color:#7f8c8d">Chargement...</div>';
        try{
            const res = await fetch('/api/weapon_models');
            if(!res.ok) throw new Error('Erreur');
            const data = await res.json();
            const models = data.models || [];
            if(models.length === 0){
                modelsList.innerHTML = '<div style="color:#7f8c8d">Aucun modèle</div>';
                return;
            }
            modelsList.innerHTML = '';
            models.forEach(m => {
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.justifyContent = 'space-between';
                item.style.border = '1px solid #eee';
                item.style.padding = '8px';
                item.style.borderRadius = '6px';

                const left = document.createElement('div');
                left.style.display = 'flex';
                left.style.alignItems = 'center';
                left.style.gap = '10px';

                const img = document.createElement('img');
                img.src = m.image_url || '/data/images/weapon-placeholder.png';
                img.style.width = '64px';
                img.style.height = '40px';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '6px';

                const title = document.createElement('div');
                title.innerHTML = `<strong>${m.model_name}</strong><div style="color:#7f8c8d; font-size:12px;">ID: ${m.id}</div>`;

                left.appendChild(img);
                left.appendChild(title);

                const actions = document.createElement('div');
                actions.style.display = 'flex';
                actions.style.gap = '8px';

                const editBtn = document.createElement('button');
                editBtn.className = 'btn btn-warning';
                editBtn.textContent = 'Modifier';
                editBtn.addEventListener('click', () => {
                    // open modal in edit mode
                    modelIdInput.value = m.id;
                    modelNameInput.value = m.model_name || '';
                    imageUrlInput.value = m.image_url || '';
                    modalTitle.textContent = 'Modifier le modèle';
                    modal.style.display = 'flex';
                });

                const del = document.createElement('button');
                del.className = 'btn btn-danger';
                del.textContent = 'Supprimer';
                del.addEventListener('click', async () => {
                    if(!confirm(`Supprimer le modèle "${m.model_name}" ?`)) return;
                    try{
                        loader.style.display = 'flex';
                        const r = await fetch(`/api/weapon_models/${m.id}`, { method: 'DELETE' });
                        if(!r.ok){ const e = await r.json(); throw new Error(e.error || 'Erreur'); }
                        showNotification('Modèle supprimé', 'success');
                        await loadModels();
                    }catch(err){
                        console.error(err);
                        showNotification(err.message || 'Erreur suppression', 'error');
                    }finally{ loader.style.display = 'none'; }
                });

                actions.appendChild(editBtn);
                actions.appendChild(del);

                item.appendChild(left);
                item.appendChild(actions);

                modelsList.appendChild(item);
            });
        }catch(err){
            console.error('Erreur chargement modèles', err);
            modelsList.innerHTML = '<div style="color:#e74c3c">Erreur chargement</div>';
        }
    }

    // open add modal
    openAddBtn.addEventListener('click', () => {
        modelIdInput.value = '';
        modelNameInput.value = '';
        imageUrlInput.value = '';
        modalTitle.textContent = 'Ajouter un modèle';
        modal.style.display = 'flex';
    });

    // cancel modal
    cancelModelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // close icon
    const modalClose = document.getElementById('modalClose');
    if (modalClose) {
        modalClose.addEventListener('click', () => { modal.style.display = 'none'; });
    }

    // clicking on overlay closes modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    // save (create or update)
    saveModelBtn.addEventListener('click', async () => {
        const name = modelNameInput.value.trim();
        const url = imageUrlInput.value.trim();
        const id = modelIdInput.value;
        if (!name) { showNotification('Nom requis', 'error'); return; }
        try {
            loader.style.display = 'flex';
            if (!id) {
                const res = await fetch('/api/weapon_models', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model_name: name, image_url: url })
                });
                if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erreur'); }
                showNotification('Modèle ajouté', 'success');
            } else {
                const res = await fetch(`/api/weapon_models/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model_name: name, image_url: url })
                });
                if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erreur'); }
                showNotification('Modèle mis à jour', 'success');
            }
            modal.style.display = 'none';
            await loadModels();
        } catch (err) {
            console.error('Erreur sauvegarde modèle', err);
            showNotification(err.message || 'Erreur sauvegarde', 'error');
        } finally {
            loader.style.display = 'none';
        }
    });

    document.getElementById('backlinkBtn').addEventListener('click', () => { window.history.back(); });

    loadModels();
});
