let currentUserId = null;
let currentUserInfo = null;
let agentProfile = null;
let isEditMode = false;
let originalData = {};

// Fonction pour afficher les animations de feedback
function showAnimation(type = 'success', message = '') {
    const container = document.getElementById('feedbackAnimation');
    if (!container) {
        // Créer le container s'il n'existe pas
        const feedbackDiv = document.createElement('div');
        feedbackDiv.id = 'feedbackAnimation';
        feedbackDiv.className = 'feedback-animation';
        document.body.appendChild(feedbackDiv);
    }
    
    const animationContainer = document.getElementById('feedbackAnimation');
    animationContainer.className = `feedback-animation ${type}`;
    animationContainer.textContent = message || (type === 'success' ? 'Succès !' : 'Erreur !');
    animationContainer.style.display = 'block';

    setTimeout(() => {
        animationContainer.style.display = 'none';
    }, 3000);
}

// Fonction pour formater les dates
function formatDate(dateStr) {
    if (!dateStr) return 'Non défini';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Fonction pour ajouter une ligne d'équipement (arme ou véhicule) 
function addEquipmentRow(container, data = {}, type) {
    const div = document.createElement('div');
    div.className = 'equipment-item';
    const name = data.nom || '';
    const detail = type === 'arme' ? (data.numero_serie || 'N/A') : (data.immatriculation || 'N/A');

    div.innerHTML = `
        <div class="equipment-display">
            <span class="equipment-name" data-field="nom">${name}</span>
            <span class="equipment-detail" data-field="detail">${detail}</span>
            <div class="equipment-actions">
                <button type="button" class="edit-equipment-btn" onclick="editEquipmentRow(this, '${type}')" title="Modifier">
                    <span class="material-symbols-rounded">edit</span>
                </button>
                <button type="button" class="remove-equipment-btn" onclick="removeEquipmentRow(this)" title="Supprimer">
                    <span class="material-symbols-rounded">close</span>
                </button>
            </div>
        </div>`;

    // Stocker les données dans l'élément pour la récupération
    div.dataset.equipmentData = JSON.stringify(data);
    container.appendChild(div);
    updateEquipmentVisibility();
}

// Fonction pour supprimer une ligne d'équipement
function removeEquipmentRow(button) {
    const wrapper = button.closest('.equipment-item');
    if (wrapper) wrapper.remove();
    updateEquipmentVisibility();
}

// Fonction pour éditer une ligne d'équipement
function editEquipmentRow(button, type) {
    if (!document.body.classList.contains('edit-mode')) return;
    const item = button.closest('.equipment-item');
    if (!item) return;

    // Déjà en mode édition ? alors on sauvegarde
    if (item.classList.contains('editing')) {
        const nameInput = item.querySelector('input.equipment-edit-name');
        const detailInput = item.querySelector('input.equipment-edit-detail');
        if (!nameInput) return;
        const newName = nameInput.value.trim();
        const newDetail = detailInput ? detailInput.value.trim() : '';
        let data;
        try { data = JSON.parse(item.dataset.equipmentData || '{}'); } catch { data = {}; }
        data.nom = newName;
        if (type === 'arme') {
            data.numero_serie = newDetail;
        } else {
            data.immatriculation = newDetail;
        }
        item.dataset.equipmentData = JSON.stringify(data);
        // Remplacer par spans
        const nameSpan = document.createElement('span');
        nameSpan.className = 'equipment-name';
        nameSpan.dataset.field = 'nom';
        nameSpan.textContent = newName;
        const detailSpan = document.createElement('span');
        detailSpan.className = 'equipment-detail';
        detailSpan.dataset.field = 'detail';
        detailSpan.textContent = newDetail || 'N/A';
        nameInput.replaceWith(nameSpan);
        if (detailInput) detailInput.replaceWith(detailSpan);
        item.classList.remove('editing');
        button.querySelector('.material-symbols-rounded').textContent = 'edit';
        return;
    }

    // Passer en mode édition inline
    let data = {};
    try { data = JSON.parse(item.dataset.equipmentData || '{}'); } catch { data = {}; }
    const currentName = data.nom || '';
    const currentDetail = type === 'arme' ? (data.numero_serie || '') : (data.immatriculation || '');
    const nameSpan = item.querySelector('.equipment-name');
    const detailSpan = item.querySelector('.equipment-detail');
    if (!nameSpan) return;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'equipment-edit-name';
    nameInput.value = currentName;
    nameInput.placeholder = 'Nom';
    nameSpan.replaceWith(nameInput);
    if (detailSpan) {
        const detailInput = document.createElement('input');
        detailInput.type = 'text';
        detailInput.className = 'equipment-edit-detail';
        detailInput.value = currentDetail;
        detailInput.placeholder = type === 'arme' ? 'Numéro de série' : 'Immatriculation';
        detailSpan.replaceWith(detailInput);
    }
    item.classList.add('editing');
    button.querySelector('.material-symbols-rounded').textContent = 'save';
}



// Fonction pour récupérer les équipements depuis le DOM
function getEquipmentFromDOM(type) {
    const container = document.getElementById(`${type}s-container`);
    const items = container.querySelectorAll('.equipment-item');
    const equipment = [];

    items.forEach(item => {
        const dataStr = item.dataset.equipmentData;
        if (dataStr) {
            try {
                const data = JSON.parse(dataStr);
                if (data.nom && data.nom.trim()) {
                    equipment.push(data);
                }
            } catch (e) {
                console.warn('Erreur parsing equipment data:', e);
            }
        }
    });

    return equipment;
}

// Fonction pour remplir les équipements dans le DOM
function fillEquipmentInDOM(container, equipments, type) {
    container.innerHTML = '';
    
    if (!equipments || equipments.length === 0) {
        addEquipmentRow(container, {}, type);
        return;
    }

    equipments.forEach(equipment => {
        addEquipmentRow(container, equipment, type);
    });
}

// Fonction pour mettre à jour la visibilité des équipements selon le mode
function updateEquipmentVisibility() {
    const isEditModeActive = document.body.classList.contains('edit-mode');
    console.log('Mise à jour visibilité équipements, mode édition:', isEditModeActive);
    
    document.querySelectorAll('.equipment-item').forEach(item => {
        const removeBtn = item.querySelector('.remove-equipment-btn');
        const editBtn = item.querySelector('.edit-equipment-btn');
        const inputs = item.querySelectorAll('input');
        
        if (removeBtn) removeBtn.style.display = isEditModeActive ? 'block' : 'none';
        if (editBtn) editBtn.style.display = isEditModeActive ? 'block' : 'none';
        inputs.forEach(input => input.disabled = !isEditModeActive);
    });
    
    document.querySelectorAll('.add-equipment-btn').forEach(btn => {
        btn.style.display = isEditModeActive ? 'block' : 'none';
    });
    
    // Gérer les en-têtes des équipements
    const armesContainer = document.getElementById('armes-container');
    const vehiculesContainer = document.getElementById('vehicules-container');
    
    // Gérer les en-têtes des armes
    const armesHeaders = document.querySelector('.equipment-headers.armes');
    if (armesContainer && armesHeaders) {
        const hasArmes = armesContainer.children.length > 0;
        armesHeaders.style.display = hasArmes ? 'grid' : 'none';
    }
    
    // Gérer les en-têtes des véhicules
    const vehiculesHeaders = document.querySelector('.equipment-headers.vehicules');
    if (vehiculesContainer && vehiculesHeaders) {
        const hasVehicules = vehiculesContainer.children.length > 0;
        vehiculesHeaders.style.display = hasVehicules ? 'grid' : 'none';
    }
}

// Fonction pour charger les informations utilisateur
async function loadUserInfo() {
    try {
        const res = await fetch('/api/user');
        if (!res.ok) throw new Error('Erreur récupération utilisateur');
        
        currentUserInfo = await res.json();
        
        // Déterminer l'userId à partir de l'URL ou utiliser l'utilisateur actuel
        const urlParams = new URLSearchParams(window.location.search);
        currentUserId = urlParams.get('userId') || currentUserInfo.id;
        
        return currentUserInfo;
    } catch (err) {
        console.error('Erreur chargement utilisateur:', err);
        showAnimation('error', 'Erreur de chargement des informations utilisateur');
        throw err;
    }
}

// Fonction pour charger le profil de l'agent
async function loadAgentProfile() {
    if (!currentUserId) return;
    
    try {
        console.log('Chargement profil pour userId:', currentUserId);
        const res = await fetch(`/api/agent-profile/${currentUserId}`);
        
        if (!res.ok) {
            const errorData = await res.json();
            console.error('Erreur API:', res.status, errorData);
            throw new Error(`Erreur ${res.status}: ${errorData.error || 'Erreur récupération profil'}`);
        }
        
        agentProfile = await res.json();
        console.log('Profil chargé:', agentProfile);
        await displayProfile(agentProfile);
        
    } catch (err) {
        console.error('Erreur chargement profil:', err);
        showAnimation('error', `Erreur de chargement du profil: ${err.message}`);
    }
}

// Fonction pour afficher le profil dans le formulaire
async function displayProfile(profile) {
    // Remplir les champs personnels
    document.getElementById('matricule').value = profile.matricule || '';
    document.getElementById('nom').value = profile.nom || '';
    document.getElementById('prenom').value = profile.prenom || '';
    document.getElementById('agent_id').textContent = `ID: ${profile.discord_id || currentUserId}`;
    document.getElementById('date_creation').textContent = formatDate(profile.date_creation);
    document.getElementById('date_modification').textContent = formatDate(profile.date_modification);

    // Charger photo / équipements
    const armes = Array.isArray(profile.armes) ? profile.armes : []; 
    const vehicules = Array.isArray(profile.vehicules) ? profile.vehicules : [];
    const armesContainer = document.getElementById('armes-container');
    const vehiculesContainer = document.getElementById('vehicules-container');
    armesContainer.innerHTML = '';
    vehiculesContainer.innerHTML = '';
    fillEquipmentInDOM(armesContainer, armes, 'arme');
    fillEquipmentInDOM(vehiculesContainer, vehicules, 'vehicule');
    updatePhotoPreview(profile.photo_url);

    originalData = { matricule: profile.matricule||'', nom: profile.nom||'', prenom: profile.prenom||'', photo_url: profile.photo_url||'', armes, vehicules };
    updateEquipmentVisibility();

    // Ensuite seulement récupérer et afficher grade + titre
    await fetchAgentDisplayName();

    // Vérifier les permissions d'édition
    const canEdit = currentUserInfo.id === profile.discord_id || 
                   currentUserInfo.id === currentUserId ||
                   currentUserInfo.isSupervisor || 
                   currentUserInfo.isCommandStaff;

    console.log('Permissions édition:', {
        currentUserInfoId: currentUserInfo.id,
        profileDiscordId: profile.discord_id,
        currentUserId: currentUserId,
        canEdit: canEdit
    });

    // Afficher le bouton d'édition si autorisé
    if (canEdit) {
        document.getElementById('edit-mode-btn').style.display = 'block';
    }
}

// Fonction pour récupérer le nom d'affichage et le grade de l'agent
async function fetchAgentDisplayName() {
    if (!currentUserId) return;

    try {
        let displayName = '';
        try {
            const res = await fetch(`/api/discord/member/${currentUserId}`);
            if (res.ok) {
                const data = await res.json();
                displayName = data.displayName || '';
            }
        } catch (e) {
            console.warn('Nom affichage indisponible:', e);
        }

        // Récupérer le grade uniquement pour le badge (ne plus le préfixer dans le H1)
        try {
            const gradeRes = await fetch(`/api/agent-grade/${currentUserId}`);
            if (gradeRes.ok) {
                const gradeData = await gradeRes.json();
                if (gradeData.grade) {
                    const badgeEl = document.getElementById('agent-badge');
                    if (badgeEl) badgeEl.textContent = gradeData.grade;
                }
            }
        } catch (e) {
            console.warn('Grade indisponible:', e);
        }

        // H1 = displayName Discord si dispo, sinon fallback sur Nom Prénom, sinon ID
        const nom = document.getElementById('nom')?.value?.trim() || '';
        const prenom = document.getElementById('prenom')?.value?.trim() || '';
        const agentNameEl = document.getElementById('agent-name');
        if (agentNameEl) {
            if (displayName) {
                agentNameEl.textContent = displayName;
            } else if (nom || prenom) {
                agentNameEl.textContent = `${prenom} ${nom}`.trim();
            } else {
                agentNameEl.textContent = 'Agent';
            }
        }
    } catch (err) {
        console.warn('Impossible de récupérer les infos de l\'agent:', err);
    }
}// Fonction pour mettre à jour l'aperçu de la photo
function updatePhotoPreview(url) {
    const preview = document.getElementById('photo_preview');
    const uploadBtn = document.querySelector('.photo-upload-btn');
    
    if (!preview) {
        console.warn('Élément photo_preview non trouvé');
        return;
    }
    
    if (url && url.trim()) {
        preview.src = url;
        preview.style.display = 'block';
        if (uploadBtn) uploadBtn.style.display = 'none';
        
        preview.onerror = () => {
            preview.style.display = 'none';
            if (uploadBtn) uploadBtn.style.display = 'flex';
        };
    } else {
        preview.style.display = 'none';
        if (uploadBtn) uploadBtn.style.display = 'flex';
    }
}

// Fonction pour sauvegarder le profil
async function saveProfile(event) {
    event.preventDefault();

    try {
        const formData = {
            matricule: document.getElementById('matricule').value.trim(),
            nom: document.getElementById('nom').value.trim(),
            prenom: document.getElementById('prenom').value.trim(),
            photo_url: document.getElementById('photo_preview').src || '',
            armes: getEquipmentFromDOM('arme'),
            vehicules: getEquipmentFromDOM('vehicule')
        };

        const res = await fetch(`/api/agent-profile/${currentUserId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error);
        }

        const updatedProfile = await res.json();
        agentProfile = updatedProfile;
        
        // Mettre à jour les données originales
        originalData = { ...formData };
        
        await deactivateEditMode();
        showAnimation('success', 'Profil sauvegardé avec succès !');

        // Recharger pour afficher les changements
        setTimeout(() => {
            window.location.reload();
        }, 1500);

    } catch (err) {
        console.error('Erreur sauvegarde:', err);
        showAnimation('error', err.message);
    }
}

// Initialisation de la page
document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('loaderOverlay');
    loader.style.display = 'flex';
    
    try {
        await loadUserInfo();
        await loadAgentProfile();
        
        setupPhotoPopup();

        // Boutons d'action
        document.getElementById('edit-mode-btn').addEventListener('click', activateEditModeLocal);
        document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
        document.getElementById('profileForm').addEventListener('submit', saveProfile);
        document.getElementById('back-btn').addEventListener('click', () => history.back());

        // Boutons d'ajout d'équipement
        document.getElementById('add-arme-btn').addEventListener('click', () => {
            const nom = document.getElementById('new-arme-nom').value.trim();
            const serie = document.getElementById('new-arme-serie').value.trim();
            
            if (nom) {
                const container = document.getElementById('armes-container');
                addEquipmentRow(container, { nom, numero_serie: serie }, 'arme');
                
                // Vider les champs
                document.getElementById('new-arme-nom').value = '';
                document.getElementById('new-arme-serie').value = '';
            }
        });

        document.getElementById('add-vehicule-btn').addEventListener('click', () => {
            const nom = document.getElementById('new-vehicule-nom').value.trim();
            const immat = document.getElementById('new-vehicule-immat').value.trim();
            
            if (nom) {
                const container = document.getElementById('vehicules-container');
                addEquipmentRow(container, { nom, immatriculation: immat }, 'vehicule');
                
                // Vider les champs
                document.getElementById('new-vehicule-nom').value = '';
                document.getElementById('new-vehicule-immat').value = '';
            }
        });

        // Désactiver le mode édition quand on quitte la page
        window.addEventListener('beforeunload', () => {
            if (isEditMode) {
                deactivateEditMode();
            }
        });

        // Click-to-copy ID (restauré)
        const idEl = document.getElementById('agent_id');
        if (idEl) {
            idEl.addEventListener('click', async () => {
                const raw = idEl.textContent || '';
                const match = raw.match(/ID:\s*(.+)$/i);
                const value = match ? match[1].trim() : raw.trim();
                try {
                    await navigator.clipboard.writeText(value);
                    idEl.classList.add('copied');
                    setTimeout(() => idEl.classList.remove('copied'), 2000);
                } catch(e) {
                    console.warn('Clipboard échoué', e);
                }
            });
        }
        
    } catch (err) {
        console.error('Erreur initialisation page:', err);
    } finally {
        loader.style.display = 'none';
    }
});

// Nouvelles fonctions pour le système modifié

// Formations supprimées comme demandé

// Fonction pour activer le mode édition
async function activateEditMode() {
    try {
        const res = await fetch(`/api/agent-profile/${currentUserId}/edit-mode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error);
        }

        isEditMode = true;
        document.body.classList.add('edit-mode');
        
        // Masquer le bouton édition, afficher sauvegarde et annulation
        document.getElementById('edit-mode-btn').style.display = 'none';
        document.getElementById('save-btn').style.display = 'block';
        document.getElementById('cancel-edit-btn').style.display = 'block';

        // Activer les champs
        const inputs = document.querySelectorAll('input, textarea');
        inputs.forEach(input => input.disabled = false);

        updateEquipmentVisibility();
        showAnimation('success', 'Mode édition activé');

    } catch (err) {
        console.error('Erreur activation mode édition:', err);
        showAnimation('error', err.message);
    }
}

