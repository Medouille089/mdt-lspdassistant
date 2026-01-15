let citoyenId = null;
let citoyenProfile = null;
let currentUserInfo = null;
let isEditMode = false;
let originalData = {};
// Weapons marked for deletion during edit session (actual DELETE occurs on Save)
let pendingWeaponDeletions = new Set();
// Store criminal records for export
let criminalRecords = [];

// Fonction pour afficher les animations de feedback
function showAnimation(type = 'success', message = '') {
    let container = document.getElementById('feedbackAnimation');
    if (!container) {
        const feedbackDiv = document.createElement('div');
        feedbackDiv.id = 'feedbackAnimation';
        feedbackDiv.className = 'feedback-animation';
        feedbackDiv.style.background = '#fff';
        feedbackDiv.style.border = '1px solid #bbb';
        feedbackDiv.style.color = '#222';
        feedbackDiv.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
        document.body.appendChild(feedbackDiv);
    }

    container = document.getElementById('feedbackAnimation');
    container.className = `feedback-animation ${type}`;
    container.textContent = message || (type === 'success' ? 'Succès !' : 'Erreur !');
    container.style.display = 'block';
    container.style.background = '#fff';
    container.style.border = '1px solid #bbb';
    container.style.color = '#222';
    container.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';

    setTimeout(() => {
        container.style.display = 'none';
    }, 3000);
}

// Fonction pour formater les dates au format français
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

// Fonction pour formater une date au format YYYY-MM-DD pour input date
function formatDateForInput(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Fonction pour calculer l'âge
function calculateAge(dateStr) {
    if (!dateStr) return '';
    const birthDate = new Date(dateStr);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

// Affiche une confirmation non-bloquante en overlay et retourne une Promise<boolean>
function showConfirmModal(message, confirmText = 'Confirmer', cancelText = 'Annuler') {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(0,0,0,0.35)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '4000';

        const box = document.createElement('div');
        box.style.background = 'var(--white, #fff)';
        box.style.padding = '18px';
        box.style.borderRadius = '10px';
        box.style.maxWidth = '420px';
        box.style.width = '90%';
        box.style.boxShadow = '0 8px 30px rgba(0,0,0,0.18)';

        const p = document.createElement('div');
        p.style.marginBottom = '12px';
        p.style.color = 'var(--text-color, #222)';
        p.textContent = message;

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.justifyContent = 'flex-end';
        actions.style.gap = '8px';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = cancelText;
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(false);
        });

        const okBtn = document.createElement('button');
        okBtn.className = 'btn btn-danger';
        okBtn.textContent = confirmText;
        okBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(true);
        });

        actions.appendChild(cancelBtn);
        actions.appendChild(okBtn);
        box.appendChild(p);
        box.appendChild(actions);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // allow ESC to cancel
        function onKey(e) {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                window.removeEventListener('keydown', onKey);
                resolve(false);
            }
        }
        window.addEventListener('keydown', onKey);
    });
}
// Fonction pour charger les informations utilisateur (avec cache)
async function loadUserInfo() {
    try {
        // Vérifier si on a déjà les infos en cache (session storage)
        const cachedUser = sessionStorage.getItem('currentUser');
        const cacheTime = sessionStorage.getItem('currentUserTime');

        // Cache valide pendant 5 minutes
        if (cachedUser && cacheTime && (Date.now() - parseInt(cacheTime)) < 300000) {
            currentUserInfo = JSON.parse(cachedUser);
            return currentUserInfo;
        }

        const res = await fetch('/api/user');
        if (!res.ok) throw new Error('Erreur récupération utilisateur');

        currentUserInfo = await res.json();

        // Mettre en cache
        sessionStorage.setItem('currentUser', JSON.stringify(currentUserInfo));
        sessionStorage.setItem('currentUserTime', Date.now().toString());

        return currentUserInfo;
    } catch (err) {
        console.error('Erreur chargement utilisateur:', err);
        showAnimation('error', 'Erreur de chargement des informations utilisateur');
        throw err;
    }
}

// Fonction pour charger le profil du citoyen
async function loadCitoyenProfile() {
    const urlParams = new URLSearchParams(window.location.search);
    citoyenId = urlParams.get('id');

    if (!citoyenId) {
        showAnimation('error', 'ID citoyen manquant');
        setTimeout(() => window.location.href = '/liste-citoyens.html', 1500);
        return;
    }

    try {
        const res = await fetch(`/api/citoyens/${citoyenId}`);

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(`Erreur ${res.status}: ${errorData.error || 'Erreur récupération profil'}`);
        }

        citoyenProfile = await res.json();
        await displayProfile(citoyenProfile);

        // Charger les véhicules en parallèle (ne pas attendre)
        loadVehicules().catch(err => console.error('Erreur chargement véhicules:', err));

        // Charger les rapports d'arrestation
        loadCitizenReports(citoyenId).catch(err => console.error('Erreur chargement rapports:', err));

        // Charger le casier judiciaire
        loadCriminalRecord(citoyenId).catch(err => console.error('Erreur chargement casier:', err));

        // Charger les tags
        loadCitizenTags().catch(err => console.error('Erreur chargement tags:', err));

    } catch (err) {
        console.error('Erreur chargement profil:', err);
        showAnimation('error', `Erreur de chargement du profil: ${err.message}`);
        setTimeout(() => window.location.href = '/liste-citoyens.html', 2000);
    }
}

