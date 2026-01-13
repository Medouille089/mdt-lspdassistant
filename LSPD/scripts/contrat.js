let clauseCounter = 0;
let editMode = false;
let currentContratId = null;

// Récupérer les infos utilisateur
async function getUserInfo() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            const data = await response.json();
            return data; // Retourne l'objet complet comme incident.js
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des infos utilisateur:', error);
    }
    return null;
}

// Ajouter une clause
function addClause(type = 'lspd', text = '') {
    clauseCounter++;
    const containerId = type === 'lspd' ? 'clauses-lspd' : 'clauses-entreprise';
    const clausesList = document.getElementById(containerId);
    const clauseItem = document.createElement('div');
    clauseItem.className = 'clause-item';
    clauseItem.dataset.id = clauseCounter;
    clauseItem.dataset.type = type;

    clauseItem.innerHTML = `
    <textarea class="clause-text" placeholder="Article..." required>${text}</textarea>
    <button type="button" class="btn-remove-clause" onclick="removeClause(${clauseCounter})" title="Supprimer la clause">
        <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 24 24" width="20px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg>
    </button>
  `;

    clausesList.appendChild(clauseItem);
}

// Supprimer une clause
window.removeClause = function (id) {
    const clauseItem = document.querySelector(`[data-id="${id}"]`);
    if (clauseItem) {
        clauseItem.remove();
    }
};

// Calculer la durée en mois
function calculateDuration() {
    const dureeInput = document.getElementById('duree_mois').value;
    const duree = parseInt(dureeInput);
    const dateDebut = document.getElementById('date_debut').value;

    if (dateDebut && !isNaN(duree) && duree > 0) {
        const start = new Date(dateDebut);
        start.setMonth(start.getMonth() + duree);

        const year = start.getFullYear();
        const month = String(start.getMonth() + 1).padStart(2, '0');
        const day = String(start.getDate()).padStart(2, '0');

        document.getElementById('date_fin').value = `${year}-${month}-${day}`;
    }
}

// Charger un contrat existant
async function loadContrat(id) {
    const loaderOverlay = document.getElementById('loaderOverlay');
    loaderOverlay.style.display = 'flex';

    try {
        const response = await fetch(`/api/contrats/${id}`);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erreur API:', errorText);
            throw new Error('Contrat non trouvé');
        }

        const contrat = await response.json();
        console.log('Contrat chargé:', contrat);

        // Vérifier le mode (view ou edit)
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');

        currentContratId = id;

        // Remplir le formulaire
        document.getElementById('contratId').value = contrat.id;

        // Formatage des dates pour l'input type="date" (YYYY-MM-DD)
        if (contrat.date_debut) {
            const d = new Date(contrat.date_debut);
            document.getElementById('date_debut').value = d.toISOString().split('T')[0];
        }

        document.getElementById('duree_mois').value = contrat.duree_mois;

        if (contrat.date_fin) {
            const d = new Date(contrat.date_fin);
            document.getElementById('date_fin').value = d.toISOString().split('T')[0];
        }

        document.getElementById('statut').value = contrat.statut;
        document.getElementById('nom_entreprise').value = contrat.nom_entreprise;
        document.getElementById('representant_entreprise').value = contrat.representant_entreprise || '';
        document.getElementById('contact_entreprise').value = contrat.contact_entreprise || '';
        document.getElementById('officier_responsable').value = contrat.officier_responsable;
        document.getElementById('grade_officier').value = contrat.grade_officier || '';
        document.getElementById('objet_contrat').value = contrat.objet_contrat;

        // Charger les clauses
        let clauses = { lspd: [], entreprise: [] };
        try {
            const parsed = typeof contrat.clauses === 'string' ? JSON.parse(contrat.clauses) : (contrat.clauses || []);
            if (Array.isArray(parsed)) {
                // Migration ancien format
                clauses.lspd = parsed;
            } else {
                clauses = parsed;
            }
        } catch (e) {
            console.error('Erreur parsing clauses:', e);
        }

        if (clauses.lspd) clauses.lspd.forEach(c => addClause('lspd', c));
        if (clauses.entreprise) clauses.entreprise.forEach(c => addClause('entreprise', c));

        // Mode consultation uniquement pour les contrats existants
        document.getElementById('page-title').textContent = 'Consulter le contrat';
        const submitBtn = document.querySelector('.submit-btn');
        if (submitBtn) submitBtn.style.display = 'none';
        document.getElementById('btn-export').style.display = 'inline-block';

        // Désactiver tous les champs
        const inputs = document.querySelectorAll('input, textarea, select, button');
        inputs.forEach(input => {
            if (input.id !== 'btn-export' && input.id !== 'backlinkBtn') {
                input.disabled = true;
            }
        });

        // Masquer les boutons d'ajout/suppression de clauses
        const btnAddLspd = document.getElementById('btn-add-clause-lspd');
        if (btnAddLspd) btnAddLspd.style.display = 'none';

        const btnAddEnt = document.getElementById('btn-add-clause-entreprise');
        if (btnAddEnt) btnAddEnt.style.display = 'none';

        document.querySelectorAll('.btn-remove-clause').forEach(btn => btn.style.display = 'none');

        // Ajouter le bouton de résiliation si le contrat est actif
        if (contrat.statut !== 'Résilié' && contrat.statut !== 'Archivé') {
            const actionsDiv = document.querySelector('.form-actions');
            if (actionsDiv && !document.getElementById('btn-terminate')) {
                const terminateBtn = document.createElement('button');
                terminateBtn.id = 'btn-terminate';
                terminateBtn.type = 'button';
                terminateBtn.className = 'submit-btn'; // Utiliser la même classe pour le style de base
                terminateBtn.style.backgroundColor = '#dc3545'; // Rouge
                terminateBtn.style.marginLeft = '10px';
                terminateBtn.textContent = 'Résilier le contrat';
                terminateBtn.onclick = () => terminateContrat(contrat.id);
                actionsDiv.appendChild(terminateBtn);
            }
        }

    } catch (error) {
        console.error('Erreur lors du chargement du contrat:', error);
        showNotification('Erreur lors du chargement du contrat: ' + error.message, 'error');
    } finally {
        loaderOverlay.style.display = 'none';
    }
}

