document.addEventListener('DOMContentLoaded', async () => {
    // Charger les infos utilisateur
    try {
        const userRes = await fetch('/api/user');
        if (userRes.ok) {
            const user = await userRes.json();
            document.getElementById('officier').value = user.guild_member?.nick || user.displayName || user.username;
            document.getElementById('grade').value = user.grade || '';
        }
    } catch (err) {
        console.error('Erreur chargement utilisateur:', err);
    }

    // Sélecteur de citoyen
    const selectCitoyenBtn = document.getElementById('selectCitoyenBtn');
    const selectedCitoyenDiv = document.getElementById('selectedCitoyen');
    const citoyenIdInput = document.getElementById('citoyen_id');
    const citoyenNomInput = document.getElementById('citoyen_nom');
    const citoyenPrenomInput = document.getElementById('citoyen_prenom');

    // Initialiser le sélecteur de citoyen
    new GenericSelectorModal({
        triggerBtnId: 'selectCitoyenBtn',
        modalTitle: 'Sélectionner une personne',
        searchPlaceholder: 'Rechercher par nom ou prénom...',
        apiEndpoint: '/api/citoyens?limit=100',
        displayField: (item) => `${item.prenom} ${item.nom}`,
        valueField: 'id',
        renderItem: (item) => {
            const photo = item.photo ? `<img src="${item.photo}" style="width:30px;height:30px;border-radius:50%;margin-right:10px;object-fit:cover;">` : '<span style="width:30px;height:30px;border-radius:50%;margin-right:10px;background:#ccc;display:inline-block;"></span>';
            return `<div style="display:flex;align-items:center;">${photo}<span>${item.prenom} ${item.nom}</span></div>`;
        },
        transformData: (data) => data.citoyens || data || [],
        filterFn: (item, query) => {
            const q = query.toLowerCase();
            return item.nom.toLowerCase().includes(q) || item.prenom.toLowerCase().includes(q);
        },
        onSelect: (item) => {
            citoyenIdInput.value = item.id;
            citoyenNomInput.value = item.nom;
            citoyenPrenomInput.value = item.prenom;

            selectedCitoyenDiv.innerHTML = `
                <div class="selected-item" style="display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--main-color-light); border-radius: 8px; margin-top: 10px;">
                    ${item.photo ? `<img src="${item.photo}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">` : '<span style="width:40px;height:40px;border-radius:50%;background:#ccc;display:inline-block;"></span>'}
                    <span><strong>${item.prenom} ${item.nom}</strong></span>
                    <button type="button" class="remove-btn" style="margin-left: auto; background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">✕</button>
                </div>
            `;

            // Pré-remplir la photo si disponible
            if (item.photo && !document.getElementById('photoUrl').value) {
                document.getElementById('photoUrl').value = item.photo;
                updatePhotoPreview(item.photo);
            }

            selectedCitoyenDiv.querySelector('.remove-btn').addEventListener('click', () => {
                citoyenIdInput.value = '';
                citoyenNomInput.value = '';
                citoyenPrenomInput.value = '';
                selectedCitoyenDiv.innerHTML = '';
            });
        }
    });

    // Prévisualisation de la photo
    const photoUrlInput = document.getElementById('photoUrl');
    const photoPreview = document.getElementById('photoPreview');

    function updatePhotoPreview(url) {
        if (url) {
            photoPreview.src = url;
            photoPreview.style.display = 'block';
            photoPreview.onerror = () => {
                photoPreview.style.display = 'none';
            };
        } else {
            photoPreview.style.display = 'none';
        }
    }

    photoUrlInput.addEventListener('input', (e) => {
        updatePhotoPreview(e.target.value);
    });

    // Soumission du formulaire
    const form = document.getElementById('avisRechercheForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const citoyenId = citoyenIdInput.value;
        if (!citoyenId) {
            showNotification('Veuillez sélectionner une personne recherchée', 'warning');
            return;
        }

        const dangerosite = document.getElementById('dangerosite').value;
        if (!dangerosite) {
            showNotification('Veuillez sélectionner un niveau de dangerosité', 'warning');
            return;
        }

        const motif = document.getElementById('motif').value;
        if (!motif.trim()) {
            showNotification('Veuillez saisir un motif de recherche', 'warning');
            return;
        }

        const loader = document.getElementById('loaderOverlay');
        loader.style.display = 'flex';

        const data = {
            citoyen_id: citoyenId,
            citoyen_nom: citoyenNomInput.value,
            citoyen_prenom: citoyenPrenomInput.value,
            dangerosite: dangerosite,
            motif: motif,
            description: document.getElementById('description').value,
            recompense: document.getElementById('recompense').value,
            photo: document.getElementById('photoUrl').value,
            officier: document.getElementById('officier').value,
            grade: document.getElementById('grade').value
        };

        try {
            const res = await fetch('/api/avis-recherche', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await res.json();

            loader.style.display = 'none';

            if (res.ok) {
                showNotification('Avis de recherche publié avec succès !', 'success');
                setTimeout(() => {
                    window.location.href = '/liste-avis-recherche';
                }, 1500);
            } else {
                showNotification(result.error || 'Erreur lors de la publication', 'error');
            }
        } catch (err) {
            loader.style.display = 'none';
            console.error('Erreur:', err);
            showNotification('Erreur lors de la publication', 'error');
        }
    });
});