// Fonction pour afficher le profil dans le formulaire
async function displayProfile(profile) {
    // Affichage des permis actifs dans Liens associés
    const permisList = document.getElementById('permis-list');
    if (permisList) {
        permisList.innerHTML = '';

        const permisLabels = [
            { key: 'permis_a', label: 'Permis A', icon: 'two_wheeler' },
            { key: 'permis_b', label: 'Permis B', icon: 'directions_car' },
            { key: 'permis_c', label: 'Permis C', icon: 'local_shipping' },
            { key: 'permis_ppa', label: "Permis port d'arme", icon: 'gpp_maybe' },
            { key: 'permis_bravo', label: 'License BRAVO', icon: 'shield' },
            { key: 'permis_asd', label: 'License ASD', icon: 'verified_user' }
        ];

        // Créer le conteneur avec bordure arrondie (style véhicules)
        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.overflow = 'hidden';
        list.style.background = '#fff';

        let hasPermis = false;

        permisLabels.forEach((p, idx) => {
            const isActive = profile[p.key] === true || profile[p.key] === 't';
            const item = document.createElement('div');
            item.className = 'equipment-item permis-item';
            item.setAttribute('data-permis-key', p.key);
            item.setAttribute('data-permis-label', p.label);
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '12px';
            item.style.padding = '10px 12px';
            item.style.background = 'rgba(255, 255, 255, 0.03)';
            item.style.transition = 'all 0.3s ease';
            item.style.borderColor = 'var(--border-color)';
            if (idx !== 0) {
                item.style.borderTop = '1px solid #e0e0e0';
            }

            // Icône Material Symbols
            const icon = document.createElement('span');
            icon.className = 'material-symbols-rounded';
            icon.textContent = p.icon;
            icon.style.color = isActive ? 'var(--lspd-gold, #d4af37)' : '#7f8c8d';
            icon.style.fontSize = '20px';
            icon.style.transition = 'color 0.2s';


            // Texte du permis + statut en dessous
            const text = document.createElement('div');
            text.style.flex = '1';
            text.innerHTML = `<div style=\"font-weight: 600; color: var(--text-dark);\">${p.label}</div>`;
            // Texte statut en dessous
            const statusText = isActive ? 'En règle' : 'Suspendu / Non-acquis';
            const statusColor = isActive ? 'var(--success-color, #2ecc71)' : 'var(--danger-color, #e74c3c)';
            const statusDiv = document.createElement('div');
            statusDiv.className = 'permis-status';
            statusDiv.setAttribute('data-permis-key', p.key);
            statusDiv.style.fontSize = '13px';
            statusDiv.style.fontWeight = '600';
            statusDiv.style.color = statusColor;
            statusDiv.style.marginTop = '2px';
            statusDiv.textContent = statusText;
            text.appendChild(statusDiv);

            // Switch
            const switchWrapper = document.createElement('div');
            switchWrapper.className = 'checkbox-wrapper-34';
            switchWrapper.style.marginLeft = 'auto';
            const switchInput = document.createElement('input');
            switchInput.className = 'tgl tgl-ios permis-switch';
            switchInput.type = 'checkbox';
            switchInput.id = `switch_${p.key}`;
            switchInput.checked = isActive;
            switchInput.disabled = !isEditMode;
            const switchLabel = document.createElement('label');
            switchLabel.className = 'tgl-btn';
            switchLabel.setAttribute('for', `switch_${p.key}`);
            switchWrapper.appendChild(switchInput);
            switchWrapper.appendChild(switchLabel);

            item.appendChild(icon);
            item.appendChild(text);
            item.appendChild(switchWrapper);

            list.appendChild(item);
            hasPermis = true;
        });

        if (hasPermis) {
            permisList.appendChild(list);
        } else {
            permisList.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;">Aucun permis configuré</p>';
        }
            // Add instant feedback for switches (status text and icon color)
            if (isEditMode) {
                const switchInputs = list.querySelectorAll('.permis-switch');
                switchInputs.forEach(switchInput => {
                    switchInput.addEventListener('change', function() {
                        const item = switchInput.closest('.permis-item');
                        if (!item) return;
                        const statusDiv = item.querySelector('.permis-status');
                        const icon = item.querySelector('.material-symbols-rounded');
                        const isActive = switchInput.checked;
                        statusDiv.textContent = isActive ? 'En règle' : 'Suspendu / Non-acquis';
                        statusDiv.style.color = isActive ? 'var(--success-color, #2ecc71)' : 'var(--danger-color, #e74c3c)';
                        if (icon) {
                            icon.style.color = isActive ? 'var(--lspd-gold, #d4af37)' : '#7f8c8d';
                        }
                    });
                });
            }
    }
    /**
     * Affiche une modale pour gérer le statut d'un permis (En règle/Suspendu / Non-acquis).
     * @param {string} permisKey - Clé du permis (ex: 'permis_b').
     * @param {string} permisLabel - Nom du permis (ex: 'Permis B').
     * @param {boolean} isCurrentlyActive - Statut actuel du permis.
     */
    function showPermisModal(permisKey, permisLabel, isCurrentlyActive) {
        const existingModal = document.getElementById('permisModalOverlay');
        if (existingModal) existingModal.remove();

        const overlay = document.createElement('div');
        overlay.id = 'permisModalOverlay';
        overlay.style.position = 'fixed';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(0,0,0,0.5)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '5000';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s ease';

        const box = document.createElement('div');
        box.style.background = 'var(--white, #fff)';
        box.style.padding = '20px';
        box.style.borderRadius = '12px';
        box.style.maxWidth = '400px';
        box.style.width = '90%';
        box.style.boxShadow = '0 12px 40px rgba(0,0,0,0.25)';
        box.style.transform = 'scale(0.9)';
        box.style.transition = 'transform 0.2s ease';

        box.innerHTML = `
            <h3 style="margin-top: 0; color: var(--text-dark); border-bottom: 1px solid #eee; padding-bottom: 10px;">
                Gérer le statut : ${permisLabel}
            </h3>
            <p style="color: #7f8c8d; margin-bottom: 25px;">
                Statut actuel : 
                <strong id="currentPermisStatus" style="color: ${isCurrentlyActive ? 'var(--success-color, #2ecc71)' : 'var(--danger-color, #e74c3c)'};">
                    ${isCurrentlyActive ? 'En règle' : 'Suspendu / Non-acquis'}
                </strong>
            </p>

            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px;">
                <span style="font-weight: 600; color: var(--text-dark);">Statut du permis</span>
                <label class="switch" style="display: inline-block; width: 60px; height: 34px; position: relative;">
                    <input type="checkbox" id="permisSwitch" ${isCurrentlyActive ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                    <span class="slider round" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 34px;"></span>
                </label>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button id="cancelPermisBtn" class="btn btn-secondary" type="button" style="background: #fff; border: 1px solid #bbb; color: #222;">Annuler</button>
                <button id="savePermisBtn" class="btn btn-primary" type="button" disabled>Sauvegarder</button>
            </div>
        `;

        // Petit bout de CSS pour le switch (devrait être dans votre CSS principal)
        const style = document.createElement('style');
        style.textContent = `
            .switch input:checked + .slider {
                background-color: var(--success-color, #2ecc71);
            }
            .slider:before {
                position: absolute;
                content: "";
                height: 26px;
                width: 26px;
                left: 4px;
                bottom: 4px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }
            .switch input:checked + .slider:before {
                transform: translateX(26px);
            }
        `;
        document.head.appendChild(style);

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // Animations d'ouverture
        function updatePermisStatusText(switchInput, statusDiv, icon) {
            const isActive = switchInput.checked;
            statusDiv.textContent = isActive ? 'En règle' : 'Suspendu / Non-acquis';
            statusDiv.style.color = isActive ? 'var(--success-color, #2ecc71)' : 'var(--danger-color, #e74c3c)';
            if (icon) {
                icon.style.color = isActive ? 'var(--lspd-gold, #d4af37)' : '#7f8c8d';
            }
        }
        setTimeout(() => {
            overlay.style.opacity = '1';
            box.style.transform = 'scale(1)';
        }, 10);

        const permisSwitch = document.getElementById('permisSwitch');
        const saveBtn = document.getElementById('savePermisBtn');
    
        // Écouteurs d'événements
        permisSwitch.addEventListener('change', () => {
            // Activer le bouton Save uniquement si l'état a changé
            saveBtn.disabled = permisSwitch.checked === isCurrentlyActive;

            // Mise à jour visuelle du statut dans la modal
            const statusEl = document.getElementById('currentPermisStatus');
            if (permisSwitch.checked) {
                statusEl.textContent = 'En règle';
                statusEl.style.color = 'var(--success-color, #2ecc71)';
            } else {
                statusEl.textContent = 'Suspendu / Non-acquis';
                statusEl.style.color = 'var(--danger-color, #e74c3c)';
            }
        });

        // Fermeture
        const closeModal = () => {
            overlay.style.opacity = '0';
            box.style.transform = 'scale(0.9)';
            setTimeout(() => {
                overlay.remove();
                style.remove();
            }, 200);
        };

        document.getElementById('cancelPermisBtn').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        // Sauvegarde
        saveBtn.addEventListener('click', () => {
            const newState = permisSwitch.checked;
            if (newState !== isCurrentlyActive) {
                updatePermisStatus(permisKey, newState)
                    .then(success => {
                        if (success) {
                            closeModal();
                            loadCitoyenProfile();
                        }
                    });
            }
        });
    }

    /**
     * Met à jour le statut d'un permis via l'API et met à jour l'objet citoyenProfile.
     * @param {string} permisKey - Clé du permis.

            // Feedback instantané sur le texte statut
            if (isEditMode) {
                switchInput.addEventListener('change', () => {
                    updatePermisStatusText(switchInput, statusDiv, icon);
                });
            }
     * @param {boolean} newState - Nouvel état (true pour En règle, false pour Suspendu / Non-acquis).
     * @returns {Promise<boolean>}
     */
    async function updatePermisStatus(permisKey, newState) {
        if (!citoyenId) {
            showAnimation('error', 'ID citoyen manquant pour la mise à jour.');
            return false;
        }

        try {
            // Inclure tous les champs obligatoires + le permis modifié
            const updateData = {
                nom: originalData.nom || '',
                prenom: originalData.prenom || '',
                date_naissance: originalData.date_naissance || '',
                nationalite: originalData.nationalite || '',
                genre: originalData.genre || '',
                telephone: originalData.telephone || '',
                emploi: originalData.emploi || '',
                adresse: originalData.adresse || '',
                gang_affilie: originalData.gang_affilie || '',
                note_interne: originalData.note_interne || '',
                mandat_actif: originalData.mandat_actif || false,
                photo: originalData.photo || '',
                // Permis actuels
                permis_a: originalData.permis_a,
                permis_b: originalData.permis_b,
                permis_c: originalData.permis_c,
                permis_ppa: originalData.permis_ppa,
                permis_bravo: originalData.permis_bravo,
                permis_asd: originalData.permis_asd
            };
            updateData[permisKey] = newState;

            const res = await fetch(`/api/citoyens/${citoyenId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error);
            }

            const updatedProfile = await res.json();
            citoyenProfile = updatedProfile;

            if (originalData) {
                originalData[permisKey] = newState;
            }

            showAnimation('success', `Statut du permis mis à jour avec succès !`);
            return true;

        } catch (err) {
            console.error('Erreur mise à jour permis:', err);
            showAnimation('error', `Erreur de mise à jour du permis: ${err.message}`);
            return false;
        }
    }
    
    // Remplir les champs du formulaire
    document.getElementById('nom').value = profile.nom || '';
    document.getElementById('prenom').value = profile.prenom || '';
    document.getElementById('date_naissance').value = formatDateForInput(profile.date_naissance);
    document.getElementById('nationalite').value = profile.nationalite || '';
    document.getElementById('genre').value = profile.genre || '';
    document.getElementById('telephone').value = formatPhoneNumber(profile.telephone) || '';
    document.getElementById('emploi').value = profile.emploi || '';
    document.getElementById('adresse').value = profile.adresse || '';
    document.getElementById('gang_affilie').value = profile.gang_affilie || '';
    document.getElementById('note_interne').value = profile.note_interne || '';
    document.getElementById('mandat_actif').value = profile.mandat_actif ? 'true' : 'false';
    // Les champs permis_* n'existent plus dans le HTML, on retire l'affectation.

    // Afficher les métadonnées
    document.getElementById('citoyen_id').textContent = `ID: ${profile.id}`;
    document.getElementById('date_modification').textContent = formatDate(profile.updated_at);

    // Calculer l'âge
    const age = calculateAge(profile.date_naissance);

    // Afficher le nom complet avec l'âge dans le header
    const citoyenNameEl = document.getElementById('citoyen-name');
    if (citoyenNameEl) {
        const nomComplet = `${profile.prenom || ''} ${profile.nom || ''}`.trim() || 'Citoyen';
        const ageText = age ? ` (${age} ans)` : '';
        citoyenNameEl.textContent = nomComplet + ageText;
    }

    // Badge mandat d'arrêt avec couleurs
    const badgeEl = document.getElementById('citoyen-badge');
    if (badgeEl) {
        if (profile.mandat_actif) {
            badgeEl.textContent = '⚠️ MANDAT ACTIF';
            badgeEl.classList.add('mandat-actif');
            badgeEl.classList.remove('pas-de-mandat');
        } else {
            badgeEl.textContent = 'PAS DE MANDAT';
            badgeEl.classList.add('pas-de-mandat');
            badgeEl.classList.remove('mandat-actif');
        }
    }

    // Charger la photo
    updatePhotoPreview(profile.photo);

    // Sauvegarder les données originales
    originalData = {
        nom: profile.nom || '',
        prenom: profile.prenom || '',
        date_naissance: formatDateForInput(profile.date_naissance),
        nationalite: profile.nationalite || '',
        genre: profile.genre || '',
        telephone: profile.telephone || '',
        emploi: profile.emploi || '',
        adresse: profile.adresse || '',
        gang_affilie: profile.gang_affilie || '',
        note_interne: profile.note_interne || '',
        mandat_actif: profile.mandat_actif,
        photo: profile.photo || '',
        permis_a: !!profile.permis_a,
        permis_b: !!profile.permis_b,
        permis_c: !!profile.permis_c,
        permis_ppa: !!profile.permis_ppa,
        permis_bravo: !!profile.permis_bravo,
        permis_asd: !!profile.permis_asd
    };

    // Charger et afficher les armes associées
    try {
        await loadWeaponsForCitizen(profile.id);
    } catch (e) {
        console.warn('Impossible de charger les armes:', e);
    }

    // Désactiver les champs par défaut (mode consultation)
    disableFormFields();

    // Tout le monde peut éditer
    document.getElementById('edit-mode-btn').style.display = 'block';

    // Seuls les superadmins peuvent supprimer
    if (currentUserInfo && currentUserInfo.isSupervisor) {
        // Le bouton delete sera affiché en mode édition
    }
}

// Charger les armes associées à un citoyen et les afficher
async function loadWeaponsForCitizen(citizenId) {
    const container = document.getElementById('weapons-list');
    if (!container) return;
    container.innerHTML = '<div style="color:#7f8c8d">Chargement...</div>';

    try {
        const res = await fetch(`/api/weapons?owner_id=${encodeURIComponent(citizenId)}`);
        if (!res.ok) throw new Error('Erreur récupération armes');
        const data = await res.json();
        const weapons = data.weapons || [];

        if (weapons.length === 0) {
            container.innerHTML = '<div style="color:#7f8c8d">Aucune arme enregistrée.</div>';
            return;
        }

        // Render as a grouped list (border-radius on wrapper, items touching in the middle)
        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.border = '1px solid #e0e0e0';
        list.style.borderRadius = '8px';
        list.style.overflow = 'hidden';
        list.style.background = '#fff';

        weapons.forEach((w, idx) => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '10px';
            item.style.padding = '10px 12px';
            item.style.background = '#fff';
            item.style.cursor = 'pointer';
            if (idx !== 0) {
                item.style.borderTop = '1px solid #e0e0e0';
            }

            const img = document.createElement('img');
            img.src = w.model_image_url || '/data/images/weapon-placeholder.png';
            img.alt = w.model_name || 'Arme';
            img.style.width = '48px';
            img.style.height = '32px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '4px';

            const info = document.createElement('div');
            info.style.flex = '1';
            info.innerHTML = `<strong>${w.model_name || 'Modèle inconnu'}</strong><div style="color:#7f8c8d; font-size:13px">S/N: ${w.serial_number || '-'}</div>`;

            // Chevron
            const chevron = document.createElement('span');
            chevron.innerHTML = '&#8250;';
            chevron.style.fontSize = '22px';
            chevron.style.color = '#7f8c8d';
            chevron.style.marginLeft = '8px';
            chevron.style.transition = 'color 0.2s';
            chevron.style.userSelect = 'none';

            // Actions (delete button)
            const actions = document.createElement('div');
            let hasDelete = false;
            if (isEditMode && currentUserInfo && currentUserInfo.isSupervisor) {
                const delBtn = document.createElement('button');
                delBtn.setAttribute('type', 'button');
                delBtn.className = 'btn btn-danger';
                delBtn.textContent = 'Supprimer';
                hasDelete = true;

                function markItemForDeletion(mark) {
                    if (mark) {
                        pendingWeaponDeletions.add(w.id);
                        item.style.opacity = '0.55';
                        info.style.textDecoration = 'line-through';
                        delBtn.className = 'btn btn-secondary';
                        delBtn.textContent = 'Annuler';
                    } else {
                        pendingWeaponDeletions.delete(w.id);
                        item.style.opacity = '1';
                        info.style.textDecoration = 'none';
                        delBtn.className = 'btn btn-danger';
                        delBtn.textContent = 'Supprimer';
                    }
                }

                if (pendingWeaponDeletions.has(w.id)) markItemForDeletion(true);

                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!pendingWeaponDeletions.has(w.id)) {
                        showConfirmModal('Marquer cette arme pour suppression ? La suppression sera effectuée lors de l\'enregistrement.', 'Marquer', 'Annuler')
                            .then(confirmed => {
                                if (confirmed) markItemForDeletion(true);
                            });
                    } else {
                        markItemForDeletion(false);
                    }
                });
                actions.appendChild(delBtn);
            }

            item.appendChild(img);
            item.appendChild(info);
            if (!hasDelete) item.appendChild(chevron);
            item.appendChild(actions);

            // Clic sur la ligne = ouvrir la fiche arme (sauf clic sur bouton supprimer)
            item.addEventListener('click', (e) => {
                if (hasDelete && e.target.closest('button')) return;
                window.location.href = `/view-arme.html?id=${w.id}`;
            });

            // Hover effet sur chevron
            item.addEventListener('mouseenter', () => { chevron.style.color = '#3498db'; });
            item.addEventListener('mouseleave', () => { chevron.style.color = '#7f8c8d'; });

            list.appendChild(item);
        });

        container.innerHTML = '';
        container.appendChild(list);
    } catch (err) {
        console.error('Erreur chargement armes:', err);
        container.innerHTML = '<div style="color:#e74c3c">Erreur lors du chargement des armes</div>';
    }
}

// Fonction pour mettre à jour l'aperçu de la photo
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

// Fonction pour désactiver tous les champs du formulaire
function disableFormFields() {
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => input.disabled = true);
}

// Fonction pour activer tous les champs du formulaire
function enableFormFields() {
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => input.disabled = false);
}

// Fonction pour activer le mode édition
function activateEditMode() {
    isEditMode = true;
    document.body.classList.add('edit-mode');

    // Masquer le bouton édition, afficher sauvegarde et annulation
    document.getElementById('edit-mode-btn').style.display = 'none';
    document.getElementById('save-btn').style.display = 'block';
    document.getElementById('cancel-edit-btn').style.display = 'block';

    // Afficher le bouton supprimer uniquement pour les superadmins
    if (currentUserInfo && currentUserInfo.isSupervisor) {
        document.getElementById('delete-btn').style.display = 'block';
    }

    // Activer les champs
    enableFormFields();

    // Afficher les checkboxes et masquer les chevrons
    document.querySelectorAll('.permis-checkbox').forEach(cb => {
        cb.style.display = 'block';
    });
    document.querySelectorAll('#permis-list .material-symbols-rounded[style*="chevron"]').forEach(chevron => {
        if (chevron.textContent === 'chevron_right') {
            chevron.style.display = 'none';
        }
    });

    // Refresh weapons list so delete buttons appear when in edit mode
    try { loadWeaponsForCitizen(citoyenId); } catch (e) { /* ignore */ }

    // Refresh tags to show remove buttons
    renderTags();

    showAnimation('success', 'Mode édition activé');
}

// Fonction pour désactiver le mode édition
function deactivateEditMode() {
    isEditMode = false;
    document.body.classList.remove('edit-mode');

    // Restaurer l'affichage des boutons
    document.getElementById('edit-mode-btn').style.display = 'block';
    document.getElementById('save-btn').style.display = 'none';
    document.getElementById('cancel-edit-btn').style.display = 'none';
    document.getElementById('delete-btn').style.display = 'none';

    // Masquer les checkboxes et afficher les chevrons
    document.querySelectorAll('.permis-checkbox').forEach(cb => {
        cb.style.display = 'none';
    });
    document.querySelectorAll('#permis-list .material-symbols-rounded[style*="chevron"]').forEach(chevron => {
        if (chevron.textContent === 'chevron_right') {
            chevron.style.display = 'block';
        }
    });

    // Désactiver les champs
    disableFormFields();
    // Refresh weapons list to hide delete buttons
    try { loadWeaponsForCitizen(citoyenId); } catch (e) { /* ignore */ }

    // Refresh tags to hide remove buttons and add button
    renderTags();
}

// Fonction pour annuler les modifications
function cancelEdit() {
    // Restaurer les données originales
    document.getElementById('nom').value = originalData.nom;
    document.getElementById('prenom').value = originalData.prenom;
    document.getElementById('date_naissance').value = originalData.date_naissance;
    document.getElementById('nationalite').value = originalData.nationalite;
    document.getElementById('genre').value = originalData.genre;
    document.getElementById('telephone').value = formatPhoneNumber(originalData.telephone);
    // Correction : le champ "emploi" n'existe pas, on ignore ou on utilise "emploi" si présent
    if (document.getElementById('emploi')) {
        document.getElementById('emploi').value = originalData.emploi || '';
    }
    document.getElementById('mandat_actif').value = originalData.mandat_actif ? 'true' : 'false';

    updatePhotoPreview(originalData.photo);

    // Clear any pending weapon deletions and refresh list
    pendingWeaponDeletions.clear();
    try { loadWeaponsForCitizen(citoyenId); } catch (e) { /* ignore */ }

    deactivateEditMode();
    showAnimation('success', 'Modifications annulées');
}

// Fonction pour sauvegarder le profil
async function saveProfile(event) {
    event.preventDefault();

    try {
        const formData = {
            nom: document.getElementById('nom').value.trim(),
            prenom: document.getElementById('prenom').value.trim(),
            date_naissance: document.getElementById('date_naissance').value,
            nationalite: document.getElementById('nationalite').value.trim(),
            genre: document.getElementById('genre').value,
            telephone: document.getElementById('telephone').value.trim() || null,
            emploi: document.getElementById('emploi').value.trim() || null,
            adresse: document.getElementById('adresse').value.trim() || null,
            gang_affilie: document.getElementById('gang_affilie').value.trim() || null,
            note_interne: document.getElementById('note_interne').value.trim() || null,
            mandat_actif: document.getElementById('mandat_actif').value === 'true',
            photo: document.getElementById('photo_preview').src || '',
            permis_A: document.getElementById('switch_permis_a')?.checked || false,
            permis_B: document.getElementById('switch_permis_b')?.checked || false,
            permis_C: document.getElementById('switch_permis_c')?.checked || false,
            permis_PPA: document.getElementById('switch_permis_ppa')?.checked || false,
            permis_BRAVO: document.getElementById('switch_permis_bravo')?.checked || false,
            permis_ASD: document.getElementById('switch_permis_asd')?.checked || false
        };

        // Validation des champs obligatoires
        if (!formData.nom || !formData.prenom || !formData.date_naissance || !formData.nationalite || !formData.genre) {
            showAnimation('error', 'Veuillez remplir tous les champs obligatoires');
            return;
        }

        // If there are weapons marked for deletion, perform those deletions now
        if (pendingWeaponDeletions.size > 0) {
            const loader = document.getElementById('loaderOverlay');
            if (loader) loader.style.display = 'flex';
            try {
                const ids = Array.from(pendingWeaponDeletions);
                await Promise.all(ids.map(id => fetch(`/api/weapons/${id}`, { method: 'DELETE' }).then(async res => {
                    if (!res.ok) {
                        const err = await res.json().catch(() => ({ error: 'Erreur' }));
                        throw new Error(err.error || 'Erreur suppression arme');
                    }
                })));
                // clear pending deletions after successful server deletes
                pendingWeaponDeletions.clear();
                showAnimation('success', 'Suppressions enregistrées');
            } catch (err) {
                console.error('Erreur lors des suppressions:', err);
                showAnimation('error', err.message || 'Erreur lors des suppressions');
                if (loader) loader.style.display = 'none';
                return; // abort saving profile
            }
            if (loader) loader.style.display = 'none';
        }

        const res = await fetch(`/api/citoyens/${citoyenId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error);
        }

        const updatedProfile = await res.json();
        citoyenProfile = updatedProfile;

        // Mettre à jour les données originales
        originalData = { ...formData };

        deactivateEditMode();
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

// Fonction pour supprimer le citoyen
async function deleteCitoyen() {
    const nom = document.getElementById('nom').value.trim();
    const prenom = document.getElementById('prenom').value.trim();

    showConfirm(
        `Êtes-vous sûr de vouloir supprimer le citoyen ${prenom} ${nom} ?\n\nCette action est irréversible.`,
        (result) => {
            if (!result) return;

            deleteCitoyenConfirmed();
        },
        { yesText: 'Supprimer', noText: 'Annuler' }
    );
}

async function deleteCitoyenConfirmed() {
    const loader = document.getElementById('loaderOverlay');
    loader.style.display = 'flex';

    try {
        const res = await fetch(`/api/citoyens/${citoyenId}`, {
            method: 'DELETE'
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Erreur lors de la suppression');
        }

        showAnimation('success', 'Citoyen supprimé avec succès');
        setTimeout(() => {
            window.location.href = '/liste-citoyens.html';
        }, 1500);
    } catch (error) {
        console.error('Erreur:', error);
        showAnimation('error', error.message || 'Erreur lors de la suppression');
        loader.style.display = 'none';
    }
}

// Gestion du popup photo
function setupPhotoModal() {
    const photoContainer = document.getElementById('photo-container');
    const photoModal = document.getElementById('photoModal');
    const photoUrlInput = document.getElementById('photoUrlInput');
    const photoPreviewModal = document.getElementById('photoPreviewModal');
    const savePhotoBtn = document.getElementById('savePhotoBtn');
    const cancelPhotoBtn = document.getElementById('cancelPhotoBtn');

    photoContainer.addEventListener('click', () => {
        if (!(isEditMode || document.body.classList.contains('edit-mode'))) return;
        const previewEl = document.getElementById('photo_preview');
        photoUrlInput.value = previewEl && previewEl.src && !previewEl.src.includes('default-citoyen.png') ? previewEl.src : '';
        if (photoUrlInput.value) {
            photoPreviewModal.src = photoUrlInput.value;
            photoPreviewModal.style.display = 'block';
        } else {
            photoPreviewModal.style.display = 'none';
        }
        photoModal.style.display = 'flex';
    });

    photoUrlInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
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
        const url = photoUrlInput.value.trim();
        const previewEl = document.getElementById('photo_preview');
        if (url) {
            previewEl.src = url;
            previewEl.style.display = 'block';
        } else {
            previewEl.src = 'data/images/default-citoyen.png';
        }
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

// Fonction pour charger les véhicules du citoyen
async function loadVehicules() {
    const vehiculesListEl = document.getElementById('vehicules-list');
    if (!vehiculesListEl) return;

    // Afficher un loader pendant le chargement
    vehiculesListEl.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;"><i>Chargement des véhicules...</i></p>';

    try {
        const res = await fetch(`/api/vehicules?proprietaire_id=${citoyenId}&limit=100`);
        if (!res.ok) throw new Error('Erreur chargement véhicules');

        const data = await res.json();
        const vehicules = data.vehicules || [];

        if (vehicules.length === 0) {
            vehiculesListEl.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;">Aucun véhicule enregistré</p>';
            return;
        }

        // Déterminer le mode d'affichage selon le nombre de véhicules
        const count = vehicules.length;
        let displayMode = 'list'; // Par défaut : liste
        let maxDisplay = count;

        if (count >= 7) {
            displayMode = 'grid-compact';
            maxDisplay = 6; // Afficher 6, puis "Voir tous"
        } else if (count >= 4) {
            displayMode = 'grid';
        }

        // Appliquer le style selon le mode
        vehiculesListEl.className = `equipment-list vehicules-${displayMode}`;
        vehiculesListEl.innerHTML = '';

        // Afficher les véhicules (limité si beaucoup)
        const displayVehicules = vehicules.slice(0, maxDisplay);

        displayVehicules.forEach(vehicule => {
            const item = createVehiculeItem(vehicule, displayMode);
            vehiculesListEl.appendChild(item);
        });

        // Si plus de véhicules que la limite, ajouter un bouton "Voir tous"
        if (count > maxDisplay) {
            const seeAllBtn = document.createElement('div');
            seeAllBtn.className = 'see-all-vehicles-btn';
            seeAllBtn.innerHTML = `
                <span class="material-symbols-rounded">expand_more</span>
                Voir les ${count - maxDisplay} autres véhicules
            `;
            seeAllBtn.style.cssText = `
                grid-column: 1 / -1;
                padding: 12px;
                background: rgba(11, 27, 90, 0.1);
                border: 1px dashed var(--lspd-blue);
                border-radius: 8px;
                text-align: center;
                cursor: pointer;
                color: var(--lspd-blue);
                font-weight: 600;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            `;

            seeAllBtn.addEventListener('mouseenter', () => {
                seeAllBtn.style.background = 'rgba(11, 27, 90, 0.15)';
                seeAllBtn.style.borderColor = 'var(--lspd-gold)';
            });

            seeAllBtn.addEventListener('mouseleave', () => {
                seeAllBtn.style.background = 'rgba(11, 27, 90, 0.1)';
                seeAllBtn.style.borderColor = 'var(--lspd-blue)';
            });

            seeAllBtn.addEventListener('click', () => {
                showAllVehiclesModal(vehicules);
            });

            vehiculesListEl.appendChild(seeAllBtn);
        }

        // Rien à faire ici, les items sont déjà ajoutés à vehiculesListEl

    } catch (error) {
        console.error('Erreur chargement véhicules:', error);
        vehiculesListEl.innerHTML = '<p style="color: #e74c3c; font-size: 14px;">Erreur de chargement</p>';
    }
}

// Fonction pour créer un élément véhicule selon le mode d'affichage
function createVehiculeItem(vehicule, displayMode = 'list') {
    const item = document.createElement('div');
    item.className = 'equipment-item';
    item.style.cursor = 'pointer';
    item.style.transition = 'all 0.3s ease';

    const mandatBadge = vehicule.mandat_actif
        ? '<span style="color: #e74c3c; font-weight: 600; margin-left: 8px; font-size: 12px;">⚠️</span>'
        : '';

    // Mode compact pour grille
    if (displayMode === 'grid' || displayMode === 'grid-compact') {
        item.style.padding = '10px 12px';
        item.innerHTML = `
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; color: var(--text-dark); margin-bottom: 2px; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${vehicule.modele || 'Modèle inconnu'}${mandatBadge}
                </div>
                <div style="font-size: 12px; color: #7f8c8d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${vehicule.plaque || 'N/A'}
                </div>
            </div>
            <span class="material-symbols-rounded" style="color: var(--lspd-gold); font-size: 18px; flex-shrink: 0;">
                chevron_right
            </span>
        `;
    } else {
        // Mode liste normal (original)
        item.innerHTML = `
            <div style="flex: 1;">
                <div style="font-weight: 600; color: var(--text-dark); margin-bottom: 4px;">
                    ${vehicule.modele || 'Modèle inconnu'}${mandatBadge}
                </div>
                <div style="font-size: 13px; color: #7f8c8d;">
                    Plaque: ${vehicule.plaque || 'N/A'}
                </div>
            </div>
            <span class="material-symbols-rounded" style="color: var(--lspd-gold); font-size: 20px;">
                chevron_right
            </span>
        `;
    }

    item.addEventListener('click', () => {
        window.location.href = `/view-vehicule.html?id=${vehicule.id}`;
    });

    item.addEventListener('mouseenter', () => {
        item.style.background = 'rgba(255, 255, 255, 0.08)';
        item.style.borderColor = 'var(--lspd-gold)';
    });

    item.addEventListener('mouseleave', () => {
        item.style.background = 'rgba(255, 255, 255, 0.03)';
        item.style.borderColor = 'var(--border-color)';
    });

    return item;
}

// Fonction pour afficher la modale avec tous les véhicules
function showAllVehiclesModal(vehicules) {
    // Créer la modale
    const modal = document.createElement('div');
    modal.className = 'vehicles-modal-overlay';
    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        max-width: 800px;
        width: 90%;
        max-height: 80vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    `;

    const modalHeader = document.createElement('div');
    modalHeader.style.cssText = `
        padding: 20px 24px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        align-items: center;
        justify-content: space-between;
    `;
    modalHeader.innerHTML = `
        <h3 style="margin: 0; color: var(--lspd-blue); display: flex; align-items: center; gap: 10px;">
            <span class="material-symbols-rounded">garage</span>
            Tous les véhicules (${vehicules.length})
        </h3>
        <button class="modal-close-btn" style="background: none; border: none; cursor: pointer; padding: 8px; border-radius: 50%; transition: background 0.2s;">
            <span class="material-symbols-rounded" style="font-size: 24px; color: #666;">close</span>
        </button>
    `;

    const modalBody = document.createElement('div');
    modalBody.style.cssText = `
        padding: 16px 24px;
        overflow-y: auto;
        flex: 1;
    `;

    const vehiculesGrid = document.createElement('div');
    vehiculesGrid.className = 'equipment-list vehicules-grid';
    vehiculesGrid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 12px;
    `;

    vehicules.forEach(vehicule => {
        const item = createVehiculeItem(vehicule, 'grid');
        vehiculesGrid.appendChild(item);
    });

    modalBody.appendChild(vehiculesGrid);
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Fermer la modale
    const closeBtn = modalHeader.querySelector('.modal-close-btn');
    const closeModal = () => {
        modal.style.animation = 'fadeOut 0.2s ease';
        setTimeout(() => modal.remove(), 200);
    };

    closeBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = 'rgba(0, 0, 0, 0.05)';
    });
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = 'none';
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Animations CSS
    if (!document.getElementById('vehicles-modal-animations')) {
        const style = document.createElement('style');
        style.id = 'vehicles-modal-animations';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Fonction pour charger les rapports impliquant le citoyen
async function loadCitizenReports(citizenId) {
    const suspectContainer = document.getElementById('rapports-suspect-list');
    const autreContainer = document.getElementById('rapports-autre-list');
    
    if (!suspectContainer || !autreContainer) return;

    suspectContainer.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;">Chargement...</p>';
    autreContainer.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;">Chargement...</p>';

    try {
        // Charger les rapports où le citoyen est suspect (on en prend plus pour le "Voir plus")
        const resSuspect = await fetch(`/api/rapports-arrestation?suspectId=${citizenId}&limit=100`);
        if (resSuspect.ok) {
            const data = await resSuspect.json();
            renderReports(suspectContainer, data.reports, 'suspect');
        }

        // Charger les rapports où le citoyen est impliqué (victime/témoin)
        const resAutre = await fetch(`/api/rapports-arrestation?civilId=${citizenId}&limit=100`);
        if (resAutre.ok) {
            const data = await resAutre.json();
            renderReports(autreContainer, data.reports, 'autre');
        }

    } catch (err) {
        console.error("Erreur loadCitizenReports:", err);
        suspectContainer.innerHTML = '<p style="color: #e74c3c; font-size: 14px;">Erreur.</p>';
        autreContainer.innerHTML = '<p style="color: #e74c3c; font-size: 14px;">Erreur.</p>';
    }
}

function renderReports(container, reports, type) {
    if (!reports || reports.length === 0) {
        container.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;">Aucun rapport trouvé.</p>';
        return;
    }

    container.innerHTML = '';
    
    const maxDisplay = 5;
    const count = reports.length;
    const displayReports = reports.slice(0, maxDisplay);

    // Créer une liste groupée
    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.overflow = 'hidden';
    list.style.background = '#fff';

    displayReports.forEach((report, idx) => {
        const item = createReportItem(report, type);
        if (idx !== 0) item.style.borderTop = '1px solid #e0e0e0';
        list.appendChild(item);
    });
    
    container.appendChild(list);

    // Si plus de rapports que la limite, ajouter un bouton "Voir tous"
    if (count > maxDisplay) {
        const seeAllBtn = document.createElement('div');
        seeAllBtn.className = 'see-all-reports-btn';
        seeAllBtn.innerHTML = `
            <span class="material-symbols-rounded">expand_more</span>
            Voir les ${count - maxDisplay} autres rapports (${type === 'suspect' ? 'suspect' : 'autres'})
        `;
        seeAllBtn.style.cssText = `
            margin-top: 8px;
            padding: 10px;
            background: rgba(11, 27, 90, 0.05);
            border: 1px dashed var(--lspd-blue);
            border-radius: 8px;
            text-align: center;
            cursor: pointer;
            color: var(--lspd-blue);
            font-weight: 600;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 13px;
        `;

        seeAllBtn.addEventListener('mouseenter', () => {
            seeAllBtn.style.background = 'rgba(11, 27, 90, 0.1)';
            seeAllBtn.style.borderColor = 'var(--lspd-gold)';
        });

        seeAllBtn.addEventListener('mouseleave', () => {
            seeAllBtn.style.background = 'rgba(11, 27, 90, 0.05)';
            seeAllBtn.style.borderColor = 'var(--lspd-blue)';
        });

        seeAllBtn.addEventListener('click', () => {
            showAllReportsModal(reports, type);
        });

        container.appendChild(seeAllBtn);
    }
}

function createReportItem(report, type) {
    const dateObj = new Date(report.date_arrestation);
    const dateStr = dateObj.toLocaleDateString('fr-FR');
    
    const item = document.createElement('div');
    item.className = 'equipment-item';
    item.style.cursor = 'pointer';
    item.style.padding = '10px 12px';
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.style.transition = 'all 0.3s ease';
    
    item.onclick = () => window.location.href = `/view-rapport-arrestation?id=${report.id}`;
    
    let detailText = '';
    if (report.titre_rapport && report.titre_rapport.trim() !== '') {
        detailText = report.titre_rapport;
    } else if (type === 'suspect') {
        detailText = `Rapport #${report.id}`;
    } else {
        detailText = `Rapport #${report.id} (Impliqué)`;
    }

    item.innerHTML = `
        <div style="display:flex; flex-direction:column;">
            <span style="font-weight:600; color:var(--text-dark);">${detailText}</span>
            <span style="font-size:12px; color:#7f8c8d;">${dateStr}</span>
        </div>
        <span class="material-symbols-rounded" style="color: var(--lspd-gold); font-size: 20px;">chevron_right</span>
    `;

    item.addEventListener('mouseenter', () => {
        item.style.background = 'rgba(0, 0, 0, 0.02)';
    });

    item.addEventListener('mouseleave', () => {
        item.style.background = 'transparent';
    });

    return item;
}

function showAllReportsModal(reports, type) {
    const title = type === 'suspect' ? 'Rapports (Suspect)' : 'Rapports (Autre)';
    const icon = type === 'suspect' ? 'gavel' : 'folder_shared';

    const modal = document.createElement('div');
    modal.className = 'reports-modal-overlay';
    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    `;

    const modalHeader = document.createElement('div');
    modalHeader.style.cssText = `
        padding: 20px 24px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        align-items: center;
        justify-content: space-between;
    `;
    modalHeader.innerHTML = `
        <h3 style="margin: 0; color: var(--lspd-blue); display: flex; align-items: center; gap: 10px;">
            <span class="material-symbols-rounded">${icon}</span>
            ${title} (${reports.length})
        </h3>
        <button class="modal-close-btn" style="background: none; border: none; cursor: pointer; padding: 8px; border-radius: 50%; transition: background 0.2s;">
            <span class="material-symbols-rounded" style="font-size: 24px; color: #666;">close</span>
        </button>
    `;

    const modalBody = document.createElement('div');
    modalBody.style.cssText = `
        padding: 16px 24px;
        overflow-y: auto;
        flex: 1;
    `;

    const list = document.createElement('div');
    list.className = 'reports-list';

    reports.forEach((report, idx) => {
        const item = createReportItem(report, type);
        if (idx !== 0) item.style.borderTop = '1px solid #e0e0e0';
        list.appendChild(item);
    });

    modalBody.appendChild(list);
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    const closeBtn = modalHeader.querySelector('.modal-close-btn');
    const closeModal = () => {
        modal.style.animation = 'fadeOut 0.2s ease';
        setTimeout(() => modal.remove(), 200);
    };

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

async function loadCriminalRecord(citizenId) {
    const container = document.getElementById('casier-list');
    if (!container) return;
    
    container.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;">Chargement...</p>';
    
    try {
        const res = await fetch(`/api/calcul-peine?citizen_id=${citizenId}`);
        if (!res.ok) throw new Error('Erreur chargement casier');
        
        const records = await res.json();
        
        // Store records for export
        criminalRecords = records;
        
        if (records.length === 0) {
            container.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;">Casier vierge.</p>';
            return;
        }
        
        // Add export button if records exist
        container.innerHTML = '';
        
        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';  // Important: évite la soumission du formulaire
        exportBtn.className = 'btn btn-secondary';
        exportBtn.style.cssText = 'margin-bottom: 12px; display: inline-flex; align-items: center; gap: 8px;';
        exportBtn.innerHTML = '<span class="material-symbols-rounded">download</span>Exporter en PNG';
        exportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            exportCriminalRecordToPNG();
        });
        container.appendChild(exportBtn);
        
        const list = document.createElement('div');
        list.style.display = 'grid';
        list.style.gridTemplateColumns = 'repeat(2, 1fr)';
        list.style.gap = '16px';
        list.style.width = '100%';
        
        records.forEach((record, idx) => {
            const dateStr = new Date(record.date).toLocaleDateString('fr-FR', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            
            const item = document.createElement('div');
            item.className = 'equipment-item';
            item.style.padding = '15px';
            item.style.cursor = 'default';
            item.style.border = '1px solid #e0e0e0';
            item.style.borderRadius = '8px';
            item.style.background = '#fff';
            
            // Parse details to show summary
            let detailsHtml = '';
            try {
                const details = typeof record.details === 'string' ? JSON.parse(record.details) : record.details;
                if (Array.isArray(details)) {
                    detailsHtml = '<ul style="margin: 8px 0 8px 20px; font-size: 13px; color: #555; list-style-type: disc;">';
                    details.forEach(d => {
                        detailsHtml += `<li>${d.qte}x ${d.nom} (${d.peines} / ${d.amendes})</li>`;
                    });
                    detailsHtml += '</ul>';
                }
            } catch (e) {
                detailsHtml = '<p style="font-size: 12px; color: red;">Erreur lecture détails</p>';
            }
            
            // Delete button for Command Staff (using isSupervisor as proxy for now, or check specific role if available)
            let deleteBtn = '';
            if (currentUserInfo && currentUserInfo.isSupervisor) {
                deleteBtn = `<button class="btn btn-danger" onclick="deleteCriminalRecord(${record.id})" style="margin-left: auto; padding: 4px 8px; font-size: 12px;">Supprimer</button>`;
            }
            
            item.innerHTML = `
                <div style="display:flex; align-items:flex-start; width:100%;">
                    <div style="flex:1;">
                        <div style="font-weight:600; color:var(--text-dark); display:flex; align-items:center; gap:8px;">
                            <span class="material-symbols-rounded" style="font-size:18px; color:var(--lspd-blue);">gavel</span>
                            Enregistrement du ${dateStr}
                        </div>
                        <div style="font-size:13px; color:#7f8c8d; margin-top:4px; margin-bottom:4px;">
                            Total: <strong style="color:#e74c3c;">${record.total_peine}</strong> de prison / <strong style="color:#2ecc71;">$${record.total_amende}</strong> d'amende
                        </div>
                        ${detailsHtml}
                        <div style="font-size:12px; color:#999;">Enregistré par: ${record.officer_id}</div>
                    </div>
                    ${deleteBtn}
                </div>
            `;
            
            list.appendChild(item);
        });
        
        container.appendChild(list);
        
    } catch (err) {
        console.error('Erreur chargement casier:', err);
        container.innerHTML = '<p style="color: #e74c3c; font-size: 14px;">Erreur de chargement.</p>';
    }
}

window.deleteCriminalRecord = async function(id) {
    showConfirm('Êtes-vous sûr de vouloir supprimer cette entrée du casier judiciaire ?', (result) => {
        if (!result) return;

        deleteCriminalRecordConfirmed(id);
    }, { yesText: 'Supprimer', noText: 'Annuler' });
};

async function deleteCriminalRecordConfirmed(id) {
    try {
        const res = await fetch(`/api/calcul-peine/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Erreur suppression');
        }
        
        showAnimation('success', 'Entrée supprimée');
        loadCriminalRecord(citoyenId); // Reload
    } catch (err) {
        console.error(err);
        showAnimation('error', err.message || 'Erreur lors de la suppression');
    }
};

// Function to export criminal record to PNG
async function exportCriminalRecordToPNG() {
    if (!criminalRecords || criminalRecords.length === 0) {
        showAnimation('error', 'Aucun casier à exporter');
        return;
    }
    
    if (!citoyenProfile) {
        showAnimation('error', 'Profil citoyen non chargé');
        return;
    }
    
    const loader = document.getElementById('loaderOverlay');
    if (loader) loader.style.display = 'flex';
    
    // Load delits data to get proper categorization
    try {
        const delitsRes = await fetch('/api/getDelits');
        if (!delitsRes.ok) throw new Error('Erreur chargement délits');
        const delitsData = await delitsRes.json();
        
        // Create a map of delit name to type
        const delitTypeMap = {};
        delitsData.forEach(delit => {
            delitTypeMap[delit.chef_accusation.toLowerCase()] = delit.type;
        });
        
        // Load html2canvas if not already loaded
        if (typeof html2canvas === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
            script.onload = () => {
                if (loader) loader.style.display = 'none';
                generateAndDownloadPNG(delitTypeMap);
            };
            script.onerror = () => {
                if (loader) loader.style.display = 'none';
                showAnimation('error', 'Erreur de chargement de la bibliothèque');
            };
            document.head.appendChild(script);
        } else {
            if (loader) loader.style.display = 'none';
            generateAndDownloadPNG(delitTypeMap);
        }
    } catch (err) {
        console.error('Erreur chargement délits:', err);
        if (loader) loader.style.display = 'none';
        showAnimation('error', 'Erreur lors du chargement des types de délits');
    }
}

function generateAndDownloadPNG(delitTypeMap) {
    console.log('generateAndDownloadPNG appelée', delitTypeMap);
    
    const loader = document.getElementById('loaderOverlay');
    if (loader) loader.style.display = 'flex';
    
    const fullName = `${citoyenProfile.prenom} ${citoyenProfile.nom}`.trim();
    
    // Create a hidden container for the document
    const container = document.createElement('div');
    container.style.cssText = `
        position: fixed;
        left: -9999px;
        top: 0;
        width: 794px;
        background: white;
        font-family: 'Segoe UI', Arial, sans-serif;
        padding: 0;
        box-sizing: border-box;
    `;
    
    // Build criminal charges lists based on delit type from database
    let criminalCharges = [];      // Crime
    let correctionalCharges = [];  // Délit mineur + Délit majeur
    let policeCharges = [];        // Contravention
    
    criminalRecords.forEach(record => {
        try {
            const details = typeof record.details === 'string' ? JSON.parse(record.details) : record.details;
            if (Array.isArray(details)) {
                details.forEach(d => {
                    const delitName = d.nom;
                    const delitType = delitTypeMap[delitName.toLowerCase()];
                    
                    console.log(`Délit: "${delitName}", Type trouvé: "${delitType}"`);
                    
                    // Categorize based on type from database (case-insensitive and trim whitespace)
                    const normalizedType = delitType ? delitType.toLowerCase().trim() : '';
                    
                    if (normalizedType === 'crime') {
                        criminalCharges.push(delitName);
                    } else if (normalizedType === 'delit mineur' || normalizedType === 'délit mineur' || 
                               normalizedType === 'delit majeur' || normalizedType === 'délit majeur') {
                        correctionalCharges.push(delitName);
                    } else if (normalizedType === 'contravention') {
                        policeCharges.push(delitName);
                    } else {
                        // If type not found or unknown, default to police charges
                        console.warn(`Type non reconnu pour "${delitName}": "${delitType}" (normalisé: "${normalizedType}")`);
                        policeCharges.push(delitName);
                    }
                });
            }
        } catch (e) {
            console.error('Error parsing record details:', e);
        }
    });
    
    // Remove duplicates
    criminalCharges = [...new Set(criminalCharges)];
    correctionalCharges = [...new Set(correctionalCharges)];
    policeCharges = [...new Set(policeCharges)];
    
    // Build HTML content
    container.innerHTML = `
        <div style="padding: 40px; background: #f5f5f5;">
            <!-- Header with LSPD logo -->
            <div style="text-align: center; margin-bottom: 30px;">
                <img src="data/images/lspd.png" alt="LSPD Logo" style="width: 150px; height: 150px; margin: 0 auto 20px; display: block;" crossorigin="anonymous" />
                <div style="font-size: 11px; color: #666; letter-spacing: 3px; margin-bottom: 5px;">⭐⭐⭐⭐⭐</div>
                <div style="font-size: 11px; color: #666; letter-spacing: 1px;">LOS SANTOS POLICE DEPARTMENT</div>
                <div style="font-size: 9px; color: #999; margin-top: 3px;">• TO PROTECT AND TO SERVE •</div>
            </div>
            
            <!-- Title -->
            <h1 style="text-align: center; font-size: 24px; font-weight: 700; color: #000; margin: 30px 0; letter-spacing: 2px; text-transform: uppercase; border-bottom: 3px solid #003366; padding-bottom: 10px;">
                EXTRAIT DE CASIER JUDICIAIRE
            </h1>
            
            <!-- Citizen name -->
            <div style="text-align: center; font-size: 18px; font-weight: 600; color: #003366; margin-bottom: 40px;">
                ${fullName}
            </div>
            
            <!-- Criminal Charges Section -->
            <div style="margin-bottom: 25px;">
                <h3 style="font-size: 14px; font-weight: 700; color: #000; margin-bottom: 10px; text-transform: uppercase;">
                    Condamnation criminelles :
                </h3>
                <ul style="margin: 0; padding-left: 25px; font-size: 13px; color: #333; line-height: 1.8;">
                    ${criminalCharges.length > 0 ? criminalCharges.map(c => `<li>Auteur de ${c}</li>`).join('') : '<li style="color: #999; font-style: italic;">Aucune</li>'}
                </ul>
            </div>
            
            <!-- Correctional Charges Section -->
            <div style="margin-bottom: 25px;">
                <h3 style="font-size: 14px; font-weight: 700; color: #000; margin-bottom: 10px; text-transform: uppercase;">
                    Condamnation correctionnelles :
                </h3>
                <ul style="margin: 0; padding-left: 25px; font-size: 13px; color: #333; line-height: 1.8;">
                    ${correctionalCharges.length > 0 ? correctionalCharges.map(c => `<li>Auteur de ${c}</li>`).join('') : '<li style="color: #999; font-style: italic;">Aucune</li>'}
                </ul>
            </div>
            
            <!-- Police Charges Section -->
            <div style="margin-bottom: 35px;">
                <h3 style="font-size: 14px; font-weight: 700; color: #000; margin-bottom: 10px; text-transform: uppercase;">
                    Condamnation de police :
                </h3>
                <ul style="margin: 0; padding-left: 25px; font-size: 13px; color: #333; line-height: 1.8;">
                    ${policeCharges.length > 0 ? policeCharges.map(c => `<li>${c}</li>`).join('') : '<li style="color: #999; font-style: italic;">Aucune</li>'}
                </ul>
            </div>
            
            <!-- Footer with second logo -->
            <div style="margin-top: 50px; text-align: center; padding-top: 30px; border-top: 2px solid #ddd;">
                <img src="data/images/patchchief.png" alt="LSPD Chief Patch" style="width: 120px; height: 120px; margin: 0 auto 15px; display: block;" crossorigin="anonymous" />
                <div style="font-size: 9px; color: #666; letter-spacing: 2px; margin-bottom: 3px;">⭐⭐⭐</div>
                <div style="font-size: 9px; color: #666; margin-top: 5px; line-height: 1.5;">
                    LOS SANTOS POLICE DEPARTMENT - 2026 OFFICIAL REPORT<br>
                    MISSION ROW BOULEVARD, SAN ANDREAS AVENUE, LOS SANTOS 5782
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(container);
    
    // Generate PNG with html2canvas
    setTimeout(() => {
        html2canvas(container, {
            scale: 2,
            backgroundColor: '#f5f5f5',
            logging: false,
            width: 794,
            windowWidth: 794
        }).then(canvas => {
            // Convert to blob and download
            canvas.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const filename = `Casier_Judiciaire_${fullName.replace(/\s+/g, '_')}_${new Date().getTime()}.png`;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
                
                // Remove the container
                document.body.removeChild(container);
                
                if (loader) loader.style.display = 'none';
                showAnimation('success', 'Casier exporté avec succès');
            }, 'image/png');
        }).catch(err => {
            console.error('Error generating PNG:', err);
            document.body.removeChild(container);
            if (loader) loader.style.display = 'none';
            showAnimation('error', 'Erreur lors de la génération du PNG');
        });
    }, 100);
}

// --- GESTION DES TAGS ---
let availableTags = [];
let citizenTags = [];

async function loadCitizenTags() {
    try {
        const res = await fetch(`/api/tags/entity/citoyen/${citoyenId}`);
        if (res.ok) {
            citizenTags = await res.json();
            renderTags();
        }
    } catch (err) {
        console.error('Erreur chargement tags citoyen:', err);
    }
}

function renderTags() {
    const container = document.getElementById('tagsContainer');
    if (!container) return;
    const addBtn = document.getElementById('addTagBtn');
    
    // Supprimer les tags existants (sauf le bouton d'ajout)
    const existingTags = container.querySelectorAll('.tag-item');
    existingTags.forEach(t => t.remove());
    
    citizenTags.forEach(tag => {
        const tagEl = document.createElement('div');
        tagEl.className = 'tag-item';
        tagEl.style.backgroundColor = tag.color;
        tagEl.style.display = 'flex';
        tagEl.style.alignItems = 'center';
        tagEl.style.gap = '6px';
        tagEl.style.padding = '4px 12px';
        tagEl.style.borderRadius = '20px';
        tagEl.style.fontSize = '13px';
        tagEl.style.fontWeight = '600';
        tagEl.style.color = 'white';
        tagEl.innerHTML = `
            <span>${tag.name}</span>
            <span class="material-symbols-rounded remove-tag" data-id="${tag.id}" style="cursor: pointer; font-size: 16px; opacity: 0.7;">close</span>
        `;
        
        // Cacher la croix si pas en mode édition
        const removeBtn = tagEl.querySelector('.remove-tag');
        removeBtn.style.display = isEditMode ? 'block' : 'none';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeTagFromCitizen(tag.id);
        });
        
        container.insertBefore(tagEl, addBtn);
    });
    
    // Cacher le bouton d'ajout si pas en mode édition
    if (addBtn) {
        addBtn.style.display = isEditMode ? 'flex' : 'none';
    }
}

async function removeTagFromCitizen(tagId) {
    try {
        const res = await fetch(`/api/tags/entity?tag_id=${tagId}&entity_id=${citoyenId}&entity_type=citoyen`, {
            method: 'DELETE'
        });
        
        if (res.ok) {
            citizenTags = citizenTags.filter(t => t.id !== tagId);
            renderTags();
        }
    } catch (err) {
        console.error('Erreur suppression tag:', err);
    }
}

function setupTagsHandlers() {
    const addTagBtn = document.getElementById('addTagBtn');
    const tagModal = document.getElementById('tagSelectorModal');
    const closeTagModal = document.getElementById('closeTagModal');

    if (addTagBtn) {
        addTagBtn.addEventListener('click', async () => {
            await loadAvailableTags();
            renderModalTagList();
            tagModal.style.display = 'flex';
        });
    }

    if (closeTagModal) {
        closeTagModal.addEventListener('click', () => {
            tagModal.style.display = 'none';
        });
    }
}

async function loadAvailableTags() {
    try {
        const res = await fetch('/api/tags?type=citoyen');
        if (res.ok) {
            availableTags = await res.json();
        }
    } catch (err) {
        console.error('Erreur chargement tags disponibles:', err);
    }
}

function renderModalTagList() {
    const list = document.getElementById('modalTagList');
    if (!list) return;
    list.innerHTML = '';

    availableTags.forEach(tag => {
        const isAlreadyAdded = citizenTags.some(t => t.id === tag.id);
        if (isAlreadyAdded) return;

        const item = document.createElement('div');
        item.className = 'tag-option';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'space-between';
        item.style.padding = '8px 12px';
        item.style.borderRadius = '8px';
        item.style.cursor = 'pointer';
        item.style.transition = 'background 0.2s';
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: ${tag.color};"></div>
                <span>${tag.name}</span>
            </div>
            <span class="material-symbols-rounded" style="color: var(--success-color, #2ecc71);">add_circle</span>
        `;
        
        item.addEventListener('mouseover', () => item.style.background = '#f0f2f5');
        item.addEventListener('mouseout', () => item.style.background = 'transparent');
        item.addEventListener('click', () => addTagToCitizen(tag.id));
        list.appendChild(item);
    });
    
    if (list.innerHTML === '') {
        list.innerHTML = '<p style="text-align: center; color: #666; font-size: 14px;">Aucun autre tag disponible</p>';
    }
}

async function addTagToCitizen(tagId) {
    try {
        const res = await fetch('/api/tags/entity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tag_id: tagId,
                entity_id: citoyenId,
                entity_type: 'citoyen'
            })
        });

        if (res.ok) {
            const tag = availableTags.find(t => t.id === tagId);
            if (tag && !citizenTags.some(t => t.id === tag.id)) {
                citizenTags.push(tag);
            }
            renderTags();
            renderModalTagList();
        }
    } catch (err) {
        console.error('Erreur ajout tag au citoyen:', err);
    }
}