// Fonction pour désactiver le mode édition
async function deactivateEditMode() {
    try {
        await fetch(`/api/agent-profile/${currentUserId}/edit-mode`, {
            method: 'DELETE'
        });

        isEditMode = false;
        document.body.classList.remove('edit-mode');
        
        // Restaurer l'affichage des boutons
        document.getElementById('edit-mode-btn').style.display = 'block';
        document.getElementById('save-btn').style.display = 'none';
        document.getElementById('cancel-edit-btn').style.display = 'none';

        // Désactiver les champs
        const inputs = document.querySelectorAll('input, textarea');
        inputs.forEach(input => input.disabled = true);

        updateEquipmentVisibility();

    } catch (err) {
        console.error('Erreur désactivation mode édition:', err);
    }
}

// Fonction pour annuler les modifications
function cancelEdit() {
    // Restaurer les données originales
    document.getElementById('matricule').value = originalData.matricule;
    document.getElementById('nom').value = originalData.nom;
    document.getElementById('prenom').value = originalData.prenom;
    
    // Restaurer les équipements
    const armesContainer = document.getElementById('armes-container');
    fillEquipmentInDOM(armesContainer, originalData.armes, 'arme');
    
    const vehiculesContainer = document.getElementById('vehicules-container');
    fillEquipmentInDOM(vehiculesContainer, originalData.vehicules, 'vehicule');
    
    updatePhotoPreview(originalData.photo_url);
    
    deactivateEditMode();
    showAnimation('success', 'Modifications annulées');
}

