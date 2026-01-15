document.addEventListener("DOMContentLoaded", () => {
    // Initialisation des dates
    const now = new Date();
    const formatterDate = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' });
    const formatterTime = new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris', hour12: false, hour: '2-digit', minute: '2-digit'
    });

    const dateInput = document.getElementById("date");
    if (dateInput) dateInput.value = formatterDate.format(now);

    const heureInput = document.getElementById("heure");
    if (heureInput) {
        const heureParts = formatterTime.formatToParts(now);
        const heure = heureParts.filter(p => p.type === 'hour' || p.type === 'minute')
            .map(p => p.value.padStart(2, '0'))
            .join(':');
        heureInput.value = heure;
    }

    // Chargement de l'utilisateur courant
    fetch("/api/user")
        .then((res) => res.json())
        .then((user) => {
            document.getElementById("officier").value = user.username;
            document.getElementById("grade").value = user.grade;
        })
        .catch((err) => {
            console.error("Erreur chargement utilisateur :", err);
            document.getElementById("officier").value = "Erreur de chargement";
        });

    // Gestion de l'affichage du nom de l'avocat
    const avocatCheckbox = document.getElementById("avocat_intervention");
    const avocatPut = document.getElementById("avocatPut");

    if (avocatCheckbox && avocatPut) {
        avocatCheckbox.addEventListener("change", () => {
            if (avocatCheckbox.checked) {
                if (!document.getElementById("nom_avocat_container")) {
                    const div = document.createElement("div");
                    div.id = "nom_avocat_container";
                    div.innerHTML = `
                        <label for="nom_avocat">Nom de l'avocat</label>
                        <input type="text" id="nom_avocat" name="nom_avocat" placeholder="Nom de l'avocat" required />
                    `;
                    avocatPut.appendChild(div);
                }
            } else {
                const container = document.getElementById("nom_avocat_container");
                if (container) {
                    container.remove();
                }
            }
        });
    }

    // --- Initialisation des sélecteurs ---

    // Variables pour stocker les sélections multiples
    let selectedCivils = [];
    let selectedSuspects = [];

    // Helper pour ajouter un citoyen à une liste
    function addCitoyenToList(citoyenId, citoyenName, citoyen, listId, hiddenInputId, selectedArray) {
        // Vérifier si déjà présent
        if (selectedArray.find(c => c.id === citoyenId)) {
            showNotification('Ce citoyen est déjà dans la liste', 'warning');
            return;
        }

        // Ajouter à la liste
        selectedArray.push({ id: citoyenId, nom: citoyen.nom, prenom: citoyen.prenom, date_naissance: citoyen.date_naissance });

        // Mettre à jour l'affichage
        updateCitoyenListDisplay(listId, hiddenInputId, selectedArray);
    }

    // Helper pour retirer un citoyen d'une liste
    function removeCitoyenFromList(index, listId, hiddenInputId, selectedArray) {
        selectedArray.splice(index, 1);
        updateCitoyenListDisplay(listId, hiddenInputId, selectedArray);
    }

    // Helper pour mettre à jour l'affichage et le champ caché
    function updateCitoyenListDisplay(listId, hiddenInputId, selectedArray) {
        const container = document.getElementById(listId);
        const input = document.getElementById(hiddenInputId);

        container.innerHTML = '';
        selectedArray.forEach((citoyen, index) => {
            const tag = document.createElement('div');
            tag.className = 'selected-item';
            tag.innerHTML = `
                <span>${citoyen.prenom} ${citoyen.nom}</span>
                <span class="remove-btn" onclick="removeCitoyen${listId}(${index})">&times;</span>
            `;
            container.appendChild(tag);
        });

        // Mettre à jour le champ caché avec le JSON
        input.value = JSON.stringify(selectedArray);
    }

    // Fonctions globales pour les boutons de suppression
    window.removeCitoyenselectedCivils = function(index) {
        removeCitoyenFromList(index, 'selectedCivils', 'civils_impliques', selectedCivils);
    };

    window.removeCitoyenselectedSuspects = function(index) {
        removeCitoyenFromList(index, 'selectedSuspects', 'suspects_impliques', selectedSuspects);
    };

    // 1. Agents Impliqués (garde GenericSelectorModal pour les officiers)
    new GenericSelectorModal({
        triggerBtnId: 'addAgentBtn',
        containerId: 'selectedAgents',
        hiddenInputId: 'agents_impliques',
        modalTitle: 'Sélectionner un agent',
        searchPlaceholder: 'Rechercher un agent (nom, matricule)...',
        apiEndpoint: '/api/officers',
        itemLabelKey: (item) => {
            const name = item.displayName || item.name || 'Inconnu';
            return `${item.grade ? item.grade + ' ' : ''}${name}`;
        },
        itemValueKey: 'id',
        renderItem: (item) => {
            const name = item.displayName || item.name || 'Inconnu';
            return `${item.grade ? item.grade + ' ' : ''}${name}`;
        },
        transformData: (data) => data // L'API renvoie directement un tableau
    });

    // 2. Civils Impliqués - utilise le nouveau sélecteur de citoyens
    const addCivilBtn = document.getElementById('addCivilBtn');
    if (addCivilBtn) {
        addCivilBtn.addEventListener('click', () => {
            if (citoyenSelectorNoClear) {
                citoyenSelectorNoClear.open((id, name, citoyen) => {
                    if (id && name && citoyen) {
                        addCitoyenToList(id, name, citoyen, 'selectedCivils', 'civils_impliques', selectedCivils);
                    }
                });
            }
        });
    }

    // 3. Suspects Impliqués - utilise le nouveau sélecteur de citoyens
    const addSuspectBtn = document.getElementById('addSuspectBtn');
    if (addSuspectBtn) {
        addSuspectBtn.addEventListener('click', () => {
            if (citoyenSelectorNoClear) {
                citoyenSelectorNoClear.open((id, name, citoyen) => {
                    if (id && name && citoyen) {
                        addCitoyenToList(id, name, citoyen, 'selectedSuspects', 'suspects_impliques', selectedSuspects);
                    }
                });
            }
        });
    }

    // 4. Calcul de Peine (Optionnel)
    const selectCalculBtn = document.getElementById('selectCalculPeineBtn');
    if (selectCalculBtn) {
        selectCalculBtn.addEventListener('click', () => {
            GenericSelector.open({
                type: 'custom',
                apiEndpoint: '/api/calcul-peine',
                title: 'Sélectionner un calcul de peine',
                searchPlaceholder: 'Rechercher par nom de citoyen...',
                renderItem: (item) => {
                    const date = new Date(item.date).toLocaleDateString('fr-FR');
                    const name = item.nom ? `${item.nom} ${item.prenom}` : 'Inconnu';
                    return `
                        <div style="display:flex; justify-content:space-between; width:100%;">
                            <span>${date} - ${name}</span>
                            <span>${item.total_peine} / $${item.total_amende}</span>
                        </div>
                    `;
                },
                onSelect: (item) => {
                    const display = document.getElementById('selectedCalculDisplay');
                    const input = document.getElementById('calcul_peine_id');
                    
                    display.innerHTML = `
                        <div class="selected-item">
                            <span>Calcul du ${new Date(item.date).toLocaleDateString()} - ${item.nom} ${item.prenom}</span>
                            <span type="button" class="remove-btn" onclick="removeCalculPeine()">×</button>
                        </div>
                    `;
                    input.value = item.id;

                    // Auto-fill suspect if present
                    if (item.citizen_id) {
                        const suspectsInput = document.getElementById('suspects_impliques');
                        let currentSuspects = suspectsInput.value ? JSON.parse(suspectsInput.value) : [];
                        
                        // Check if already added (by ID)
                        const alreadyAdded = currentSuspects.some(s => s.id == item.citizen_id);
                        
                        if (!alreadyAdded) {
                            // Manually add to suspect selector (no confirmation)
                            suspectSelector.addItem({
                                id: item.citizen_id,
                                nom: item.nom,
                                prenom: item.prenom,
                                date_naissance: item.date_naissance || '?'
                            });
                        }
                    }
                }
            });
        });
    }

    window.removeCalculPeine = function() {
        document.getElementById('selectedCalculDisplay').innerHTML = '';
        document.getElementById('calcul_peine_id').value = '';
    };


    // --- Gestion des images ---
    
    // Preview pour l'URL de l'image des charges
    const chargesUrlInput = document.getElementById('charges_image_url');
    const chargesPreview = document.getElementById('chargesPreview');
    
    if (chargesUrlInput) {
        chargesUrlInput.addEventListener('input', function() {
            const url = this.value.trim();
            chargesPreview.innerHTML = '';
            if (url) {
                const img = document.createElement('img');
                img.src = url;
                img.alt = "Aperçu des charges";
                img.onerror = () => { img.style.display = 'none'; }; // Cacher si lien invalide
                chargesPreview.appendChild(img);
            }
        });
    }

    // Preview pour les fichiers uploadés (Photos/Preuves)
    let attachedFiles = [];
    const piecesInput = document.getElementById('pieces');
    const attachmentsPreview = document.getElementById('attachmentsPreview');

    if (piecesInput) {
        piecesInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            attachedFiles = [...attachedFiles, ...files];
            renderAttachmentsPreview();
            // Reset input value to allow selecting the same file again if needed
            piecesInput.value = ''; 
        });
    }

    function renderAttachmentsPreview() {
        attachmentsPreview.innerHTML = '';
        attachedFiles.forEach((file, index) => {
            if (!file.type.startsWith('image/')) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'preview-wrapper';
                wrapper.style.position = 'relative';
                wrapper.style.display = 'inline-block';

                const img = document.createElement('img');
                img.src = e.target.result;
                img.style.height = '100px';
                img.style.margin = '5px';

                const removeBtn = document.createElement('span');
                removeBtn.className = 'remove-image';
                removeBtn.textContent = '×';
                removeBtn.style.position = 'absolute';
                removeBtn.style.top = '5px';
                removeBtn.style.right = '5px';
                removeBtn.style.cursor = 'pointer';
                removeBtn.style.background = 'red';
                removeBtn.style.color = 'white';
                removeBtn.style.borderRadius = '50%';
                removeBtn.style.width = '20px';
                removeBtn.style.height = '20px';
                removeBtn.style.textAlign = 'center';
                removeBtn.style.lineHeight = '20px';

                removeBtn.addEventListener('click', () => {
                    attachedFiles.splice(index, 1);
                    renderAttachmentsPreview();
                });

                wrapper.appendChild(img);
                wrapper.appendChild(removeBtn);
                attachmentsPreview.appendChild(wrapper);
            };
            reader.readAsDataURL(file);
        });
    }

    // Bouton retour
    const btn = document.getElementById('backlinkBtn');
    if (btn) {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = '/menu-rapports';
            }
        });
    }

    // --- Soumission ---
    document.querySelector(".send-button").addEventListener("click", async (e) => {
        e.preventDefault();
        const form = document.getElementById('arrestReportForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const loader = document.getElementById("loaderOverlay");
        loader.style.display = "flex";

        try {
            const formData = new FormData(form);
            
            // Gérer les fichiers "pieces"
            formData.delete('pieces');
            attachedFiles.forEach(file => {
                formData.append('pieces', file);
            });

            // Les champs hidden (agents_impliques, etc.) sont déjà dans le formData
            // car ils sont dans le form. GenericSelectorModal met à jour leur value (JSON string).

            const res = await fetch("/api/rapport-arrestation", {
                method: "POST",
                body: formData,
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Erreur lors de la soumission.");

            showNotification("Rapport envoyé avec succès !", 'success');
            setTimeout(() => {
                window.location.href = '/menu-rapports';
            }, 2000);

        } catch (err) {
            console.error(err);
            showNotification("Erreur : " + err.message, 'error');
        } finally {
            loader.style.display = 'none';
        }
    });
});
