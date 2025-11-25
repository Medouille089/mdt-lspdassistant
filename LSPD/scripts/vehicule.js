(function () {
    async function getCurrentUser() {
        try {
            const res = await fetch('/api/user');
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            return null;
        }
    }

    let selectedProprietaireId = null;

    function validateForm() {
        const modele = document.getElementById('modele').value.trim();
        const plaque = document.getElementById('plaque').value.trim();

        if (!modele) {
            showNotification('Le modèle du véhicule est requis', 'error');
            document.getElementById('modele').focus();
            return false;
        }

        if (!plaque) {
            showNotification('La plaque d\'immatriculation est requise', 'error');
            document.getElementById('plaque').focus();
            return false;
        }

        return true;
    }

    async function submitForm(event) {
        event.preventDefault();

        if (!validateForm()) {
            return;
        }

        const user = await getCurrentUser();
        if (!user || !user.username) {
            showNotification('Erreur: utilisateur non authentifié', 'error');
            return;
        }

        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Enregistrement en cours...';

        try {
            const formData = {
                modele: document.getElementById('modele').value.trim(),
                plaque: document.getElementById('plaque').value.trim().toUpperCase(),
                couleur: document.getElementById('couleur').value.trim() || null,
                proprietaire_id: selectedProprietaireId,
                mandat_actif: document.getElementById('mandat_actif').value === 'true',
                photo: document.getElementById('photo').value.trim() || null,
                created_by: user.username
            };

            const response = await fetch('/api/vehicules', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                showNotification('✓ Véhicule enregistré avec succès', 'success');
                setTimeout(() => {
                    window.location.href = '/liste-vehicules.html';
                }, 1500);
            } else {
                showNotification(result.error || 'Erreur lors de l\'enregistrement', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enregistrer le véhicule';
            }
        } catch (error) {
            console.error('Erreur lors de la soumission:', error);
            showNotification('Erreur de connexion au serveur', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enregistrer le véhicule';
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        const form = document.getElementById('vehiculeForm');
        const selectProprietaireBtn = document.getElementById('selectProprietaireBtn');
        const proprietaireInput = document.getElementById('proprietaire');
        form.addEventListener('submit', submitForm);

        selectProprietaireBtn.addEventListener('click', () => {
            if (citoyenSelector) {
                citoyenSelector.open((citoyenId, citoyenName) => {
                    if (citoyenId && citoyenName) {
                        selectedProprietaireId = citoyenId;
                        proprietaireInput.value = citoyenName;
                        document.getElementById('proprietaire_id').value = citoyenId;
                    } else {
                        selectedProprietaireId = null;
                        proprietaireInput.value = '';
                        document.getElementById('proprietaire_id').value = '';
                    }
                }, selectedProprietaireId);
            }
        });

        const plaqueInput = document.getElementById('plaque');
        plaqueInput.addEventListener('input', function (e) {
            e.target.value = e.target.value.toUpperCase();
        });
    });
})();
