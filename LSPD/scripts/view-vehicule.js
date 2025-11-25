(function () {
    let vehicleId = null;
    let vehicleData = null;
    let selectedProprietaireId = null;
    let isEditMode = false;
    let originalData = {};

    function getVehicleIdFromURL() {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    }
    async function loadVehicle() {
        vehicleId = getVehicleIdFromURL();
        if (!vehicleId) {
            showNotification('ID du véhicule non trouvé', 'error');
            setTimeout(() => window.location.href = '/liste-vehicules.html', 2000);
            return;
        }

        const loader = document.getElementById('loaderOverlay');
        loader.style.display = 'flex';

        try {
            const res = await fetch(`/api/vehicules/${vehicleId}`);
            if (!res.ok) {
                throw new Error('Véhicule non trouvé');
            }
            vehicleData = await res.json();
            renderVehicle();
            setViewMode();
        } catch (error) {
            console.error('Erreur:', error);
            showNotification('Erreur lors du chargement du véhicule', 'error');
            setTimeout(() => window.location.href = '/liste-vehicules.html', 2000);
        } finally {
            loader.style.display = 'none';
        }
    }

    function renderVehicle() {
        const photoPreview = document.getElementById('photo_preview');
        if (vehicleData.photo) {
            photoPreview.src = vehicleData.photo;
            photoPreview.style.display = 'block';
        } else {
            photoPreview.src = 'data/images/default-vehicle.png';
            photoPreview.onerror = () => {
                photoPreview.style.display = 'none';
                photoPreview.parentElement.innerHTML = '<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 64px; color: #bdc3c7;">🚗</div>';
            };
        }

        document.getElementById('vehicule-name').textContent = vehicleData.modele;
        document.getElementById('vehicule-plaque').textContent = vehicleData.plaque;
        document.getElementById('vehicule_id').textContent = `ID: #${vehicleData.id}`;

        const mandatBadge = document.getElementById('vehicule-mandat');
        if (vehicleData.mandat_actif) {
            mandatBadge.textContent = '⚠️ MANDAT ACTIF';
            mandatBadge.className = 'badge mandat-actif';
        } else {
            mandatBadge.textContent = '✓ Pas de mandat';
            mandatBadge.className = 'badge no-mandat';
        }

        document.getElementById('modele').value = vehicleData.modele || '';
        document.getElementById('plaque').value = vehicleData.plaque || '';
        document.getElementById('couleur').value = vehicleData.couleur || '';
        document.getElementById('mandat_actif').value = vehicleData.mandat_actif ? 'true' : 'false';
        document.getElementById('notes').value = vehicleData.notes || '';

        if (vehicleData.proprietaire_id) {
            selectedProprietaireId = vehicleData.proprietaire_id;
            document.getElementById('proprietaire').value = `${vehicleData.proprietaire_nom} ${vehicleData.proprietaire_prenom}`;
            document.getElementById('proprietaire_id').value = vehicleData.proprietaire_id;
        } else {
            selectedProprietaireId = null;
            document.getElementById('proprietaire').value = '';
            document.getElementById('proprietaire_id').value = '';
        }

        document.getElementById('created_by').textContent = vehicleData.created_by || 'N/A';

        const updatedDate = vehicleData.updated_at
            ? new Date(vehicleData.updated_at).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
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
            if (input.id === 'proprietaire') {
                input.setAttribute('readonly', 'readonly');
                input.removeAttribute('disabled');
                input.classList.add('disabled-field');
                if (selectedProprietaireId) {
                    input.style.cursor = 'pointer';
                }
            } else {
                input.setAttribute('disabled', 'disabled');
                input.classList.add('disabled-field');
            }
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
            selectBtn.disabled = true;
            selectBtn.style.display = 'none';
        }
        if (photoOverlay) photoOverlay.style.display = 'none';

        const proprietaireContainer = document.querySelector('.proprietaire-selector');
        if (proprietaireContainer && selectedProprietaireId) {
            proprietaireContainer.style.cursor = 'pointer';
        }
    }

    function setEditMode() {
        isEditMode = true;
        document.body.classList.add('edit-mode');

        originalData = { ...vehicleData };

        const form = document.getElementById('profileForm');
        const inputs = form.querySelectorAll('input:not([type="hidden"]):not([readonly]), select, textarea');

        inputs.forEach(input => {
            if (input.id === 'proprietaire') {
                input.setAttribute('disabled', 'disabled');
                input.removeAttribute('readonly');
                input.classList.add('disabled-field');
                input.style.cursor = '';
            } else {
                input.removeAttribute('disabled');
                input.classList.remove('disabled-field');
                input.disabled = false;
            }
        });

        const proprietaireContainer = document.querySelector('.proprietaire-selector');
        if (proprietaireContainer) {
            proprietaireContainer.style.cursor = 'default';
        }

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
            selectBtn.disabled = false;
            selectBtn.removeAttribute('disabled');
            selectBtn.style.display = 'block';
        }
        if (photoOverlay) photoOverlay.style.display = 'flex';

        console.log('=== MODE EDITION TERMINÉ ===');
    }

    function cancelEdit() {
        vehicleData = { ...originalData };
        renderVehicle();
        setViewMode();
    }

    async function saveChanges(event) {
        event.preventDefault();

        const loader = document.getElementById('loaderOverlay');
        loader.style.display = 'flex';

        try {
            const formData = {
                modele: document.getElementById('modele').value.trim(),
                plaque: document.getElementById('plaque').value.trim().toUpperCase(),
                couleur: document.getElementById('couleur').value.trim() || null,
                proprietaire_id: selectedProprietaireId,
                mandat_actif: document.getElementById('mandat_actif').value === 'true',
                photo: vehicleData.photo || null
            };

            const res = await fetch(`/api/vehicules/${vehicleId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await res.json();

            if (res.ok) {
                vehicleData = result;

                await saveNotes();

                renderVehicle();
                setViewMode();
                showNotification('✓ Véhicule modifié avec succès', 'success');
            } else {
                showNotification(result.error || 'Erreur lors de la modification', 'error');
            }
        } catch (error) {
            console.error('Erreur:', error);
            showNotification('Erreur de connexion au serveur', 'error');
        } finally {
            loader.style.display = 'none';
        }
    }

    async function saveNotes() {
        try {
            const res = await fetch(`/api/vehicules/${vehicleId}/notes`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    notes: document.getElementById('notes').value
                })
            });

            if (res.ok) {
                const updated = await res.json();
                vehicleData.notes = updated.notes;
            }
        } catch (error) {
            console.error('Erreur lors de la sauvegarde des notes:', error);
        }
    }

    async function deleteVehicle() {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer ce véhicule (${vehicleData.modele} - ${vehicleData.plaque}) ?\n\nCette action est irréversible.`)) {
            return;
        }

        const loader = document.getElementById('loaderOverlay');
        loader.style.display = 'flex';

        try {
            const res = await fetch(`/api/vehicules/${vehicleId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                showNotification('✓ Véhicule supprimé avec succès', 'success');
                setTimeout(() => {
                    window.location.href = '/liste-vehicules.html';
                }, 1500);
            } else {
                const result = await res.json();
                showNotification(result.error || 'Erreur lors de la suppression', 'error');
                loader.style.display = 'none';
            }
        } catch (error) {
            console.error('Erreur:', error);
            showNotification('Erreur de connexion au serveur', 'error');
            loader.style.display = 'none';
        }
    }

    function setupPhotoModal() {
        const photoContainer = document.getElementById('photo-container');
        const photoModal = document.getElementById('photoModal');
        const photoUrlInput = document.getElementById('photoUrlInput');
        const photoPreviewModal = document.getElementById('photoPreviewModal');
        const savePhotoBtn = document.getElementById('savePhotoBtn');
        const cancelPhotoBtn = document.getElementById('cancelPhotoBtn');

        photoContainer.addEventListener('click', () => {
            if (!isEditMode) return;
            photoUrlInput.value = vehicleData.photo || '';
            photoPreviewModal.style.display = 'none';
            photoModal.style.display = 'flex';
        });

        photoUrlInput.addEventListener('input', (e) => {
            const url = e.target.value;
            if (url) {
                photoPreviewModal.src = url;
                photoPreviewModal.style.display = 'block';
                photoPreviewModal.onerror = () => {
                    photoPreviewModal.style.display = 'none';
                };
            } else {
                photoPreviewModal.style.display = 'none';
            }
        });

        savePhotoBtn.addEventListener('click', () => {
            vehicleData.photo = photoUrlInput.value.trim() || null;
            document.getElementById('photo_preview').src = vehicleData.photo || 'data/images/default-vehicle.png';
            photoModal.style.display = 'none';
        });

        cancelPhotoBtn.addEventListener('click', () => {
            photoModal.style.display = 'none';
        });

        photoModal.addEventListener('click', (e) => {
            if (e.target === photoModal) {
                photoModal.style.display = 'none';
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        loadVehicle();
        setupPhotoModal();

        document.getElementById('edit-mode-btn').addEventListener('click', setEditMode);
        document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
        document.getElementById('delete-btn').addEventListener('click', deleteVehicle);
        document.getElementById('profileForm').addEventListener('submit', saveChanges);

        const proprietaireContainer = document.querySelector('.proprietaire-selector');
        if (proprietaireContainer) {
            proprietaireContainer.addEventListener('click', (e) => {
                if (selectedProprietaireId && !isEditMode && e.target.id !== 'selectProprietaireBtn') {
                    window.location.href = `/view-citoyen.html?id=${selectedProprietaireId}`;
                }
            });

            proprietaireContainer.style.cursor = 'default';
        }

        document.getElementById('selectProprietaireBtn').addEventListener('click', () => {
            if (citoyenSelector) {
                citoyenSelector.open((citoyenId, citoyenName) => {
                    if (citoyenId && citoyenName) {
                        selectedProprietaireId = citoyenId;
                        document.getElementById('proprietaire').value = citoyenName;
                        document.getElementById('proprietaire_id').value = citoyenId;
                    } else {
                        selectedProprietaireId = null;
                        document.getElementById('proprietaire').value = '';
                        document.getElementById('proprietaire_id').value = '';
                    }
                }, selectedProprietaireId);
            }
        });

        document.getElementById('plaque').addEventListener('input', function (e) {
            e.target.value = e.target.value.toUpperCase();
        });

        setupPhotoZoom();
    });

    function setupPhotoZoom() {
        const photoPreview = document.getElementById('photo_preview');

        const zoomModal = document.createElement('div');
        zoomModal.className = 'photo-zoom-modal';
        zoomModal.innerHTML = `
      <span class="close-zoom">&times;</span>
      <img id="zoomed-photo" src="" alt="Photo agrandie">
    `;
        document.body.appendChild(zoomModal);

        const zoomedPhoto = document.getElementById('zoomed-photo');
        const closeZoom = zoomModal.querySelector('.close-zoom');

        photoPreview.addEventListener('click', () => {
            if (vehicleData && vehicleData.photo) {
                zoomedPhoto.src = vehicleData.photo;
                zoomModal.style.display = 'flex';
            }
        });

        closeZoom.addEventListener('click', () => {
            zoomModal.style.display = 'none';
        });

        zoomModal.addEventListener('click', (e) => {
            if (e.target === zoomModal) {
                zoomModal.style.display = 'none';
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && zoomModal.style.display === 'flex') {
                zoomModal.style.display = 'none';
            }
        });
    }
})();
