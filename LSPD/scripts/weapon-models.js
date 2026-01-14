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
    const tableBody = document.querySelector('#armesTable tbody');
    const searchInput = document.getElementById('searchInput');
    const imagePreviewModal = document.getElementById('imagePreviewModal');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');

    // Preview dynamique de l'image dans la modal
    imageUrlInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        if (url) {
            imagePreviewModal.src = url;
            imagePreviewModal.style.display = 'block';
            imagePreviewModal.onerror = () => {
                imagePreviewModal.style.display = 'none';
            };
        } else {
            imagePreviewModal.style.display = 'none';
        }
    });

    // Affiche le preview si on ouvre la modal avec une valeur déjà présente
    modal.addEventListener('show', () => {
        const url = imageUrlInput.value.trim();
        if (url) {
            imagePreviewModal.src = url;
            imagePreviewModal.style.display = 'block';
        } else {
            imagePreviewModal.style.display = 'none';
        }
    });
    let modelsCache = [];
    const loader = document.getElementById('loaderOverlay');

    async function loadModels(){
        // show loading in table body
        if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#7f8c8d;padding:40px;">Chargement...</td></tr>';
        try{
            const res = await fetch('/api/weapon_models');
            if(!res.ok) throw new Error('Erreur');
            const data = await res.json();
            const models = data.models || [];
            modelsCache = models;
            if(models.length === 0){
                if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#7f8c8d;padding:40px;">Aucun modèle</td></tr>';
                return;
            }
            renderModels(models);
        }catch(err){
            console.error('Erreur chargement modèles', err);
            if(tableBody) tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#e74c3c;padding:40px;">Erreur chargement</td></tr>';
        }
    }

    function renderModels(list){
        if(!tableBody) return;
        tableBody.innerHTML = '';
        list.forEach(m => {
            const tr = document.createElement('tr');

            // ID cell
            const idTd = document.createElement('td');
            idTd.textContent = m.id;

            // Photo cell
            const photoTd = document.createElement('td');
            if (m.image_url) {
                const img = document.createElement('img');
                img.src = m.image_url;
                img.alt = m.model_name;
                photoTd.appendChild(img);
            } else {
                const noPhoto = document.createElement('span');
                noPhoto.className = 'no-photo';
                noPhoto.textContent = '🔫';
                photoTd.appendChild(noPhoto);
            }

            // Model cell
            const modelTd = document.createElement('td');
            modelTd.textContent = m.model_name;

            // Calibre cell
            const calibreTd = document.createElement('td');
            calibreTd.textContent = m.calibre || '-';

            // Actions cell
            const actionsTd = document.createElement('td');
            const delBtn = document.createElement('button');
            delBtn.className = 'btn-icon btn-danger';
            delBtn.title = 'Supprimer';
            delBtn.innerHTML = '<i data-lucide="trash-2"></i>';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Ouvre la modale de confirmation suppression
                const deleteModal = document.getElementById('deleteConfirmModal');
                const deleteText = document.getElementById('deleteConfirmText');
                deleteText.textContent = `Voulez-vous vraiment supprimer le modèle "${m.model_name}" ?`;
                deleteModal.style.display = 'flex';

                // Nettoyage des anciens listeners
                const confirmBtn = document.getElementById('confirmDeleteBtn');
                const cancelBtn = document.getElementById('cancelDeleteBtn');
                const closeBtn = document.getElementById('deleteModalClose');

                // Remove previous listeners
                confirmBtn.onclick = null;
                cancelBtn.onclick = null;
                closeBtn.onclick = null;

                confirmBtn.onclick = async () => {
                    deleteModal.style.display = 'none';
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
                };
                cancelBtn.onclick = () => { deleteModal.style.display = 'none'; };
                closeBtn.onclick = () => { deleteModal.style.display = 'none'; };
            });

            actionsTd.appendChild(delBtn);

            tr.appendChild(idTd);
            tr.appendChild(photoTd);
            tr.appendChild(calibreTd);
            tr.appendChild(modelTd);
            tr.appendChild(actionsTd);

            // Clic sur la ligne = modifier
            tr.addEventListener('click', (e) => {
                // Ignore si clic sur le bouton supprimer
                if (e.target === delBtn || e.target.closest('.btn-icon')) return;
                modelIdInput.value = m.id;
                modelNameInput.value = m.model_name || '';
                imageUrlInput.value = m.image_url || '';
                document.getElementById('calibre_modal').value = m.calibre || '';
                modalTitle.textContent = 'Modifier le modèle';
                // Affiche le preview si une image existe
                if (imageUrlInput.value.trim()) {
                    imagePreviewModal.src = imageUrlInput.value.trim();
                    imagePreviewModal.style.display = 'block';
                } else {
                    imagePreviewModal.style.display = 'none';
                }
                modal.style.display = 'flex';
            });

            tableBody.appendChild(tr);
        });
        // Refresh Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    function escapeHtml(text){
        if(!text) return '';
        return text.replace(/[&<>\"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":"&#39;"}[m]; });
    }

    // open add modal
    if (openAddBtn && modal) {
        openAddBtn.addEventListener('click', () => {
            modelIdInput.value = '';
            modelNameInput.value = '';
            imageUrlInput.value = '';
            document.getElementById('calibre_modal').value = '';
            modalTitle.textContent = 'Ajouter un modèle';
            imagePreviewModal.style.display = 'none';
            modal.style.display = 'flex';
        });
    }

    // search filter
    if(searchInput){
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.trim().toLowerCase();
            if(!q) return renderModels(modelsCache);
            const filtered = modelsCache.filter(m => {
                return (m.model_name && m.model_name.toLowerCase().includes(q)) || (String(m.id).includes(q));
            });
            renderModels(filtered);
        });
    }

    // cancel modal
    if (cancelModelBtn && modal) {
        cancelModelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // close icon
    const modalClose = document.getElementById('modalClose');
    if (modalClose && modal) {
        modalClose.addEventListener('click', () => { modal.style.display = 'none'; });
    }

    // clicking on overlay closes modal
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    // save (create or update)
    if (saveModelBtn) {
        saveModelBtn.addEventListener('click', async () => {
        const name = modelNameInput.value.trim();
        const url = imageUrlInput.value.trim();
        const calibre = document.getElementById('calibre_modal').value.trim();
        const id = modelIdInput.value;
        if (!name || !calibre) { showNotification('Nom et calibre requis', 'error'); return; }
        try {
            loader.style.display = 'flex';
            if (!id) {
                const res = await fetch('/api/weapon_models', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model_name: name, image_url: url, calibre })
                });
                if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erreur'); }
                showNotification('Modèle ajouté', 'success');
            } else {
                const res = await fetch(`/api/weapon_models/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model_name: name, image_url: url, calibre })
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
    }

    const backlinkBtn = document.getElementById('backlinkBtn');
    if (backlinkBtn) {
        backlinkBtn.addEventListener('click', () => { window.history.back(); });
    }

    loadModels();
});
