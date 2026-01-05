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
                allowUnregistered: true,
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
                    const citoyenDdn = document.getElementById('citoyen_ddn');
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
                    if (citoyenDdn) citoyenDdn.value = item.date_naissance || '';

                    // Pré-remplir la photo si disponible
                    const photoUrl = document.getElementById('photoUrl');
                    if (item.photo && photoUrl && !photoUrl.value) {
                        photoUrl.value = item.photo;
                        updatePhotoPreview(item.photo);
                    }
                },
                onUnregistered: () => {
                    const personne = document.getElementById('personne');
                    const personneId = document.getElementById('personne_id');
                    const citoyenId = document.getElementById('citoyen_id');
                    const citoyenNom = document.getElementById('citoyen_nom');
                    const citoyenPrenom = document.getElementById('citoyen_prenom');
                    const citoyenDdn = document.getElementById('citoyen_ddn');
                    const nonRecense = document.getElementById('non_recense');
                    const champsNonRecense = document.getElementById('champsNonRecense');
                    
                    // Activer le mode non recensé
                    if (nonRecense) nonRecense.value = 'true';
                    if (champsNonRecense) champsNonRecense.style.display = 'block';
                    
                    // Réinitialiser les champs citoyen
                    if (personne) personne.value = 'Personne non recensée';
                    if (personneId) personneId.value = '';
                    if (citoyenId) citoyenId.value = '';
                    if (citoyenNom) citoyenNom.value = '';
                    if (citoyenPrenom) citoyenPrenom.value = '';
                    if (citoyenDdn) citoyenDdn.value = '';
                    
                    // Focus sur le champ nom
                    const nomManuel = document.getElementById('nomManuel');
                    if (nomManuel) nomManuel.focus();
                }
            });
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
            
            // Si non recensé, vérifier l'alias
            if (isNonRecense) {
                const aliasManuel = document.getElementById('aliasManuel')?.value?.trim();
                if (!aliasManuel) {
                    showNotification('Veuillez saisir un alias ou surnom pour cette personne', 'warning');
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

            // Récupérer les valeurs des champs cachés
            const citoyenNomValue = document.getElementById('citoyen_nom')?.value;
            const citoyenPrenomValue = document.getElementById('citoyen_prenom')?.value;
            
            console.log('Valeurs citoyen:', { citoyenNomValue, citoyenPrenomValue, isNonRecense });

            const data = {
                citoyen_id: isNonRecense ? null : citoyenId,
                citoyen_nom: isNonRecense ? null : citoyenNomValue,
                citoyen_prenom: isNonRecense ? null : citoyenPrenomValue,
                date_naissance: isNonRecense ? null : document.getElementById('citoyen_ddn')?.value,
                non_recense: isNonRecense,
                alias: isNonRecense ? document.getElementById('aliasManuel')?.value : null,
                type_avis: typeAvis,
                motif: motif,
                description: document.getElementById('description')?.value,
                particularites: document.getElementById('particularites')?.value,
                recompense: document.getElementById('recompense')?.value,
                photo: document.getElementById('photoUrl')?.value,
                officier: document.getElementById('officier')?.value,
                grade: document.getElementById('grade')?.value
            };
            
            console.log('Data envoyé:', data);

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
                    
                    // Générer l'image
                    await generateAvisImage(data);
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

    // Fonction pour générer l'image d'avis de recherche
    async function generateAvisImage(data) {
        const template = document.getElementById('avisCard');
        
        // Nom complet - si non recensé, utiliser l'alias, sinon nom prénom
        let nomComplet;
        if (data.non_recense) {
            nomComplet = data.alias || 'Identité inconnue';
        } else {
            const prenom = data.citoyen_prenom || '';
            const nom = data.citoyen_nom || '';
            nomComplet = `${prenom} ${nom}`.trim();
            if (data.alias) {
                nomComplet += ` (${data.alias})`;
            }
            if (!nomComplet) {
                nomComplet = 'Identité inconnue';
            }
        }
        
        console.log('Nom complet généré:', nomComplet);
        const nomCompletEl = document.getElementById('tpl-nom-complet');
        console.log('Element tpl-nom-complet:', nomCompletEl);
        
        if (nomCompletEl) {
            nomCompletEl.textContent = nomComplet;
            console.log('Nom assigné au template');
        } else {
            console.error('Element tpl-nom-complet non trouvé !');
        }
        
        // Date de naissance (uniquement pour les personnes recensées)
        const ddnLine = document.getElementById('tpl-ddn-line');
        if (ddnLine) {
            if (data.date_naissance && !data.non_recense) {
                const ddn = new Date(data.date_naissance);
                ddnLine.textContent = `Né(e) le ${ddn.toLocaleDateString('fr-FR')}`;
                ddnLine.style.display = 'block';
            } else {
                ddnLine.style.display = 'none';
            }
        }
        
        // Watermark selon le type
        const watermark = document.getElementById('tpl-watermark');
        if (data.type_avis === 'disparu') {
            watermark.textContent = 'DISPARU';
            watermark.style.color = 'rgba(52, 152, 219, 0.5)';
        } else {
            watermark.textContent = 'WANTED';
            watermark.style.color = 'rgba(192, 57, 43, 0.5)';
        }
        
        // Motifs en liste à puces
        const motifList = document.getElementById('tpl-motif-list');
        const motifLines = data.motif.split('\n').filter(line => line.trim());
        motifList.innerHTML = motifLines.map(line => 
            `<div style="font-size: 36px; color: #333; margin-bottom: 18px;">• ${line.trim()}</div>`
        ).join('');
        
        // Particularités physiques
        const particularitesBlock = document.getElementById('tpl-particularites-block');
        if (particularitesBlock) {
            if (data.particularites && data.particularites.trim()) {
                particularitesBlock.innerHTML = `<span style="font-weight: bold; color: #0b1b5a;">Particularités physiques :</span> ${data.particularites}`;
                particularitesBlock.style.display = 'block';
            } else {
                particularitesBlock.style.display = 'none';
            }
        }
        
        // Description / Avertissement
        const descBlock = document.getElementById('tpl-description-block');
        if (data.description) {
            descBlock.textContent = data.description;
            descBlock.style.display = 'block';
        } else {
            descBlock.style.display = 'none';
        }
        
        // Récompense sous le nom
        const recompenseLine = document.getElementById('tpl-recompense-line');
        if (data.recompense && recompenseLine) {
            recompenseLine.textContent = `Récompense : ${data.recompense} $`;
            recompenseLine.style.display = 'block';
        } else if (recompenseLine) {
            recompenseLine.style.display = 'none';
        }
        
        // Photo
        const photoEl = document.getElementById('tpl-photo');
        const noPhotoEl = document.getElementById('tpl-no-photo');
        if (data.photo) {
            photoEl.src = data.photo;
            photoEl.style.display = 'block';
            noPhotoEl.style.display = 'none';
        } else {
            photoEl.style.display = 'none';
            noPhotoEl.style.display = 'flex';
        }
        
        // Date
        const now = new Date();
        document.getElementById('tpl-date').textContent = now.toLocaleDateString('fr-FR', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric'
        });
        
        // Attendre que les images soient chargées
        const allImages = template.querySelectorAll('img');
        await Promise.all(Array.from(allImages).map(img => {
            return new Promise((resolve) => {
                if (img.complete) {
                    resolve();
                } else {
                    img.onload = resolve;
                    img.onerror = resolve;
                }
            });
        }));
        
        // Attendre que le DOM se mette à jour
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Forcer un reflow du template
        template.offsetHeight;
        
        console.log('Contenu tpl-nom-complet avant capture:', document.getElementById('tpl-nom-complet').textContent);
        
        // Générer l'image avec html2canvas (taille exacte 1800x2700)
        try {
            const canvas = await html2canvas(template, {
                scale: 1,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                width: 1800,
                height: 2700
            });
            
            const imageUrl = canvas.toDataURL('image/png');
            
            // Afficher la modal avec l'image
            const modal = document.getElementById('imageResultModal');
            const generatedImg = document.getElementById('generatedImage');
            generatedImg.src = imageUrl;
            modal.style.display = 'flex';
            
            // Bouton télécharger
            document.getElementById('downloadImageBtn').onclick = () => {
                const link = document.createElement('a');
                link.download = `avis-recherche-${data.citoyen_nom}-${data.citoyen_prenom}.png`;
                link.href = imageUrl;
                link.click();
            };
            
            // Bouton copier
            document.getElementById('copyImageBtn').onclick = async () => {
                try {
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    showNotification('Image copiée dans le presse-papier !', 'success');
                } catch (err) {
                    console.error('Erreur copie:', err);
                    showNotification('Impossible de copier l\'image', 'error');
                }
            };
            
            // Bouton fermer
            document.getElementById('closeImageModal').onclick = () => {
                modal.style.display = 'none';
                window.location.href = '/menu-mdt';
            };
            
            // Fermer en cliquant à l'extérieur
            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                    window.location.href = '/menu-mdt';
                }
            };
            
        } catch (err) {
            console.error('Erreur génération image:', err);
            showNotification('Erreur lors de la génération de l\'image', 'error');
            setTimeout(() => {
                window.location.href = '/menu-mdt';
            }, 1500);
        }
    }
});
