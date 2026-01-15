document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const enqueteId = urlParams.get('id');

    if (!enqueteId) {
        showNotification('Aucune enquête spécifiée', 'error');
        window.location.href = '/liste-rapports-enquete';
        return;
    }

    const loaderOverlay = document.getElementById('loaderOverlay');
    const form = document.getElementById('enqueteForm');

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

    // Charger l'enquête
    try {
        loaderOverlay.style.display = 'flex';

        const res = await fetch(`/api/rapports-enquete/${enqueteId}`);
        if (!res.ok) {
            throw new Error('Erreur lors du chargement de l\'enquête');
        }

        const enquete = await res.json();

        // Afficher le numéro de dossier
        document.getElementById('numeroDossierSection').style.display = 'block';
        document.getElementById('numeroDossierDisplay').textContent = enquete.numero_dossier;

        // Remplir les champs
        document.getElementById('sujet').value = enquete.sujet;
        document.getElementById('motifs').value = enquete.motifs;
        document.getElementById('infos_complementaires').value = enquete.infos_complementaires || '';

        // Afficher le superviseur
        const selectedSuperviseurContainer = document.getElementById('selectedSuperviseur');
        if (enquete.superviseur_prenom && enquete.superviseur_nom) {
            selectedSuperviseurContainer.innerHTML = `
                <div class="selected-item">
                    <span>${enquete.superviseur_prenom} ${enquete.superviseur_nom}</span>
                </div>
            `;
        }

        // Afficher les agents
        const selectedAgentsContainer = document.getElementById('selectedAgents');
        if (enquete.agents.length > 0) {
            selectedAgentsContainer.innerHTML = enquete.agents.map(agent => `
                <div class="selected-item">
                    <span>${agent.agent_prenom} ${agent.agent_nom}</span>
                </div>
            `).join('');
        } else {
            selectedAgentsContainer.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;">Aucun agent assigné</p>';
        }

        // Afficher les suspects
        const selectedSuspectsContainer = document.getElementById('selectedSuspects');
        if (enquete.suspects.length > 0) {
            selectedSuspectsContainer.innerHTML = enquete.suspects.map(suspect => `
                <div class="selected-item" style="cursor: pointer;" onclick="window.location.href='/view-citoyen?id=${suspect.citoyen_id}'">
                    <span>${suspect.citoyen_prenom} ${suspect.citoyen_nom}</span>
                </div>
            `).join('');
        } else {
            selectedSuspectsContainer.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;">Aucun suspect</p>';
        }

        // Afficher les rapports liés
        const selectedRapportsContainer = document.getElementById('selectedRapports');
        if (enquete.rapports.length > 0) {
            selectedRapportsContainer.innerHTML = enquete.rapports.map(rapport => {
                let typeLabel = '';
                let url = '';
                if (rapport.rapport_type === 'arrestation') {
                    typeLabel = '📋 Arrestation';
                    url = `/view-rapport-arrestation?id=${rapport.rapport_id}`;
                } else if (rapport.rapport_type === 'interrogatoire') {
                    typeLabel = '💬 Interrogatoire';
                    url = `/view-rapport-interrogatoire?id=${rapport.rapport_id}`;
                } else if (rapport.rapport_type === 'incident') {
                    typeLabel = '⚠️ Incident';
                    url = `/view-incident?id=${rapport.rapport_id}`;
                }

                const date = new Date(rapport.rapport_date).toLocaleDateString('fr-FR');
                
                return `
                    <div class="selected-item" style="cursor: pointer;" onclick="window.location.href='${url}'">
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-size: 11px; color: var(--lspd-blue);">${typeLabel}</span>
                            <span>${rapport.rapport_titre} - ${date}</span>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            selectedRapportsContainer.innerHTML = '<p style="color: #7f8c8d; font-size: 14px;">Aucun rapport lié</p>';
        }

        // Désactiver tous les champs et boutons
        document.querySelectorAll('input, textarea, button, select').forEach(el => {
            if (el.id !== 'backlinkBtn') {
                el.disabled = true;
            }
        });

        // Masquer le bouton d'envoi
        const submitButton = document.querySelector('.send-button');
        if (submitButton) {
            submitButton.style.display = 'none';
        }

        // Masquer tous les boutons de sélection
        document.getElementById('selectSuperviseurBtn').style.display = 'none';
        document.getElementById('selectAgentsBtn').style.display = 'none';
        document.getElementById('selectSuspectsBtn').style.display = 'none';
        document.getElementById('selectRapportsBtn').style.display = 'none';

    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors du chargement de l\'enquête', 'error');
    } finally {
        loaderOverlay.style.display = 'none';
    }
});

