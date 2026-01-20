document.addEventListener('DOMContentLoaded', async () => {
    let superviseur = null;
    let agents = [];
    let suspects = [];
    let rapports = [];
    let isEditMode = false;
    let editId = null;

    const form = document.getElementById('enqueteForm');
    const loaderOverlay = document.getElementById('loaderOverlay');

    // Bouton retour
    const backlinkBtn = document.getElementById('backlinkBtn');
    if (backlinkBtn) {
        backlinkBtn.addEventListener('click', () => {
            if (document.referrer && document.referrer.includes(window.location.host)) {
                window.history.back();
            } else {
                window.location.href = '/liste-rapports-enquete';
            }
        });
    }

    // ========== SÉLECTEUR DE SUPERVISEUR ==========
    const selectSuperviseurBtn = document.getElementById('selectSuperviseurBtn');
    const selectedSuperviseurContainer = document.getElementById('selectedSuperviseur');

    if (selectSuperviseurBtn) {
        selectSuperviseurBtn.addEventListener('click', () => {
            openGenericSelector({
                title: 'Sélectionner un superviseur',
                endpoint: '/api/officers',
                searchPlaceholder: 'Rechercher un agent...',
                displayField: (item) => `${item.displayName} - ${item.grade}`,
                onSelect: (selectedAgent) => {
                    superviseur = selectedAgent;
                    updateSuperviseurDisplay();
                }
            });
        });
    }

    function updateSuperviseurDisplay() {
        if (!superviseur) {
            selectedSuperviseurContainer.innerHTML = '';
            return;
        }

        const name = superviseur.displayName || 
                     (superviseur.prenom && superviseur.nom ? `${superviseur.prenom} ${superviseur.nom}` : superviseur.nom) || 
                     'Inconnu';
        const gradeStr = superviseur.grade ? ` - ${superviseur.grade}` : '';

        selectedSuperviseurContainer.innerHTML = `
            <div class="selected-item">
                <span>${name}${gradeStr}</span>
                <span class="remove-btn" onclick="window.removeSuperviseur()">&times;</span>
            </div>
        `;
    }

    window.removeSuperviseur = function() {
        superviseur = null;
        updateSuperviseurDisplay();
    };

    // ========== SÉLECTEUR D'AGENTS ==========
    const selectAgentsBtn = document.getElementById('selectAgentsBtn');
    const selectedAgentsContainer = document.getElementById('selectedAgents');

    if (selectAgentsBtn) {
        selectAgentsBtn.addEventListener('click', () => {
            openGenericSelector({
                title: 'Ajouter un agent à l\'enquête',
                endpoint: '/api/officers',
                searchPlaceholder: 'Rechercher un agent...',
                displayField: (item) => `${item.displayName} - ${item.grade}`,
                onSelect: (selectedAgent) => {
                    // Vérifier si l'agent n'est pas déjà ajouté
                    if (!agents.find(a => a.id === selectedAgent.id)) {
                        agents.push(selectedAgent);
                        updateAgentsDisplay();
                    } else {
                        showNotification('Cet agent est déjà assigné à l\'enquête', 'warning');
                    }
                }
            });
        });
    }

    function updateAgentsDisplay() {
        if (agents.length === 0) {
            selectedAgentsContainer.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;">Aucun agent assigné</p>';
            return;
        }

        selectedAgentsContainer.innerHTML = agents.map((agent, index) => {
            const name = agent.displayName || 
                         (agent.prenom && agent.nom ? `${agent.prenom} ${agent.nom}` : agent.nom) || 
                         'Inconnu';
            const gradeStr = agent.grade ? ` - ${agent.grade}` : '';
            return `
                <div class="selected-item">
                    <span>${name}${gradeStr}</span>
                    <span class="remove-btn" onclick="window.removeAgent(${index})">&times;</span>
                </div>
            `;
        }).join('');
    }

    window.removeAgent = function(index) {
        agents.splice(index, 1);
        updateAgentsDisplay();
    };

    // ========== SÉLECTEUR DE SUSPECTS ==========
    const selectSuspectsBtn = document.getElementById('selectSuspectsBtn');
    const selectedSuspectsContainer = document.getElementById('selectedSuspects');

    if (selectSuspectsBtn) {
        selectSuspectsBtn.addEventListener('click', () => {
            openCitoyenSelector((id, fullName, citoyen) => {
                if (id) {
                    // S'assurer que citoyen est bien l'objet complet
                    const citoyenObj = citoyen || { id, nom: fullName.split(' ').pop(), prenom: fullName.split(' ')[0] };
                    
                    if (!suspects.find(s => s.id === id)) {
                        suspects.push(citoyenObj);
                        updateSuspectsDisplay();
                        
                        // Proposer d'ajouter les rapports liés
                        addLinkedReportsForSuspect(citoyenObj);
                    } else {
                        showNotification('Ce citoyen est déjà dans la liste des suspects', 'warning');
                    }
                }
            });
        });
    }

    async function addLinkedReportsForSuspect(citoyen) {
        const modal = document.getElementById('confirmAutoReportsModal');
        const textElement = document.getElementById('confirmAutoReportsText');
        const confirmBtn = document.getElementById('confirmAutoBtn');
        const declineBtn = document.getElementById('declineAutoBtn');

        if (!modal || !textElement || !confirmBtn || !declineBtn) {
            if (confirm(`Voulez-vous ajouter automatiquement tous les dossiers liés à ${citoyen.prenom} ${citoyen.nom} ?`)) {
                executeAutoAdd(citoyen);
            }
            return;
        }

        textElement.textContent = `Voulez-vous ajouter automatiquement tous les rapports d'arrestation et d'interrogatoire liés à ${citoyen.prenom} ${citoyen.nom} ?`;
        modal.style.display = 'flex';

        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        const newDeclineBtn = declineBtn.cloneNode(true);
        declineBtn.parentNode.replaceChild(newDeclineBtn, declineBtn);

        newConfirmBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            executeAutoAdd(citoyen);
        });

        newDeclineBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    async function executeAutoAdd(citoyen) {
        if (!citoyen.id) {
            console.error('[DEBUG-FRONT] Erreur: citoyen.id est manquant', citoyen);
            return;
        }
        console.log(`[DEBUG-FRONT] Lancement executeAutoAdd pour suspect ID: ${citoyen.id}`, citoyen);
        
        if (loaderOverlay) loaderOverlay.style.display = 'flex';

        try {
            // Fetch arrestations
            const resArrest = await fetch(`/api/rapports-arrestation?suspectId=${citoyen.id}&limit=100`);
            const dataArrest = await resArrest.json();
            const arrestations = dataArrest.reports || [];
            console.log(`[DEBUG-FRONT] Arrestations reçues (${arrestations.length}):`, arrestations);

            // Fetch interrogatoires
            const resInterro = await fetch(`/api/rapports-interrogatoire?citoyenId=${citoyen.id}&limit=100`);
            const dataInterro = await resInterro.json();
            const interrogatoires = dataInterro.reports || (Array.isArray(dataInterro) ? dataInterro : []);
            console.log(`[DEBUG-FRONT] Interrogatoires reçus (${interrogatoires.length}):`, interrogatoires);

            let addedCount = 0;

            // Add arrestations (double vérification ID côté client)
            arrestations.forEach(rapport => {
                const suspectsInRapport = Array.isArray(rapport.suspects_impliques) ? rapport.suspects_impliques : JSON.parse(rapport.suspects_impliques || '[]');
                const isConcerned = suspectsInRapport.some(s => String(s.id) === String(citoyen.id));

                if (isConcerned && !rapports.find(r => r.type === 'arrestation' && r.id === rapport.id)) {
                    rapports.push({
                        type: 'arrestation',
                        id: rapport.id,
                        titre: rapport.titre_rapport || `Rapport #${rapport.id}`,
                        date: new Date(rapport.date_arrestation).toLocaleDateString('fr-FR')
                    });
                    addedCount++;
                }
            });

            // Add interrogatoires (double vérification ID côté client)
            interrogatoires.forEach(rapport => {
                const isConcerned = String(rapport.citoyen_id) === String(citoyen.id);
                console.log(`[DEBUG-FRONT] Vérif interro ID ${rapport.id}: citoyen_id=${rapport.citoyen_id} VS suspect_id=${citoyen.id} => matches: ${isConcerned}`);

                if (isConcerned && !rapports.find(r => r.type === 'interrogatoire' && r.id === rapport.id)) {
                    rapports.push({
                        type: 'interrogatoire',
                        id: rapport.id,
                        titre: `Interrogatoire de ${rapport.citoyen_prenom} ${rapport.citoyen_nom}`,
                        date: new Date(rapport.date_interrogatoire).toLocaleDateString('fr-FR')
                    });
                    addedCount++;
                }
            });

            if (addedCount > 0) {
                updateRapportsDisplay();
                showNotification(`${addedCount} rapport(s) lié(s) ajouté(s)`, 'success');
            } else {
                showNotification(`Aucun nouveau rapport lié trouvé pour ce citoyen`, 'info');
            }

        } catch (error) {
            console.error('Erreur ajout rapports auto:', error);
            showNotification('Erreur lors de la récupération des rapports liés', 'error');
        } finally {
            if (loaderOverlay) loaderOverlay.style.display = 'none';
        }
    }

    function updateSuspectsDisplay() {
        if (suspects.length === 0) {
            selectedSuspectsContainer.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;">Aucun suspect</p>';
            return;
        }

        selectedSuspectsContainer.innerHTML = suspects.map((suspect, index) => `
            <div class="selected-item">
                <span>${suspect.prenom} ${suspect.nom}</span>
                <span class="remove-btn" onclick="window.removeSuspect(${index})">&times;</span>
            </div>
        `).join('');
    }

    window.removeSuspect = function(index) {
        suspects.splice(index, 1);
        updateSuspectsDisplay();
    };

    // ========== SÉLECTEUR DE RAPPORTS ==========
    const selectRapportsBtn = document.getElementById('selectRapportsBtn');
    const selectedRapportsContainer = document.getElementById('selectedRapports');
    const rapportSelectorModal = document.getElementById('rapportSelectorModal');
    const rapportTypeSelect = document.getElementById('rapportTypeSelect');
    const rapportListContainer = document.getElementById('rapportListContainer');
    const cancelRapportBtn = document.getElementById('cancelRapportBtn');

    if (selectRapportsBtn) {
        selectRapportsBtn.addEventListener('click', () => {
            rapportSelectorModal.style.display = 'flex';
            rapportTypeSelect.value = '';
            rapportListContainer.innerHTML = '';
        });
    }

    if (cancelRapportBtn) {
        cancelRapportBtn.addEventListener('click', () => {
            rapportSelectorModal.style.display = 'none';
        });
    }

    if (rapportTypeSelect) {
        rapportTypeSelect.addEventListener('change', async (e) => {
            const type = e.target.value;
            if (!type) {
                rapportListContainer.innerHTML = '';
                return;
            }

            try {
                let endpoint = '';
                if (type === 'arrestation') endpoint = '/api/rapports-arrestation?limit=100';
                else if (type === 'interrogatoire') endpoint = '/api/rapports-interrogatoire?limit=100';
                else if (type === 'incident') endpoint = '/api/getIncident';

                const res = await fetch(endpoint);
                const data = await res.json();
                
                // Pour incidents, data est directement un tableau
                const rapportsList = type === 'incident' ? data : (data.reports || data.incidents || []);

                if (rapportsList.length === 0) {
                    rapportListContainer.innerHTML = '<p style="color: #7f8c8d; text-align: center;">Aucun rapport trouvé</p>';
                    return;
                }

                rapportListContainer.innerHTML = rapportsList.map(rapport => {
                    let titre = '';
                    let date = '';
                    let rapportId = '';
                    
                    if (type === 'arrestation') {
                        rapportId = rapport.id;
                        titre = rapport.titre_rapport || `Rapport #${rapport.id}`;
                        date = new Date(rapport.date_arrestation).toLocaleDateString('fr-FR');
                    } else if (type === 'interrogatoire') {
                        rapportId = rapport.id;
                        titre = `Interrogatoire de ${rapport.citoyen_prenom} ${rapport.citoyen_nom}`;
                        date = new Date(rapport.date_interrogatoire).toLocaleDateString('fr-FR');
                    } else if (type === 'incident') {
                        rapportId = rapport.id;
                        titre = rapport.recit ? (rapport.recit.substring(0, 50) + '...') : `Incident #${rapportId}`;
                        date = rapport.date; // Déjà au format YYYY-MM-DD
                        if (date) {
                            const [y, m, d] = date.split('-');
                            date = `${d}/${m}/${y}`;
                        } else {
                            date = 'N/A';
                        }
                    }

                    return `
                        <div class="rapport-item" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 10px; cursor: pointer; transition: background 0.2s;"
                            onmouseover="this.style.background='rgba(11, 27, 90, 0.05)'"
                            onmouseout="this.style.background='white'"
                            onclick="window.addRapport('${type}', '${rapportId}', '${titre.replace(/'/g, "\\'")}', '${date}')">
                            <div style="font-weight: 600;">${titre}</div>
                            <div style="font-size: 12px; color: #7f8c8d;">${date}</div>
                        </div>
                    `;
                }).join('');

            } catch (error) {
                console.error('Erreur chargement rapports:', error);
                rapportListContainer.innerHTML = '<p style="color: #e74c3c;">Erreur lors du chargement</p>';
            }
        });
    }

    window.addRapport = function(type, id, titre, date) {
        // Vérifier si le rapport n'est pas déjà ajouté
        if (!rapports.find(r => r.type === type && r.id === id)) {
            rapports.push({ type, id, titre, date });
            updateRapportsDisplay();
            rapportSelectorModal.style.display = 'none';
        } else {
            showNotification('Ce rapport est déjà lié à l\'enquête', 'warning');
        }
    };

    function updateRapportsDisplay() {
        if (rapports.length === 0) {
            selectedRapportsContainer.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;">Aucun rapport lié</p>';
            return;
        }

        selectedRapportsContainer.innerHTML = rapports.map((rapport, index) => {
            let typeLabel = '';
            if (rapport.type === 'arrestation') typeLabel = '📋 Arrestation';
            else if (rapport.type === 'interrogatoire') typeLabel = '💬 Interrogatoire';
            else if (rapport.type === 'incident') typeLabel = '⚠️ Incident';

            return `
                <div class="selected-item">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-size: 11px; color: var(--lspd-blue);">${typeLabel}</span>
                        <span>${rapport.titre} - ${rapport.date}</span>
                    </div>
                    <span class="remove-btn" onclick="window.removeRapport(${index})">&times;</span>
                </div>
            `;
        }).join('');
    }

    window.removeRapport = function(index) {
        rapports.splice(index, 1);
        updateRapportsDisplay();
    };

    // ========== SOUMISSION DU FORMULAIRE ==========
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Si on est en mode édition, ne pas utiliser ce handler
            if (isEditMode) return;

            // Validation minimale
            const sujet = document.getElementById('sujet').value.trim();
            const motifs = document.getElementById('motifs').value.trim();

            if (!sujet || !motifs) {
                showNotification('Veuillez remplir tous les champs obligatoires', 'error');
                return;
            }

            if (loaderOverlay) loaderOverlay.style.display = 'flex';

            try {
                const formData = {
                    superviseur,
                    agents,
                    sujet,
                    motifs,
                    suspects,
                    rapports,
                    infos_complementaires: document.getElementById('infos_complementaires').value.trim()
                };

                const response = await fetch('/api/rapports-enquete', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Erreur lors de la création du rapport');
                }

                const result = await response.json();
                showNotification(`Rapport d'enquête créé avec succès (${result.numero_dossier})`, 'success');

                setTimeout(() => {
                    window.location.href = '/liste-rapports-enquete';
                }, 1500);

            } catch (error) {
                console.error('Erreur:', error);
                showNotification(error.message || 'Une erreur est survenue', 'error');
            } finally {
                if (loaderOverlay) loaderOverlay.style.display = 'none';
            }
        });
    }

    // ========== MODE ÉDITION ==========
    const urlParams = new URLSearchParams(window.location.search);
    editId = urlParams.get('edit');

    if (editId) {
        isEditMode = true;
        loadEnqueteForEdit(editId);
    }

    async function loadEnqueteForEdit(id) {
        if (loaderOverlay) loaderOverlay.style.display = 'flex';

        try {
            const response = await fetch(`/api/rapports-enquete/${id}`);
            if (!response.ok) throw new Error('Erreur lors du chargement de l\'enquête');

            const enquete = await response.json();

            // Afficher le numéro de dossier
            document.getElementById('numeroDossierSection').style.display = 'block';
            document.getElementById('numeroDossierDisplay').textContent = enquete.numero_dossier;

            // Charger le superviseur
            if (enquete.superviseur_id) {
                superviseur = {
                    id: enquete.superviseur_id,
                    nom: enquete.superviseur_nom,
                    prenom: enquete.superviseur_prenom,
                    matricule: enquete.superviseur_matricule,
                    grade: '' // Grade non stocké
                };
                updateSuperviseurDisplay();
            }

            // Charger les agents
            agents = enquete.agents.map(a => ({
                id: a.agent_id,
                nom: a.agent_nom,
                prenom: a.agent_prenom,
                matricule: a.agent_matricule,
                grade: ''
            }));
            updateAgentsDisplay();

            // Charger les suspects
            suspects = enquete.suspects.map(s => ({
                id: s.citoyen_id,
                nom: s.citoyen_nom,
                prenom: s.citoyen_prenom
            }));
            updateSuspectsDisplay();

            // Charger les rapports liés
            rapports = enquete.rapports.map(r => ({
                type: r.rapport_type,
                id: r.rapport_id,
                titre: r.rapport_titre,
                date: r.rapport_date ? new Date(r.rapport_date).toLocaleDateString('fr-FR') : 'N/A'
            }));
            updateRapportsDisplay();

            // Remplir les champs
            document.getElementById('sujet').value = enquete.sujet;
            document.getElementById('motifs').value = enquete.motifs;
            document.getElementById('infos_complementaires').value = enquete.infos_complementaires || '';

            // Changer le bouton d'envoi
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.innerHTML = '<span class="material-symbols-rounded">update</span> Mettre à jour le rapport';
            }

            // Ajouter le handler de mise à jour
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                if (!isEditMode) return;

                const sujet = document.getElementById('sujet').value.trim();
                const motifs = document.getElementById('motifs').value.trim();

                if (!sujet || !motifs) {
                    showNotification('Veuillez remplir tous les champs obligatoires', 'error');
                    return;
                }

                if (loaderOverlay) loaderOverlay.style.display = 'flex';

                try {
                    const formData = {
                        superviseur,
                        agents,
                        sujet,
                        motifs,
                        suspects,
                        rapports,
                        infos_complementaires: document.getElementById('infos_complementaires').value.trim()
                    };

                    const response = await fetch(`/api/rapports-enquete/${editId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(formData)
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Erreur lors de la mise à jour');
                    }

                    showNotification('Rapport d\'enquête mis à jour avec succès', 'success');

                    setTimeout(() => {
                        window.location.href = '/liste-rapports-enquete';
                    }, 1500);

                } catch (error) {
                    console.error('Erreur:', error);
                    showNotification(error.message || 'Une erreur est survenue', 'error');
                } finally {
                    if (loaderOverlay) loaderOverlay.style.display = 'none';
                }
            });

        } catch (error) {
            console.error('Erreur:', error);
            showNotification('Erreur lors du chargement de l\'enquête', 'error');
        } finally {
            if (loaderOverlay) loaderOverlay.style.display = 'none';
        }
    }
});
