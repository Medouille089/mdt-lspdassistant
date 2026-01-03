
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const reportId = urlParams.get('id');
    const loader = document.getElementById('loaderOverlay');

    if (!reportId) {
        alert("ID manquant");
        window.location.href = '/liste-rapports-arrestation.html';
        return;
    }

    document.getElementById('backlinkBtn').addEventListener('click', () => window.history.back());

    try {
        loader.style.display = 'flex';
        
        // Charger user pour permissions
        let currentUser = null;
        try {
            const uRes = await fetch('/api/user');
            if (uRes.ok) currentUser = await uRes.json();
        } catch (e) {}

        // Charger rapport
        const res = await fetch(`/api/rapports-arrestation/${reportId}`);
        if (!res.ok) throw new Error("Rapport introuvable");
        
        const data = await res.json();
        populateView(data);

        // Afficher bouton modifier si autorisé
        // if (currentUser) {
        //     // Autoriser si créateur ou command staff ou superviseur
        //     document.getElementById('editLink').href = `/modifier-rapport-arrestation.html?id=${reportId}`;
        //     document.getElementById('editLink').style.display = 'flex';
        // }

    } catch (err) {
        console.error(err);
        alert("Erreur chargement rapport");
    } finally {
        loader.style.display = 'none';
    }
});

function populateView(data) {
    // Afficher le titre du rapport si présent
    if (data.titre_rapport) {
        document.querySelector('.header-title h3').innerHTML = `${data.titre_rapport} <span style="color:#888;font-size:15px;">(#${data.id})</span>`;
    } else {
        document.getElementById('displayId').textContent = data.id;
    }

    // Tags
    const tagsContainer = document.getElementById('tagsContainer');
    if (tagsContainer && data.tags) {
        tagsContainer.innerHTML = '';
        data.tags.forEach(tag => {
            const tagEl = document.createElement('div');
            tagEl.className = 'tag-item';
            tagEl.style.backgroundColor = tag.color;
            tagEl.innerHTML = `<span>${tag.name}</span>`;
            tagsContainer.appendChild(tagEl);
        });
        if (data.tags.length === 0) {
            tagsContainer.innerHTML = '<span style="color:#888; font-style:italic; font-size:13px; margin-left: 5px;">Aucun tag</span>';
        }
    }
    
    // Dates
    if (data.date_arrestation) {
        const d = new Date(data.date_arrestation);
        // Format YYYY-MM-DD for date input
        document.getElementById('date').value = d.toISOString().split('T')[0];
        // Format HH:MM for time input
        document.getElementById('heure').value = d.toTimeString().slice(0, 5);
    }

    // Agent rédacteur
    // Si on a le nom de l'agent dans les données jointes, on l'affiche, sinon l'ID
    // Idéalement le backend devrait renvoyer le nom de l'agent rédacteur
    document.getElementById('officier').value = data.officier_redacteur || 'Inconnu';
    document.getElementById('grade').value = data.grade || '';

    // Droits
    document.getElementById('droits_cites').checked = data.droits_cites || false;
    document.getElementById('droits_heure').value = data.droits_heure || '';

    // Switches
    const hasAvocat = data.avocat_intervention === true || data.avocat_intervention === 'true' || data.avocat_intervention === 't';
    document.getElementById('avocat_intervention').checked = hasAvocat;
    
    const avocatPut = document.getElementById("avocatPut");
    if (avocatPut) {
        avocatPut.innerHTML = ''; // Clear first
        if (hasAvocat) {
            const div = document.createElement("div");
            div.id = "nom_avocat_container";
            div.innerHTML = `
                <label for="nom_avocat">Nom de l'avocat</label>
                <input type="text" id="nom_avocat" value="${data.nom_avocat || ''}" disabled />
            `;
            avocatPut.appendChild(div);
        }
    }
    
    document.getElementById('ems_intervention').checked = data.ems_intervention || false;
    document.getElementById('nourriture_demandee').checked = data.nourriture_demandee || false;

    // Cellule
    document.getElementById('heure_cellule').value = data.heure_cellule || '';

    // Textareas
    document.getElementById('objets_confisques').value = data.objets_confisques || '';
    document.getElementById('recit').value = data.recit || '';

    // Listes (Agents, Civils, Suspects)
    renderList('selectedAgents', data.agents_impliques);
    renderList('selectedCivils', data.civils_impliques);
    renderList('selectedSuspects', data.suspects_impliques);

    // Photos / Preuves
    const attachmentsContainer = document.getElementById('attachmentsPreview');
    const photos = data.photos_urls || data.attachments || [];
    if (photos.length > 0) {
        photos.forEach(url => {
            const div = document.createElement('div');
            div.className = 'attachment-item';
            const img = document.createElement('img');
            img.src = url;
            img.onclick = () => window.open(url, '_blank');
            div.appendChild(img);
            attachmentsContainer.appendChild(div);
        });
    } else {
        attachmentsContainer.innerHTML = '<p style="color:#7f8c8d;">Aucune photo jointe</p>';
    }
}

function renderList(containerId, items) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (!items || items.length === 0) {
        container.innerHTML = '<p style="color:#7f8c8d; font-style:italic;">Aucun</p>';
        return;
    }

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'selected-item';
        div.style.cursor = 'pointer';
        let label = item.name || item.nom_complet || 'Inconnu';
        div.innerHTML = `<span>${label}</span>`;

        // Routing logic
        if (containerId === 'selectedAgents' && item.id) {
            div.onclick = () => {
                window.location.href = `/infos-agent?userId=${item.id}`;
            };
        } else if ((containerId === 'selectedCivils' || containerId === 'selectedSuspects') && item.id) {
            div.onclick = () => {
                window.location.href = `/view-citoyen.html?id=${item.id}`;
            };
        }

        container.appendChild(div);
    });
}
