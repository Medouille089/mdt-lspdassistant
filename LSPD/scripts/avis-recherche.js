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

    // Bouton "Choisir" - ouvrir le sélecteur
    const selectPersonneBtn = document.getElementById('selectPersonneBtn');
    if (selectPersonneBtn) {
        selectPersonneBtn.addEventListener('click', () => {
            GenericSelector.open({
                type: 'citizen',
                apiEndpoint: '/api/citoyens?limit=100',
                title: 'Sélectionner une personne',
                searchPlaceholder: 'Rechercher par nom ou prénom...',
                renderItem: (item) => {
                    const photo = item.photo ? `<img src="${item.photo}" style="width:30px;height:30px;border-radius:50%;margin-right:10px;object-fit:cover;">` : '<span style="width:30px;height:30px;border-radius:50%;margin-right:10px;background:#ccc;display:inline-block;"></span>';
                    return `<div style="display:flex;align-items:center;">${photo}<span>${item.prenom} ${item.nom}</span></div>`;
                },
                onSelect: (item) => {
                    const personne = document.getElementById('personne');
                    const personneId = document.getElementById('personne_id');
                    const citoyenId = document.getElementById('citoyen_id');
                    const citoyenNom = document.getElementById('citoyen_nom');
                    const citoyenPrenom = document.getElementById('citoyen_prenom');
                    const nonRecense = document.getElementById('non_recense');
                    const champsNonRecense = document.getElementById('champsNonRecense');
                    
                    // Désactiver le mode non recensé
                    if (nonRecense) nonRecense.value = 'false';
                    if (champsNonRecense) champsNonRecense.style.display = 'none';
                    
                    if (personne) personne.value = `${item.prenom} ${item.nom}`;
                    if (personneId) personneId.value = item.id;
                    if (citoyenId) citoyenId.value = item.id;
                    if (citoyenNom) citoyenNom.value = item.nom;
                    if (citoyenPrenom) citoyenPrenom.value = item.prenom;

                    // Pré-remplir la photo si disponible
                    const photoUrl = document.getElementById('photoUrl');
                    if (item.photo && photoUrl && !photoUrl.value) {
                        photoUrl.value = item.photo;
                        updatePhotoPreview(item.photo);
                    }
                }
            });
        });
    }

    // Bouton "Non recensé"
    const nonRecenseBtn = document.getElementById('nonRecenseBtn');
    if (nonRecenseBtn) {
        nonRecenseBtn.addEventListener('click', () => {
            const personne = document.getElementById('personne');
            const personneId = document.getElementById('personne_id');
            const citoyenId = document.getElementById('citoyen_id');
            const citoyenNom = document.getElementById('citoyen_nom');
            const citoyenPrenom = document.getElementById('citoyen_prenom');
            const nonRecense = document.getElementById('non_recense');
            const champsNonRecense = document.getElementById('champsNonRecense');
            
            // Activer le mode non recensé
            if (nonRecense) nonRecense.value = 'true';
            if (champsNonRecense) champsNonRecense.style.display = 'block';
            
            // Réinitialiser les champs citoyen
            if (personne) personne.value = '⚠️ Personne non recensée';
            if (personneId) personneId.value = '';
            if (citoyenId) citoyenId.value = '';
            if (citoyenNom) citoyenNom.value = '';
            if (citoyenPrenom) citoyenPrenom.value = '';
            
            // Focus sur le champ nom
            const nomManuel = document.getElementById('nomManuel');
            if (nomManuel) nomManuel.focus();
        });
    }

    // Prévisualisation de la photo
    const photoUrlInput = document.getElementById('photoUrl');
    const photoPreview = document.getElementById('photoPreview');

    function updatePhotoPreview(url) {
        if (photoPreview && url) {
            photoPreview.src = url;
            photoPreview.style.display = 'block';
            photoPreview.onerror = () => {
                photoPreview.style.display = 'none';
            };
        } else if (photoPreview) {
            photoPreview.style.display = 'none';
        }
    }

    if (photoUrlInput) {
        photoUrlInput.addEventListener('input', (e) => {
            updatePhotoPreview(e.target.value);
        });
    }

    // Soumission du formulaire
    const form = document.getElementById('avisRechercheForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const citoyenId = document.getElementById('citoyen_id')?.value;
            const typeAvis = document.getElementById('typeAvis')?.value;
            const motif = document.getElementById('motif')?.value?.trim();
            const isNonRecense = document.getElementById('non_recense')?.value === 'true';
            
            // Validations
            if (!isNonRecense && !citoyenId) {
                showNotification('Veuillez sélectionner une personne recherchée', 'warning');
                return;
            }
            
            // Si non recensé, vérifier les champs manuels
            if (isNonRecense) {
                const nomManuel = document.getElementById('nomManuel')?.value?.trim();
                const prenomManuel = document.getElementById('prenomManuel')?.value?.trim();
                if (!nomManuel || !prenomManuel) {
                    showNotification('Veuillez saisir le nom et prénom de la personne', 'warning');
                    return;
                }
            }
            
            if (!typeAvis) {
                showNotification('Veuillez sélectionner un type d\'avis', 'warning');
                return;
            }
            
            if (!motif) {
                showNotification('Veuillez saisir le motif de la recherche', 'warning');
                return;
            }

            const loader = document.getElementById('loaderOverlay');
            if (loader) loader.style.display = 'flex';

            const data = {
                citoyen_id: isNonRecense ? null : citoyenId,
                citoyen_nom: isNonRecense ? document.getElementById('nomManuel')?.value : document.getElementById('citoyen_nom')?.value,
                citoyen_prenom: isNonRecense ? document.getElementById('prenomManuel')?.value : document.getElementById('citoyen_prenom')?.value,
                non_recense: isNonRecense,
                alias: isNonRecense ? document.getElementById('aliasManuel')?.value : null,
                type_avis: typeAvis,
                motif: motif,
                description: document.getElementById('description')?.value,
                recompense: document.getElementById('recompense')?.value,
                photo: document.getElementById('photoUrl')?.value,
                officier: document.getElementById('officier')?.value,
                grade: document.getElementById('grade')?.value
            };

            try {
                const res = await fetch('/api/avis-recherche', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await res.json();

                if (loader) loader.style.display = 'none';

                if (res.ok) {
                    showNotification('Avis de recherche publié avec succès !', 'success');
                    setTimeout(() => {
                        window.location.href = '/menu-mdt';
                    }, 1500);
                } else {
                    showNotification(result.error || 'Erreur lors de la publication', 'error');
                }
            } catch (err) {
                if (loader) loader.style.display = 'none';
                console.error('Erreur:', err);
                showNotification('Erreur lors de la publication', 'error');
            }
        });
    }
});
