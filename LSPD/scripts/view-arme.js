// View weapon details - Style similaire à view-vehicule.js
(function () {
    let armeId = null;
    let armeData = null;
    let selectedProprietaireId = null;
    let isEditMode = false;
    let originalData = {};

    function getArmeIdFromURL() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    async function loadArme() {
        armeId = getArmeIdFromURL();
        if (!armeId) {
            showNotification("ID de l'arme non trouvé", 'error');
            setTimeout(() => window.location.href = '/liste-armes.html', 2000);
            return;
        }
        const loader = document.getElementById('loaderOverlay');
        loader.style.display = 'flex';
        try {
            const res = await fetch(`/api/weapons/${armeId}`);
            if (!res.ok) throw new Error('Arme non trouvée');
            armeData = await res.json();
            renderArme();
            setViewMode();
        } catch (error) {
            console.error('Erreur:', error);
            showNotification('Erreur lors du chargement de l\'arme', 'error');
            setTimeout(() => window.location.href = '/liste-armes.html', 2000);
        } finally {
            loader.style.display = 'none';
        }
    }

    function renderArme() {
        // Header
        const photoPreview = document.getElementById('photo_preview');
        if (photoPreview) {
            if (armeData.model_image_url) {
                photoPreview.src = armeData.model_image_url;
                photoPreview.style.display = 'block';
            } else {
                photoPreview.src = 'data/images/default-weapon.png';
                photoPreview.onerror = () => {
                    photoPreview.style.display = 'none';
                };
            }
        }
        document.getElementById('arme-name').textContent = armeData.model_name || '';
        document.getElementById('arme-serial').textContent = armeData.serial_number || '';
        document.getElementById('arme_id').textContent = `ID: #${armeData.id}`;
        // Formulaire
        document.getElementById('modele').value = armeData.model_name || '';
        document.getElementById('serial_number').value = armeData.serial_number || '';
        document.getElementById('calibre').value = armeData.calibre || '';
        document.getElementById('notes').value = armeData.notes || '';
        // Propriétaire
        if (armeData.owner_id) {
            selectedProprietaireId = armeData.owner_id;
            document.getElementById('proprietaire').value = armeData.owner_name || '';
            document.getElementById('proprietaire_id').value = armeData.owner_id;
        } else {
            selectedProprietaireId = null;
            document.getElementById('proprietaire').value = '';
            document.getElementById('proprietaire_id').value = '';
        }
        // Infos système
        document.getElementById('created_by').textContent = armeData.created_by || 'N/A';
        const updatedDate = armeData.updated_at
            ? new Date(armeData.updated_at).toLocaleDateString('fr-FR', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })
            : 'N/A';
        document.getElementById('date_modification').textContent = updatedDate;
    }

    function setViewMode() {
        isEditMode = false;
        document.body.classList.remove('edit-mode');
        const form = document.getElementById('profileForm');
        const inputs = form.querySelectorAll('input:not([type="hidden"]):not([readonly]), select, textarea');
        inputs.forEach(input => {
            input.setAttribute('disabled', 'disabled');
            input.classList.add('disabled-field');
        });
        const editBtn = document.getElementById('edit-mode-btn');
        const cancelBtn = document.getElementById('cancel-edit-btn');
        const saveBtn = document.getElementById('save-btn');
        const deleteBtn = document.getElementById('delete-btn');
        const selectBtn = document.getElementById('selectProprietaireBtn');
        const photoOverlay = document.getElementById('photo-overlay');
        if (editBtn) editBtn.style.display = 'inline-flex';
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'inline-flex';
        if (selectBtn) {
            selectBtn.style.display = 'none';
            selectBtn.disabled = true;
        }
        if (photoOverlay) photoOverlay.style.display = 'none';
    }

    function setEditMode() {
        isEditMode = true;
        document.body.classList.add('edit-mode');
        originalData = { ...armeData };
        const form = document.getElementById('profileForm');
        const inputs = form.querySelectorAll('input:not([type="hidden"]):not([readonly]), select, textarea');
        inputs.forEach(input => {
            input.removeAttribute('disabled');
            input.classList.remove('disabled-field');
            input.disabled = false;
        });
        const editBtn = document.getElementById('edit-mode-btn');
        const cancelBtn = document.getElementById('cancel-edit-btn');
        const saveBtn = document.getElementById('save-btn');
        const deleteBtn = document.getElementById('delete-btn');
        const selectBtn = document.getElementById('selectProprietaireBtn');
        const photoOverlay = document.getElementById('photo-overlay');
        if (editBtn) editBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'inline-flex';
        if (saveBtn) saveBtn.style.display = 'inline-flex';
        if (deleteBtn) deleteBtn.style.display = 'none';
        if (selectBtn) {
            selectBtn.style.display = 'inline-block';
            selectBtn.disabled = false;
            selectBtn.removeAttribute('disabled');
        }
            // Sélection du propriétaire
            document.getElementById('selectProprietaireBtn').addEventListener('click', async function () {
                if (!isEditMode) return;
                if (typeof CitoyenSelectorModal === 'function') {
                    const modal = new CitoyenSelectorModal();
                    modal.onSelectCallback = function (citoyen) {
                        if (citoyen) {
                            document.getElementById('proprietaire').value = (citoyen.nom || '') + ' ' + (citoyen.prenom || '');
                            document.getElementById('proprietaire_id').value = citoyen.id;
                        }
                    };
                    await modal.init();
                    modal.modal.style.display = 'block';
                }
            });
        if (photoOverlay) photoOverlay.style.display = 'flex';
        console.log('=== MODE EDITION TERMINÉ ===');
    }

    function cancelEdit() {
        armeData = { ...originalData };
        renderArme();
        setViewMode();
    }

    async function saveChanges(event) {
        event.preventDefault();
        const loader = document.getElementById('loaderOverlay');
        loader.style.display = 'flex';
        const payload = {
            model_id: armeData.model_id || null,
            serial_number: document.getElementById('serial_number')?.value || '',
            calibre: document.getElementById('calibre')?.value || '',
            notes: document.getElementById('notes')?.value || '',
            owner_id: document.getElementById('proprietaire_id')?.value || null,
            photo: document.getElementById('photo_preview')?.src || ''
        };
        try {
            const res = await fetch(`/api/weapons/${armeId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Erreur lors de la sauvegarde');
            armeData = await res.json();
            showNotification('Modifications enregistrées', 'success');
            renderArme();
            setViewMode();
        } catch (error) {
            showNotification('Erreur lors de la sauvegarde', 'error');
        } finally {
            loader.style.display = 'none';
        }
    }

    async function deleteArme() {
        showConfirm('Supprimer cette arme ?', (result) => {
            if (!result) return;

            deleteArmeConfirmed();
        }, { yesText: 'Supprimer', noText: 'Annuler' });
    }

    async function deleteArmeConfirmed() {
        const loader = document.getElementById('loaderOverlay');
        loader.style.display = 'flex';
        try {
            const res = await fetch(`/api/weapons/${armeId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Erreur suppression');
            showNotification('Arme supprimée', 'success');
            setTimeout(() => window.location.href = '/liste-armes.html', 1500);
        } catch (error) {
            showNotification('Erreur suppression', 'error');
        } finally {
            loader.style.display = 'none';
        }
    }

    document.getElementById('edit-mode-btn').addEventListener('click', setEditMode);
    document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
    document.getElementById('save-btn').addEventListener('click', saveChanges);
    document.getElementById('delete-btn').addEventListener('click', deleteArme);
    window.addEventListener('DOMContentLoaded', loadArme);
})();
