
let reportId = null;
let currentReport = null;
let existingPhotos = [];

// Instances des sélecteurs
let agentSelector, civilSelector, suspectSelector;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    reportId = urlParams.get('id');

    if (!reportId) {
        alert("ID manquant");
        window.location.href = '/liste-rapports-arrestation.html';
        return;
    }

    document.getElementById('reportId').value = reportId;
    document.getElementById('backlinkBtn').addEventListener('click', () => window.history.back());
    document.getElementById('saveBtn').addEventListener('click', saveReport);

    // Gestion de l'affichage du nom de l'avocat
    const avocatCheckbox = document.getElementById("avocat_intervention");
    if (avocatCheckbox) {
        avocatCheckbox.addEventListener("change", () => toggleAvocatField(avocatCheckbox.checked));
    }

    // Initialiser les sélecteurs
    initSelectors();

    // Charger le rapport
    await loadReport();
});

function toggleAvocatField(show, value = "") {
    const avocatPut = document.getElementById("avocatPut");
    if (!avocatPut) return;

    if (show) {
        if (!document.getElementById("nom_avocat_container")) {
            const div = document.createElement("div");
            div.id = "nom_avocat_container";
            div.innerHTML = `
                <label for="nom_avocat">Nom de l'avocat</label>
                <input type="text" id="nom_avocat" name="nom_avocat" placeholder="Nom de l'avocat" required />
            `;
            avocatPut.appendChild(div);
            if (value) {
                document.getElementById("nom_avocat").value = value;
            }
        }
    } else {
        const container = document.getElementById("nom_avocat_container");
        if (container) {
            container.remove();
        }
    }
}

function initSelectors() {
    // Agents
    agentSelector = new GenericSelectorModal({
        triggerBtnId: 'addAgentBtn',
        containerId: 'selectedAgents',
        hiddenInputId: 'agents_impliques',
        modalTitle: 'Sélectionner un agent',
        apiEndpoint: '/api/officers',
        searchPlaceholder: 'Rechercher un agent...',
        itemLabelKey: (item) => `${item.grade ? item.grade + ' ' : ''}${item.displayName}`,
        itemValueKey: 'id',
        renderItem: (item) => `
            <div class="agent-item">
                <span class="agent-name">${item.grade ? item.grade + ' ' : ''}${item.displayName}</span>
            </div>
        `
    });

    // Civils
    civilSelector = new GenericSelectorModal({
        triggerBtnId: 'addCivilBtn',
        containerId: 'selectedCivils',
        hiddenInputId: 'civils_impliques',
        modalTitle: 'Sélectionner un civil',
        apiEndpoint: async () => {
            // On charge une liste vide au départ, la recherche fera le travail via filterItems si on adapte GenericSelector
            // Mais GenericSelector charge tout au début. Pour les civils c'est lourd.
            // On va utiliser une endpoint qui renvoie les derniers ou vide.
            // Pour l'instant on fetch tout ou on limite.
            // TODO: Adapter GenericSelector pour recherche serveur.
            // Ici on va fetcher une liste limitée ou vide et laisser la recherche locale si possible, 
            // ou juste fetcher '/api/citoyens' si c'est pas trop gros.
            const res = await fetch('/api/citoyens?limit=100'); 
            return await res.json();
        },
        transformData: (data) => data.citoyens || [],
        searchPlaceholder: 'Rechercher un citoyen...',
        itemLabelKey: (item) => `${item.prenom} ${item.nom}`,
        itemValueKey: 'id'
    });

    // Suspects
    suspectSelector = new GenericSelectorModal({
        triggerBtnId: 'addSuspectBtn',
        containerId: 'selectedSuspects',
        hiddenInputId: 'suspects_impliques',
        modalTitle: 'Sélectionner un suspect',
        apiEndpoint: async () => {
            const res = await fetch('/api/citoyens?limit=100');
            return await res.json();
        },
        transformData: (data) => data.citoyens || [],
        searchPlaceholder: 'Rechercher un suspect...',
        itemLabelKey: (item) => `${item.prenom} ${item.nom}`,
        itemValueKey: 'id'
    });
}

async function loadReport() {
    const loader = document.getElementById('loaderOverlay');
    try {
        loader.style.display = 'flex';
        const res = await fetch(`/api/rapports-arrestation/${reportId}`);
        if (!res.ok) throw new Error("Rapport introuvable");
        
        currentReport = await res.json();
        populateForm(currentReport);

    } catch (err) {
        console.error(err);
        alert("Erreur chargement rapport");
    } finally {
        loader.style.display = 'none';
    }
}

