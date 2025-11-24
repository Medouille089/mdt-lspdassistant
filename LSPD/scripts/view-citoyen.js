let citoyenId = null;
let citoyenProfile = null;
let currentUserInfo = null;
let isEditMode = false;
let originalData = {};

// Fonction pour afficher les animations de feedback
function showAnimation(type = 'success', message = '') {
    const container = document.getElementById('feedbackAnimation');
    if (!container) {
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

    } catch (err) {
        console.error('Erreur chargement profil:', err);
        showAnimation('error', `Erreur de chargement du profil: ${err.message}`);
        setTimeout(() => window.location.href = '/liste-citoyens.html', 2000);
    }
}

// Fonction pour afficher le profil dans le formulaire
async function displayProfile(profile) {
    // Remplir les champs du formulaire
    document.getElementById('nom').value = profile.nom || '';
    document.getElementById('prenom').value = profile.prenom || '';
    document.getElementById('date_naissance').value = formatDateForInput(profile.date_naissance);
    document.getElementById('nationalite').value = profile.nationalite || '';
    document.getElementById('genre').value = profile.genre || '';
    document.getElementById('telephone').value = profile.telephone || '';
    document.getElementById('emploi').value = profile.emploi || '';
    document.getElementById('mandat_actif').value = profile.mandat_actif ? 'true' : 'false';

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
        mandat_actif: profile.mandat_actif,
        photo: profile.photo || ''
    };

    // Désactiver les champs par défaut (mode consultation)
    disableFormFields();

    // Tout le monde peut éditer
    document.getElementById('edit-mode-btn').style.display = 'block';

    // Seuls les superadmins peuvent supprimer
    if (currentUserInfo && currentUserInfo.isSupervisor) {
        // Le bouton delete sera affiché en mode édition
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

    // Désactiver les champs
    disableFormFields();
}

// Fonction pour annuler les modifications
function cancelEdit() {
    // Restaurer les données originales
    document.getElementById('nom').value = originalData.nom;
    document.getElementById('prenom').value = originalData.prenom;
    document.getElementById('date_naissance').value = originalData.date_naissance;
    document.getElementById('nationalite').value = originalData.nationalite;
    document.getElementById('genre').value = originalData.genre;
    document.getElementById('telephone').value = originalData.telephone;
    document.getElementById('emploi').value = originalData.emploi;
    document.getElementById('mandat_actif').value = originalData.mandat_actif ? 'true' : 'false';

    updatePhotoPreview(originalData.photo);

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
            mandat_actif: document.getElementById('mandat_actif').value === 'true',
            photo: document.getElementById('photo_preview').src || ''
        };

        // Validation des champs obligatoires
        if (!formData.nom || !formData.prenom || !formData.date_naissance || !formData.nationalite || !formData.genre) {
            showAnimation('error', 'Veuillez remplir tous les champs obligatoires');
            return;
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

    const confirmed = confirm(
        `Êtes-vous sûr de vouloir supprimer le citoyen ${prenom} ${nom} ?\n\nCette action est irréversible.`
    );

    if (!confirmed) return;

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
    const modal = document.getElementById('photoModal');
    const photoUrlInput = document.getElementById('photoUrlInput');
    const photoPreviewModal = document.getElementById('photoPreviewModal');
    const savePhotoBtn = document.getElementById('savePhotoBtn');
    const cancelPhotoBtn = document.getElementById('cancelPhotoBtn');

    // Clic sur la photo pour ouvrir le modal en mode édition
    photoContainer.addEventListener('click', () => {
        if (!isEditMode && !document.body.classList.contains('edit-mode')) return;

        const previewEl = document.getElementById('photo_preview');
        const currentSrc = previewEl ? (previewEl.getAttribute('src') || '').trim() : '';

        photoUrlInput.value = currentSrc || '';
        updatePhotoPreviewModal();
        modal.style.display = 'flex';
    });

    // Aperçu en temps réel dans le modal
    photoUrlInput.addEventListener('input', updatePhotoPreviewModal);

    function updatePhotoPreviewModal() {
        const url = photoUrlInput.value.trim();
        if (url) {
            photoPreviewModal.src = url;
            photoPreviewModal.style.display = 'block';
        } else {
            photoPreviewModal.style.display = 'none';
        }
    }

    // Sauvegarder la photo
    savePhotoBtn.addEventListener('click', () => {
        const url = photoUrlInput.value.trim();
        updatePhotoPreview(url);
        modal.style.display = 'none';
    });

    // Fermer le modal
    cancelPhotoBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Fermer le modal en cliquant sur l'overlay
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
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

        vehiculesListEl.innerHTML = '';
        vehicules.forEach(vehicule => {
            const item = document.createElement('div');
            item.className = 'equipment-item';
            item.style.cursor = 'pointer';
            item.style.transition = 'all 0.3s ease';

            const mandatBadge = vehicule.mandat_actif
                ? '<span style="color: #e74c3c; font-weight: 600; margin-left: 8px;">⚠️ MANDAT</span>'
                : '';

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

            vehiculesListEl.appendChild(item);
        });

    } catch (error) {
        console.error('Erreur chargement véhicules:', error);
        vehiculesListEl.innerHTML = '<p style="color: #e74c3c; font-size: 14px;">Erreur de chargement</p>';
    }
}

// Formatage automatique du téléphone
function setupPhoneFormatting() {
    const telephoneInput = document.getElementById('telephone');
    if (telephoneInput) {
        telephoneInput.addEventListener('input', function (e) {
            let cursorPos = this.selectionStart;
            let value = this.value.replace(/\D/g, '');
            const oldLength = this.value.length;

            if (value.length > 10) value = value.slice(0, 10);

            let formatted = '';
            if (value.length > 0) {
                formatted = '(';
                formatted += value.substring(0, 3);
                if (value.length >= 4) {
                    formatted += ') ' + value.substring(3, 6);
                }
                if (value.length >= 7) {
                    formatted += '-' + value.substring(6, 10);
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
        telephoneInput.setAttribute('maxlength', '14');
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

        // Boutons d'action
        document.getElementById('edit-mode-btn').addEventListener('click', activateEditMode);
        document.getElementById('cancel-edit-btn').addEventListener('click', cancelEdit);
        document.getElementById('profileForm').addEventListener('submit', saveProfile);
        document.getElementById('delete-btn').addEventListener('click', deleteCitoyen);
        document.getElementById('backlinkBtn').addEventListener('click', () => {
            window.history.back();
        });

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