// Fonction pour formater un numéro de téléphone au format 555-XXXX
function formatPhoneNumber(phone) {
    if (!phone) return '';
    
    // Extraire uniquement les chiffres
    const digits = phone.replace(/\D/g, '');
    
    // Si moins de 4 chiffres, retourner tel quel
    if (digits.length < 4) return digits;
    
    // Prendre les 7 derniers chiffres si plus de 7
    const cleaned = digits.slice(-7);
    
    // Formater : 555-XXXX (3 premiers chiffres, tiret, 4 derniers)
    if (cleaned.length <= 3) {
        return cleaned;
    } else {
        return cleaned.substring(0, 3) + '-' + cleaned.substring(3, 7);
    }
}

// Formatage automatique du téléphone (format 555-XXXX)
function setupPhoneFormatting() {
    const telephoneInput = document.getElementById('telephone');
    if (telephoneInput) {
        telephoneInput.addEventListener('input', function (e) {
            let cursorPos = this.selectionStart;
            let value = this.value.replace(/\D/g, '');
            const oldLength = this.value.length;

            // Limiter à 7 chiffres (555-XXXX)
            if (value.length > 7) value = value.slice(0, 7);

            let formatted = '';
            if (value.length > 0) {
                formatted = value.substring(0, 3);
                if (value.length >= 4) {
                    formatted += '-' + value.substring(3, 7);
                }
            }

            this.value = formatted;

            // Ajuster la position du curseur
            const newLength = formatted.length;
            if (newLength > oldLength) {
                cursorPos += (newLength - oldLength);
            }
            this.setSelectionRange(cursorPos, cursorPos);
        });
        telephoneInput.setAttribute('maxlength', '8');
    }
}