function populateForm(data) {
    // Dates
    if (data.date_arrestation) {
        const d = new Date(data.date_arrestation);
        document.getElementById('date').value = d.toISOString().split('T')[0];
        document.getElementById('heure').value = d.toTimeString().slice(0, 5);
    }

    document.getElementById('officier').value = data.agent_redacteur_nom || data.agent_redacteur_id || '';
    document.getElementById('grade').value = data.agent_redacteur_grade || '';

    document.getElementById('droits_cites').checked = data.droits_cites || false;
    document.getElementById('droits_heure').value = data.droits_heure || '';

    document.getElementById('avocat_intervention').checked = data.avocat_intervention || false;
    if (data.avocat_intervention) {
        toggleAvocatField(true, data.nom_avocat);
    }
    document.getElementById('ems_intervention').checked = data.ems_intervention || false;
    document.getElementById('nourriture_demandee').checked = data.nourriture_demandee || false;

    document.getElementById('heure_cellule').value = data.heure_cellule || '';
    document.getElementById('objets_confisques').value = data.objets_confisques || '';
    document.getElementById('recit').value = data.recit || '';
    document.getElementById('charges_image_url').value = data.charges_image_url || '';

    // Preview charges image
    if (data.charges_image_url) {
        const img = document.createElement('img');
        img.src = data.charges_image_url;
        img.style.maxWidth = '100%';
        img.style.marginTop = '10px';
        document.getElementById('chargesPreview').appendChild(img);
    }

    // Populate Selectors
    if (data.agents_impliques) {
        data.agents_impliques.forEach(item => agentSelector.addItem(item));
    }
    if (data.civils_impliques) {
        data.civils_impliques.forEach(item => civilSelector.addItem(item));
    }
    if (data.suspects_impliques) {
        data.suspects_impliques.forEach(item => suspectSelector.addItem(item));
    }

    // Photos existantes
    existingPhotos = data.photos_urls || []; // Assumant que le backend renvoie photos_urls (array of strings)
    // Si le backend renvoie 'attachments' ou autre, adapter.
    // Le POST stocke dans 'photos_urls' JSONB.
    
    renderExistingPhotos();
}

function renderExistingPhotos() {
    const container = document.getElementById('attachmentsPreview');
    container.innerHTML = '';

    existingPhotos.forEach((url, index) => {
        const div = document.createElement('div');
        div.className = 'attachment-item';
        div.style.position = 'relative';
        div.style.display = 'inline-block';
        div.style.margin = '5px';

        const img = document.createElement('img');
        img.src = url;
        img.style.maxWidth = '150px';
        img.style.maxHeight = '150px';
        img.style.borderRadius = '5px';

        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '&times;';
        removeBtn.style.position = 'absolute';
        removeBtn.style.top = '-5px';
        removeBtn.style.right = '-5px';
        removeBtn.style.background = 'red';
        removeBtn.style.color = 'white';
        removeBtn.style.border = 'none';
        removeBtn.style.borderRadius = '50%';
        removeBtn.style.width = '20px';
        removeBtn.style.height = '20px';
        removeBtn.style.cursor = 'pointer';
        removeBtn.onclick = (e) => {
            e.preventDefault();
            existingPhotos.splice(index, 1);
            renderExistingPhotos();
        };

        div.appendChild(img);
        div.appendChild(removeBtn);
        container.appendChild(div);
    });
}

async function saveReport() {
    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    btn.textContent = "Sauvegarde en cours...";

    try {
        const formData = new FormData();
        
        formData.append('date', document.getElementById('date').value);
        formData.append('heure', document.getElementById('heure').value);
        formData.append('officier', document.getElementById('officier').value);
        formData.append('grade', document.getElementById('grade').value);
        
        formData.append('droits_cites', document.getElementById('droits_cites').checked);
        formData.append('droits_heure', document.getElementById('droits_heure').value);
        
        formData.append('avocat_intervention', document.getElementById('avocat_intervention').checked);
        if (document.getElementById('avocat_intervention').checked) {
            const nomAvocat = document.getElementById('nom_avocat');
            if (nomAvocat) {
                formData.append('nom_avocat', nomAvocat.value);
            }
        }
        formData.append('ems_intervention', document.getElementById('ems_intervention').checked);
        formData.append('nourriture_demandee', document.getElementById('nourriture_demandee').checked);
        
        formData.append('heure_cellule', document.getElementById('heure_cellule').value);
        formData.append('objets_confisques', document.getElementById('objets_confisques').value);
        formData.append('recit', document.getElementById('recit').value);
        formData.append('charges_image_url', document.getElementById('charges_image_url').value);

        // Selectors data (JSON strings)
        formData.append('agents_impliques', document.getElementById('agents_impliques').value);
        formData.append('civils_impliques', document.getElementById('civils_impliques').value);
        formData.append('suspects_impliques', document.getElementById('suspects_impliques').value);

        // Existing photos to keep
        existingPhotos.forEach(url => formData.append('existing_photos', url));

        // New photos
        const fileInput = document.getElementById('pieces');
        if (fileInput.files.length > 0) {
            for (let i = 0; i < fileInput.files.length; i++) {
                formData.append('pieces', fileInput.files[i]);
            }
        }

        const res = await fetch(`/api/rapports-arrestation/${reportId}`, {
            method: 'PUT',
            body: formData // Content-Type header is set automatically with boundary
        });

        if (!res.ok) throw new Error("Erreur sauvegarde");

        showAnimation('success', "Rapport modifié avec succès");
        setTimeout(() => {
            window.location.href = `/view-rapport-arrestation.html?id=${reportId}`;
        }, 1500);

    } catch (err) {
        console.error(err);
        showAnimation('error', "Erreur lors de la sauvegarde");
        btn.disabled = false;
        btn.textContent = "Sauvegarder les modifications";
    }
}

function showAnimation(type, message) {
    const container = document.getElementById('feedbackAnimation');
    if (!container) return;
    container.className = `feedback-animation ${type}`; // Assurez-vous d'avoir du CSS pour ça
    container.textContent = message;
    container.style.display = 'block';
    setTimeout(() => container.style.display = 'none', 3000);
}
