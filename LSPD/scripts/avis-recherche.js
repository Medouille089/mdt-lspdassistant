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

    // Gestion de l'affichage conditionnel selon le type d'avis
    const typeAvisSelect = document.getElementById('typeAvis');
    const champsDisparu = document.getElementById('champsDisparu');
    const champsMostWanted = document.getElementById('champsMostWanted');

    if (typeAvisSelect) {
        typeAvisSelect.addEventListener('change', () => {
            const type = typeAvisSelect.value;
            
            // Cacher tous les champs conditionnels
            if (champsDisparu) champsDisparu.style.display = 'none';
            if (champsMostWanted) champsMostWanted.style.display = 'none';
            
            // Afficher les champs selon le type
            if (type === 'disparu' && champsDisparu) {
                champsDisparu.style.display = 'block';
            } else if (type === 'most_wanted' && champsMostWanted) {
                champsMostWanted.style.display = 'block';
            }
        });
    }

    // Sélecteur de citoyen - Les éléments sont récupérés directement dans les callbacks pour éviter les null

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
                    // Récupérer les éléments directement pour éviter les erreurs de null
                    const nonRecense = document.getElementById('non_recense');
                    const champsNonRecenseDiv = document.getElementById('champsNonRecense');
                    const personne = document.getElementById('personne');
                    const personneId = document.getElementById('personne_id');
                    const citoyenId = document.getElementById('citoyen_id');
                    const citoyenNom = document.getElementById('citoyen_nom');
                    const citoyenPrenom = document.getElementById('citoyen_prenom');
                    
                    // Réinitialiser le mode non recensé
                    if (nonRecense) nonRecense.value = 'false';
                    if (champsNonRecenseDiv) champsNonRecenseDiv.style.display = 'none';
                    
                    // Mettre à jour les inputs visibles
                    if (personne) personne.value = `${item.prenom} ${item.nom}`;
                    if (personneId) personneId.value = item.id;
                    
                    // Mettre à jour les inputs cachés
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
            // Récupérer les éléments directement
            const nonRecense = document.getElementById('non_recense');
            const champsNonRecenseDiv = document.getElementById('champsNonRecense');
            const personne = document.getElementById('personne');
            const personneId = document.getElementById('personne_id');
            const citoyenId = document.getElementById('citoyen_id');
            const citoyenNom = document.getElementById('citoyen_nom');
            const citoyenPrenom = document.getElementById('citoyen_prenom');
            
            // Activer le mode non recensé
            if (nonRecense) nonRecense.value = 'true';
            if (champsNonRecenseDiv) champsNonRecenseDiv.style.display = 'block';
            
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

        const isNonRecense = nonRecenseInput.value === 'true';
        const citoyenId = citoyenIdInput.value;
        
        // Validation de la personne
        if (!isNonRecense && !citoyenId) {
            showNotification('Veuillez sélectionner une personne recherchée', 'warning');
            return;
        }
        
        // Si non recensé, vérifier les champs manuels
        if (isNonRecense) {
            const nomManuel = document.getElementById('nomManuel').value.trim();
            const prenomManuel = document.getElementById('prenomManuel').value.trim();
            if (!nomManuel || !prenomManuel) {
                showNotification('Veuillez saisir le nom et prénom de la personne', 'warning');
                return;
            }
        }

        const typeAvis = document.getElementById('typeAvis').value;
        if (!typeAvis) {
            showNotification('Veuillez sélectionner un type d\'avis', 'warning');
            return;
        }

        // Validation spécifique au type
        if (typeAvis === 'most_wanted') {
            const faits = document.getElementById('faitsReproches').value;
            if (!faits.trim()) {
                showNotification('Veuillez saisir les faits reprochés', 'warning');
                return;
            }
        }

        const loader = document.getElementById('loaderOverlay');
        loader.style.display = 'flex';

        // Construire les données selon le type d'avis
        const data = {
            citoyen_id: isNonRecense ? null : citoyenId,
            citoyen_nom: isNonRecense ? document.getElementById('nomManuel').value : citoyenNomInput.value,
            citoyen_prenom: isNonRecense ? document.getElementById('prenomManuel').value : citoyenPrenomInput.value,
            non_recense: isNonRecense,
            type_avis: typeAvis,
            alias: document.getElementById('alias').value,
            photo: document.getElementById('photoUrl').value,
            officier: document.getElementById('officier').value,
            grade: document.getElementById('grade').value
        };

        // Ajouter les champs spécifiques au type
        if (typeAvis === 'disparu') {
            data.derniere_localisation = document.getElementById('derniereLocalisation').value;
            data.infractions_reprochees = document.getElementById('infractionsReprochees').value;
            data.niveau_dangerosite = document.getElementById('niveauDangerosite').value;
        } else if (typeAvis === 'most_wanted') {
            data.recompense = document.getElementById('recompense').value;
            data.faits_reproches = document.getElementById('faitsReproches').value;
            data.avertissement = document.getElementById('avertissement').value;
        }

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
                    window.location.href = '/menu-mdt';
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