// Gestion du popup photo
function setupPhotoPopup() {
    const photoContainer = document.getElementById('photo-container');
    const popup = document.getElementById('photoPopup');
    const photoUrlInput = document.getElementById('photoUrlInput');
    const photoPreviewPopup = document.getElementById('photoPreviewPopup');
    const savePhotoBtn = document.getElementById('savePhotoBtn');
    const cancelPhotoBtn = document.getElementById('cancelPhotoBtn');
    const closePopupBtn = document.getElementById('closePhotoPopup');
    // Lightbox consultation
    const lightbox = document.getElementById('photoLightbox');
    const lightboxImg = document.getElementById('photoLightboxImage');
    const closeLightboxBtn = document.getElementById('closePhotoLightbox');

    // Clic photo: édition => popup modif ; consultation => lightbox avec anim
    photoContainer.addEventListener('click', () => {
        const previewEl = document.getElementById('photo_preview');
        const currentSrc = previewEl ? (previewEl.getAttribute('src') || '').trim() : '';
        const hasVisiblePhoto = previewEl && previewEl.style.display !== 'none' && currentSrc.length > 0;
        const editing = isEditMode || document.body.classList.contains('edit-mode');

        if (editing) {
            // En mode édition on ouvre le popup même si pas encore de photo pour permettre d'en ajouter une
            photoUrlInput.value = currentSrc || '';
            updatePhotoPreviewPopup();
            popup.style.display = 'flex';
            return;
        }

        if (!hasVisiblePhoto) return; // Pas de photo affichée -> ne rien faire en consultation

        lightboxImg.src = currentSrc;
        lightbox.style.display = 'flex';
        void lightboxImg.offsetWidth; // reflow pour animation
        lightboxImg.classList.remove('closing');
    });

    function closeLightbox() {
        if (!lightbox) return;
        lightbox.style.display = 'none';
    }
    if (closeLightboxBtn) closeLightboxBtn.addEventListener('click', closeLightbox);
    if (lightbox) {
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) closeLightbox();
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox && lightbox.style.display === 'flex') {
            closeLightbox();
        }
    });

    // Aperçu en temps réel dans le popup
    photoUrlInput.addEventListener('input', updatePhotoPreviewPopup);
    
    function updatePhotoPreviewPopup() {
        const url = photoUrlInput.value.trim();
        if (url) {
            photoPreviewPopup.src = url;
            photoPreviewPopup.style.display = 'block';
        } else {
            photoPreviewPopup.style.display = 'none';
        }
    }

    // Sauvegarder la photo
    savePhotoBtn.addEventListener('click', () => {
        const url = photoUrlInput.value.trim();
        updatePhotoPreview(url);
        popup.style.display = 'none';
    });

    // Fermer le popup
    [cancelPhotoBtn, closePopupBtn].forEach(btn => {
        btn.addEventListener('click', () => {
            popup.style.display = 'none';
        });
    });

    // Fermer le popup en cliquant sur l'overlay
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            popup.style.display = 'none';
        }
    });
}

// Fonction pour activer le mode édition localement (sans API)
function activateEditModeLocal() {
    console.log('Activation mode édition local');
    
    isEditMode = true;
    document.body.classList.add('edit-mode');
    
    // Masquer le bouton édition, afficher sauvegarde et annulation
    document.getElementById('edit-mode-btn').style.display = 'none';
    document.getElementById('save-btn').style.display = 'block';
    document.getElementById('cancel-edit-btn').style.display = 'block';

    // Activer les champs
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => input.disabled = false);

    updateEquipmentVisibility();
    showAnimation('success', 'Mode édition activé');
}

// Rendre les fonctions globalement accessibles
window.removeEquipmentRow = removeEquipmentRow;
window.editEquipmentRow = editEquipmentRow;