// Client-side script for arme.html
document.addEventListener('DOMContentLoaded', async () => {
    const modelSelect = document.getElementById('model_select');
    // Ancienne recherche propriétaire supprimée
    const submitBtn = document.getElementById('submitWeapon');
    const serialInput = document.getElementById('serial_number');
    const loader = document.getElementById('loaderOverlay');

    // Load weapon models
    try {
        const res = await fetch('/api/weapon_models');
        if (res.ok) {
            const data = await res.json();
            (data.models || []).forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.model_name;
                modelSelect.appendChild(opt);
            });
        }
    } catch (e) {
        console.error('Erreur chargement modèles armes', e);
    }

    // Ancienne recherche propriétaire supprimée

    document.getElementById('armeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const modelId = modelSelect.value;
        const serial = serialInput.value.trim();
        const ownerId = proprietaireIdInput.value || null;

        if (!modelId || !serial) {
            showNotification('Veuillez choisir un modèle et saisir le numéro de série', 'error');
            return;
        }

        loader.style.display = 'flex';
        try {
            const res = await fetch('/api/weapons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model_id: modelId, serial_number: serial, owner_id: ownerId })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erreur serveur');
            }
            const data = await res.json();
            showNotification('Arme enregistrée', 'success');
            setTimeout(() => { window.location.href = `/view-citoyen.html?id=${ownerId || ''}`; }, 800);
        } catch (e) {
            console.error('Erreur enregistrement arme', e);
            showNotification(e.message || 'Erreur lors de l\'enregistrement', 'error');
        } finally {
            loader.style.display = 'none';
        }
    });

    // Back link
    document.getElementById('backlinkBtn').addEventListener('click', () => {
        window.history.back();
    });

    // Ajout du popup citoyen
    const selectProprietaireBtn = document.getElementById('selectProprietaireBtn');
    const proprietaireInput = document.getElementById('proprietaire');
    const proprietaireIdInput = document.getElementById('proprietaire_id');

    let citoyenSelector = null;

    if (selectProprietaireBtn) {
        selectProprietaireBtn.addEventListener('click', async () => {
            if (!citoyenSelector) {
                citoyenSelector = new CitoyenSelectorModal();
                await citoyenSelector.init();
            }
            citoyenSelector.onSelectCallback = (id, name) => {
                proprietaireInput.value = name || '';
                proprietaireIdInput.value = id || '';
            };
            citoyenSelector.modal.style.display = 'flex';
        });
    }
});
