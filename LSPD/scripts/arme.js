// Client-side script for arme.html
document.addEventListener('DOMContentLoaded', async () => {
    const modelSelectInput = document.getElementById('model_select');
    const submitBtn = document.getElementById('submitWeapon');
    const serialInput = document.getElementById('serial_number');
    const loader = document.getElementById('loaderOverlay');
    const calibreInput = document.getElementById('calibre');

    // Custom weapon select elements
    const selectContainer = document.getElementById('weaponSelectContainer');
    const selectTrigger = document.getElementById('weaponSelectTrigger');
    const selectDropdown = document.getElementById('weaponSelectDropdown');
    const selectOptions = document.getElementById('weaponSelectOptions');
    const searchInput = document.getElementById('weaponSearchInput');

    // Load weapon models
    let models = [];
    let selectedModelId = null;

    try {
        const res = await fetch('/api/weapon_models');
        if (res.ok) {
            const data = await res.json();
            models = data.models || [];
            renderWeaponOptions(models);
        }
    } catch (e) {
        console.error('Erreur chargement modèles armes', e);
    }

    // Render weapon options
    function renderWeaponOptions(filteredModels) {
        selectOptions.innerHTML = '';
        if (filteredModels.length === 0) {
            selectOptions.innerHTML = '<div class="custom-select-empty">Aucune arme trouvée</div>';
            return;
        }
        filteredModels.forEach(m => {
            const option = document.createElement('div');
            option.className = 'custom-select-option' + (selectedModelId == m.id ? ' selected' : '');
            option.dataset.id = m.id;
            option.dataset.calibre = m.calibre || '';
            option.innerHTML = `
                <img src="${m.image_url || '/data/images/weapon-placeholder.png'}" alt="${m.model_name}" onerror="this.src='/data/images/weapon-placeholder.png'">
                <div class="option-info">
                    <div class="option-name">${m.model_name}</div>
                    <div class="option-calibre">${m.calibre || 'Calibre inconnu'}</div>
                </div>
                <span class="option-check material-symbols-rounded">check</span>
            `;
            option.addEventListener('click', () => selectWeapon(m));
            selectOptions.appendChild(option);
        });
    }

    // Select a weapon
    function selectWeapon(model) {
        selectedModelId = model.id;
        modelSelectInput.value = model.id;
        calibreInput.value = model.calibre || '';

        selectTrigger.innerHTML = `
            <div class="selected-weapon">
                <img src="${model.image_url || '/data/images/weapon-placeholder.png'}" alt="${model.model_name}" onerror="this.src='/data/images/weapon-placeholder.png'">
                <span class="selected-weapon-name">${model.model_name}</span>
            </div>
        `;
        selectTrigger.innerHTML += '<span></span>'; // Arrow placeholder

        closeDropdown();
        renderWeaponOptions(models); // Update selected state
    }

    // Toggle dropdown
    function toggleDropdown() {
        const isOpen = selectDropdown.classList.contains('open');
        if (isOpen) {
            closeDropdown();
        } else {
            openDropdown();
        }
    }

    function openDropdown() {
        selectDropdown.classList.add('open');
        selectTrigger.classList.add('active');
        searchInput.focus();
    }

    function closeDropdown() {
        selectDropdown.classList.remove('open');
        selectTrigger.classList.remove('active');
        searchInput.value = '';
        renderWeaponOptions(models);
    }

    // Event listeners for custom select
    selectTrigger.addEventListener('click', toggleDropdown);

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtered = models.filter(m =>
            m.model_name.toLowerCase().includes(term) ||
            (m.calibre && m.calibre.toLowerCase().includes(term))
        );
        renderWeaponOptions(filtered);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!selectContainer.contains(e.target)) {
            closeDropdown();
        }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDropdown();
    });

    // Ancienne recherche propriétaire supprimée

    document.getElementById('armeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const modelId = modelSelectInput.value;
        const serial = serialInput.value.trim();
        const ownerId = proprietaireIdInput.value ? parseInt(proprietaireIdInput.value, 10) : null;
        const calibre = calibreInput.value.trim();

        if (!modelId || !serial || !calibre) {
            showNotification('Veuillez choisir un modèle, saisir le numéro de série et vérifier le calibre', 'error');
            return;
        }

        loader.style.display = 'flex';
        try {
            const res = await fetch('/api/weapons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model_id: modelId, serial_number: serial, owner_id: ownerId, calibre })
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