// Résilier un contrat
async function terminateContrat(id) {
    showConfirm('Êtes-vous sûr de vouloir résilier ce contrat ? Cette action est irréversible.', (result) => {
        if (!result) return;

        terminateContratConfirmed(id);
    }, { yesText: 'Résilier', noText: 'Annuler' });
}

async function terminateContratConfirmed(id) {
    const loaderOverlay = document.getElementById('loaderOverlay');
    loaderOverlay.style.display = 'flex';

    try {
        const response = await fetch(`/api/contrats/${id}/terminate`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la résiliation');
        }

        showNotification('Contrat résilié avec succès', 'success');
        window.location.reload();
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors de la résiliation: ' + error.message, 'error');
    } finally {
        loaderOverlay.style.display = 'none';
    }
}

// Exporter en PNG
async function exportPNG() {
    if (!currentContratId) {
        showNotification('Aucun contrat sélectionné', 'error');
        return;
    }

    const loaderOverlay = document.getElementById('loaderOverlay');
    loaderOverlay.style.display = 'flex';

    try {
        // Récupérer les données du contrat
        const response = await fetch(`/api/contrats/${currentContratId}`);
        if (!response.ok) throw new Error('Erreur lors de la récupération du contrat');
        const contrat = await response.json();

        let clauses = { lspd: [], entreprise: [] };
        try {
            const parsed = typeof contrat.clauses === 'string' ? JSON.parse(contrat.clauses) : (contrat.clauses || []);
            if (Array.isArray(parsed)) {
                clauses.lspd = parsed;
            } else {
                clauses = parsed;
            }
        } catch (e) {
            clauses = { lspd: [], entreprise: [] };
        }

        // Créer l'élément temporaire pour le rendu
        const exportContainer = document.createElement('div');
        exportContainer.style.position = 'absolute';
        exportContainer.style.left = '-9999px';
        exportContainer.style.width = '800px';
        exportContainer.style.background = 'white';
        exportContainer.style.padding = '40px';
        exportContainer.style.fontFamily = "'Segoe UI', Arial, sans-serif";
        exportContainer.style.color = '#0b1b5a';

        // Générer le HTML des clauses
        const lspdClausesHTML = (clauses.lspd || []).map((c, i) => `<p style="margin: 5px 0; font-size: 12px;">${i + 1}. ${c}</p>`).join('');
        const entClausesHTML = (clauses.entreprise || []).map((c, i) => `<p style="margin: 5px 0; font-size: 12px;">${i + 1}. ${c}</p>`).join('');

        exportContainer.innerHTML = `
            <div style="text-align: center; border-bottom: 3px solid #0b1b5a; padding-bottom: 20px; margin-bottom: 30px;">
                <h1 style="margin: 0; font-size: 24px;">LOS SANTOS POLICE DEPARTMENT</h1>
                <h2 style="margin: 5px 0; font-size: 18px; font-weight: normal;">CONTRAT DE PARTENARIAT</h2>
                <p style="margin: 5px 0; font-weight: bold;">N° ${contrat.numero_contrat}</p>
            </div>

            <div style="display: flex; justify-content: space-between; background: #f9fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <div>
                    <div><strong>Date début:</strong> ${new Date(contrat.date_debut).toLocaleDateString('fr-FR')}</div>
                    <div><strong>Durée:</strong> ${contrat.duree_mois} mois</div>
                </div>
                <div style="text-align: right;">
                    <div><strong>Date fin:</strong> ${new Date(contrat.date_fin).toLocaleDateString('fr-FR')}</div>
                    <div><strong>Statut:</strong> ${contrat.statut.toUpperCase()}</div>
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <h3 style="border-bottom: 2px solid #0b1b5a; padding-bottom: 5px; font-size: 16px;">ENTRE LES PARTIES</h3>
                <p><strong>Le Los Santos Police Department (LSPD)</strong>, représenté par <strong>${contrat.officier_responsable}</strong>${contrat.grade_officier ? `, ${contrat.grade_officier}` : ''}</p>
                <p style="text-align: center; margin: 10px 0; font-weight: bold;">ET</p>
                <p><strong>${contrat.nom_entreprise}</strong>${contrat.representant_entreprise ? `, représentée par <strong>${contrat.representant_entreprise}</strong>` : ''}</p>
            </div>

            <div style="margin-bottom: 20px;">
                <h3 style="border-bottom: 2px solid #0b1b5a; padding-bottom: 5px; font-size: 16px;">OBJET DU CONTRAT</h3>
                <p style="text-align: justify; font-size: 13px;">${contrat.objet_contrat}</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px;">
                <div>
                    <h3 style="font-size: 14px; background: #0b1b5a; color: white; padding: 5px; text-align: center; margin-top: 0;">ENGAGEMENTS LSPD</h3>
                    ${lspdClausesHTML}
                </div>
                <div>
                    <h3 style="font-size: 14px; background: #0b1b5a; color: white; padding: 5px; text-align: center; margin-top: 0;">ENGAGEMENTS ENTREPRISE</h3>
                    ${entClausesHTML}
                </div>
            </div>

            <div style="display: flex; justify-content: space-around; margin-top: 60px;">
                <div style="text-align: center; width: 40%;">
                    <p style="margin-bottom: 40px;"><strong>Pour le LSPD</strong></p>
                    <div style="font-family: 'Brush Script MT', cursive; font-size: 24px; color: #000;">${contrat.officier_responsable}</div>
                    <div style="border-top: 1px solid #0b1b5a; margin-top: 5px; font-size: 10px;">Signature</div>
                </div>
                <div style="text-align: center; width: 40%;">
                    <p style="margin-bottom: 40px;"><strong>Pour ${contrat.nom_entreprise}</strong></p>
                    <div style="font-family: 'Brush Script MT', cursive; font-size: 24px; color: #000;">${contrat.representant_entreprise || 'Signature'}</div>
                    <div style="border-top: 1px solid #0b1b5a; margin-top: 5px; font-size: 10px;">Signature</div>
                </div>
            </div>
        `;

        document.body.appendChild(exportContainer);

        const canvas = await html2canvas(exportContainer, {
            scale: 2, // Meilleure qualité
            useCORS: true
        });

        document.body.removeChild(exportContainer);

        // Télécharger l'image
        const link = document.createElement('a');
        link.download = `Contrat_${contrat.numero_contrat}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

    } catch (error) {
        console.error('Erreur lors de l\'export PNG:', error);
        showNotification('Erreur lors de l\'export: ' + error.message, 'error');
    } finally {
        loaderOverlay.style.display = 'none';
    }
}

// Soumettre le formulaire
document.getElementById('contratForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const loaderOverlay = document.getElementById('loaderOverlay');
    loaderOverlay.style.display = 'flex';

    try {
        const user = await getUserInfo();

        // Récupérer les clauses par type
        const lspdClauses = Array.from(document.querySelectorAll('#clauses-lspd .clause-text')).map(el => el.value.trim()).filter(v => v);
        const entClauses = Array.from(document.querySelectorAll('#clauses-entreprise .clause-text')).map(el => el.value.trim()).filter(v => v);

        const formData = {
            date_debut: document.getElementById('date_debut').value,
            date_fin: document.getElementById('date_fin').value,
            duree_mois: parseInt(document.getElementById('duree_mois').value),
            statut: document.getElementById('statut').value,
            nom_entreprise: document.getElementById('nom_entreprise').value,
            representant_entreprise: document.getElementById('representant_entreprise').value,
            contact_entreprise: document.getElementById('contact_entreprise').value,
            officier_responsable: document.getElementById('officier_responsable').value || user?.username || 'Inconnu',
            grade_officier: document.getElementById('grade_officier').value || user?.grade || '',
            objet_contrat: document.getElementById('objet_contrat').value,
            clauses: { lspd: lspdClauses, entreprise: entClauses }
        };

        const url = editMode ? `/api/contrats/${currentContratId}` : '/api/contrats';
        const method = editMode ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la sauvegarde du contrat');
        }

        const result = await response.json();

        // Générer et envoyer l'image sur Discord
        if (!editMode && result.id) {
            try {
                // Créer le conteneur temporaire (copie de exportPNG)
                const exportContainer = document.createElement('div');
                exportContainer.style.position = 'absolute';
                exportContainer.style.left = '-9999px';
                exportContainer.style.width = '800px';
                exportContainer.style.background = 'white';
                exportContainer.style.padding = '40px';
                exportContainer.style.fontFamily = "'Segoe UI', Arial, sans-serif";
                exportContainer.style.color = '#0b1b5a';

                // Récupérer les clauses
                const lspdClauses = formData.clauses.lspd || [];
                const entClauses = formData.clauses.entreprise || [];

                const lspdClausesHTML = lspdClauses.map((c, i) => `<p style="margin: 5px 0; font-size: 12px;">${i + 1}. ${c}</p>`).join('');
                const entClausesHTML = entClauses.map((c, i) => `<p style="margin: 5px 0; font-size: 12px;">${i + 1}. ${c}</p>`).join('');

                exportContainer.innerHTML = `
                    <div style="text-align: center; border-bottom: 3px solid #0b1b5a; padding-bottom: 20px; margin-bottom: 30px;">
                        <h1 style="margin: 0; font-size: 24px;">LOS SANTOS POLICE DEPARTMENT</h1>
                        <h2 style="margin: 5px 0; font-size: 18px; font-weight: normal;">CONTRAT DE PARTENARIAT</h2>
                        <p style="margin: 5px 0; font-weight: bold;">N° ${result.numero_contrat}</p>
                    </div>

                    <div style="display: flex; justify-content: space-between; background: #f9fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <div>
                            <div><strong>Date début:</strong> ${new Date(formData.date_debut).toLocaleDateString('fr-FR')}</div>
                            <div><strong>Durée:</strong> ${formData.duree_mois} mois</div>
                        </div>
                        <div style="text-align: right;">
                            <div><strong>Date fin:</strong> ${new Date(formData.date_fin).toLocaleDateString('fr-FR')}</div>
                            <div><strong>Statut:</strong> ${formData.statut.toUpperCase()}</div>
                        </div>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <h3 style="border-bottom: 2px solid #0b1b5a; padding-bottom: 5px; font-size: 16px;">ENTRE LES PARTIES</h3>
                        <p style="margin-bottom: 0;"><strong>Le Los Santos Police Department (LSPD)</strong>, représenté par <strong>${formData.officier_responsable}</strong>${formData.grade_officier ? `, ${formData.grade_officier}` : ''}</p>
                        <p style="text-align: center; margin: 10px 0; font-weight: bold;">ET</p>
                        <p style="margin-top: 0;"><strong>${formData.nom_entreprise}</strong>${formData.representant_entreprise ? `, représentée par <strong>${formData.representant_entreprise}</strong>` : ''}</p>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <h3 style="border-bottom: 2px solid #0b1b5a; padding-bottom: 5px; font-size: 16px;">OBJET DU CONTRAT</h3>
                        <p style="text-align: justify; font-size: 13px;">${formData.objet_contrat}</p>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px;">
                        <div>
                            <h3 style="font-size: 14px; background: #0b1b5a; color: white; padding: 5px; text-align: center; margin-top: 0;">ENGAGEMENTS LSPD</h3>
                            ${lspdClausesHTML}
                        </div>
                        <div>
                            <h3 style="font-size: 14px; background: #0b1b5a; color: white; padding: 5px; text-align: center; margin-top: 0;">ENGAGEMENTS ENTREPRISE</h3>
                            ${entClausesHTML}
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-around; margin-top: 60px;">
                        <div style="text-align: center; width: 40%;">
                            <p style="margin-bottom: 40px;"><strong>Pour le LSPD</strong></p>
                            <div style="font-family: 'Brush Script MT', cursive; font-size: 24px; color: #000;">${formData.officier_responsable}</div>
                            <div style="border-top: 1px solid #0b1b5a; margin-top: 5px; font-size: 10px;">Signature</div>
                        </div>
                        <div style="text-align: center; width: 40%;">
                            <p style="margin-bottom: 40px;"><strong>Pour ${formData.nom_entreprise}</strong></p>
                            <div style="font-family: 'Brush Script MT', cursive; font-size: 24px; color: #000;">${formData.representant_entreprise || 'Signature'}</div>
                            <div style="border-top: 1px solid #0b1b5a; margin-top: 5px; font-size: 10px;">Signature</div>
                        </div>
                    </div>
                `;

                document.body.appendChild(exportContainer);
                const canvas = await html2canvas(exportContainer, { scale: 2, useCORS: true });
                document.body.removeChild(exportContainer);

                // Convertir en Blob et envoyer
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                const imageFormData = new FormData();
                imageFormData.append('image', blob, `Contrat_${result.numero_contrat}.png`);

                await fetch(`/api/contrats/${result.id}/image`, {
                    method: 'POST',
                    body: imageFormData
                });

            } catch (imgError) {
                console.error("Erreur envoi image Discord:", imgError);
            }
        }

        // Afficher un message de succès
        showNotification(editMode ? 'Contrat modifié avec succès!' : 'Contrat créé avec succès!', 'success');

        // Rediriger vers la liste des contrats
        window.location.href = '/liste-contrats';
    } catch (error) {
        console.error('Erreur:', error);
        showNotification('Erreur lors de la sauvegarde du contrat', 'error');
    } finally {
        loaderOverlay.style.display = 'none';
    }
});

// Event listeners
document.getElementById('btn-add-clause-lspd').addEventListener('click', () => addClause('lspd'));
document.getElementById('btn-add-clause-entreprise').addEventListener('click', () => addClause('entreprise'));
document.getElementById('duree_mois').addEventListener('input', calculateDuration);
document.getElementById('date_debut').addEventListener('change', calculateDuration);
document.getElementById('btn-export').addEventListener('click', exportPNG);

// Validation du numéro de téléphone
document.getElementById('contact_entreprise').addEventListener('input', function (e) {
    let value = e.target.value.replace(/\D/g, ''); // Garder que les chiffres
    if (value.startsWith('555')) {
        value = value.substring(3);
    }

    if (value.length > 4) {
        value = value.substring(0, 4);
    }

    if (value.length > 0) {
        e.target.value = '555-' + value;
    } else {
        e.target.value = '555-';
    }
});

document.getElementById('contact_entreprise').addEventListener('focus', function (e) {
    if (!e.target.value) {
        e.target.value = '555-';
    }
});

document.getElementById('contact_entreprise').addEventListener('blur', function (e) {
    if (e.target.value === '555-') {
        e.target.value = '';
    }
});

// Retour
document.getElementById('backlinkBtn').addEventListener('click', () => {
    window.location.href = '/liste-contrats';
});

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    // Mettre la date du jour
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    document.getElementById('date_debut').value = `${year}-${month}-${day}`;

    // Remplir les infos de l'utilisateur
    const user = await getUserInfo();
    if (user) {
        console.log('User info:', user);
        document.getElementById('officier_responsable').value = user.username || '';
        document.getElementById('grade_officier').value = user.grade || '';
        const gradeInput = document.getElementById('grade');
        if (gradeInput) gradeInput.value = user.grade || '';
    }

    // Vérifier si on est en mode édition
    const urlParams = new URLSearchParams(window.location.search);
    const contratId = urlParams.get('id');

    if (contratId) {
        await loadContrat(contratId);
    } else {
        // Mode création : ajouter une clause par défaut de chaque côté
        addClause('lspd');
        addClause('entreprise');
    }
});