// Initialisation de la page
document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('loaderOverlay');
    loader.style.display = 'flex';

    try {
        // Charger l'utilisateur et le citoyen en parallèle
        const [userInfo] = await Promise.all([
            loadUserInfo(),
            loadCitoyenProfile()
        ]);

        setupPhotoModal();
        setupPhoneFormatting();
        setupTagsHandlers();

        // Boutons d'action
        document.getElementById('edit-mode-btn').addEventListener('click', activateEditMode);
        document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
        document.getElementById('profileForm').addEventListener('submit', saveProfile);
        document.getElementById('delete-btn').addEventListener('click', deleteCitoyen);
        document.getElementById('backlinkBtn').addEventListener('click', () => {
            window.history.back();
        });

        // "Ajouter une arme" button removed from UI — no handler needed.

        // Click-to-copy ID
        const idEl = document.getElementById('citoyen_id');
        if (idEl) {
            idEl.addEventListener('click', async () => {
                const raw = idEl.textContent || '';
                const match = raw.match(/ID:\s*(.+)$/i);
                const value = match ? match[1].trim() : raw.trim();
                try {
                    await navigator.clipboard.writeText(value);
                    idEl.classList.add('copied');
                    setTimeout(() => idEl.classList.remove('copied'), 2000);
                } catch (e) {
                    console.warn('Clipboard échoué', e);
                }
            });
        }

    } catch (err) {
        console.error('Erreur initialisation page:', err);
    } finally {
        // Cacher le loader dès que le profil est affiché
        // Les véhicules continueront de charger en arrière-plan
        loader.style.display = 'none';
    }
});
