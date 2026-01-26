let editBy = null;
let userInfo = null;
let agentsSelector;
let currentAgents = [];

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loaderOverlay').style.display = 'flex';
    fetch("/api/user")
        .then((res) => res.json())
        .then((user) => {
            editBy = user.username || 'Utilisateur inconnu';
            userInfo = user;

            if (user.isDOJ && !user.isLSPD && !user.isSuperAdmin) {
                const updateButton = document.querySelector(".send-button");
                if (updateButton) updateButton.style.display = 'none';

                const inputs = document.querySelectorAll('input, textarea, select');
                inputs.forEach(input => {
                    input.readOnly = true;
                    input.disabled = true;
                    input.style.backgroundColor = '#f5f5f5';
                    input.style.cursor = 'not-allowed';
                });

                const selectAgentsBtn = document.getElementById('selectAgentsBtn');
                if (selectAgentsBtn) selectAgentsBtn.style.display = 'none';
            } else {
                initAgentSelector();
            }

            // Charger l'incident APRÈS avoir défini userInfo
            loadIncidentDetail();
        })
        .catch((err) => {
            console.error("Erreur chargement utilisateur :", err);
            // Charger quand même l'incident en cas d'erreur
            loadIncidentDetail();
        });
});

const urlParams = new URLSearchParams(window.location.search);
const id = urlParams.get('id');
if (!id) {
    showAnimation('error').then(() => window.location.href = '/liste-incidents');
}

if (id) {
    document.title = `Rapport d'incident - ${id}`;
    const titres = document.querySelectorAll('h1, h3');
    titres.forEach(el => el.textContent = `RAPPORT D'INCIDENT - ${id}`);
} else {
    document.title = "Rapport d'incident - Aucun ID";
}

const officierInput = document.getElementById('officier');
const gradeInput = document.getElementById('grade');
const dateInput = document.getElementById('date');
const heureInput = document.getElementById('heure');
const recitInput = document.getElementById('recit');
const typeInput = document.getElementById('type');
const lieuInput = document.getElementById('lieu');
let discord_thread_id = null;
let messageId = null;

function enableFullscreenOnImages() {
    const overlay = document.getElementById('fullscreenOverlay');
    const fullscreenImg = document.getElementById('fullscreenImage');
    const closeBtn = document.getElementById('fullscreenClose');

    document.querySelectorAll('#incidents-container img').forEach(img => {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', () => {
            fullscreenImg.src = img.src;
            overlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        });
    });

    closeBtn.addEventListener('click', () => {
        overlay.style.display = 'none';
        fullscreenImg.src = '';
        document.body.style.overflow = '';
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.display = 'none';
            fullscreenImg.src = '';
            document.body.style.overflow = '';
        }
    });
}

// Initialiser le sélecteur d'agents
function initAgentSelector() {
    agentsSelector = new GenericSelectorModal({
        triggerBtnId: 'selectAgentsBtn',
        containerId: 'agents-impliques-container',
        hiddenInputId: 'agents_json_hidden',
        modalTitle: 'Sélectionner un agent',
        searchPlaceholder: 'Rechercher un agent LSPD...',
        apiEndpoint: '/api/discord/members',
        itemLabelKey: 'displayName',
        itemValueKey: 'id',
        renderItem: (agent) => {
            const matricule = agent.displayName.match(/\[(\d+)\]/);
            const matriculeText = matricule ? `${matricule[1]} | ` : '';
            const nom = agent.displayName.replace(/\[\d+\]\s*/, '');
            return `${matriculeText}${nom}`;
        }
    });

    const originalAddItem = agentsSelector.addItem.bind(agentsSelector);
    agentsSelector.addItem = function (item) {
        if (!currentAgents.find(a => a.agent_discord_id === item.id)) {
            currentAgents.push({
                agent_discord_id: item.id,
                agent_nom: item.displayName.split(' ').slice(1).join(' ') || item.displayName,
                agent_prenom: item.displayName.split(' ')[0] || '',
                agent_matricule: item.displayName.match(/\[(\d+)\]/)?.[1] || ''
            });
            renderAgents();
        }
        agentsSelector.close();
    };
}

// Afficher les agents avec possibilité de suppression
function renderAgents() {
    const container = document.getElementById('agents-impliques-container');
    if (!container) return;

    // Vérifier si l'utilisateur est DOJ (lecture seule) UNE SEULE FOIS
    const isDOJ = userInfo && userInfo.isDOJ && !userInfo.isLSPD && !userInfo.isSuperAdmin;

    container.innerHTML = '';
    container.className = 'selected-list';

    if (currentAgents.length === 0) {
        container.className = '';
        const noAgent = document.createElement('p');
        noAgent.className = 'no-agents-text';
        noAgent.textContent = 'Aucun agent impliqué';
        container.appendChild(noAgent);
        return;
    }

    currentAgents.forEach((agent, index) => {
        const div = document.createElement('div');
        div.className = 'selected-item';

        const agentName = `${agent.agent_prenom || ''} ${agent.agent_nom || ''}`.trim() || 'Agent inconnu';
        const matricule = agent.agent_matricule || '';
        const label = matricule ? `${matricule} | ${agentName}` : agentName;

        const span = document.createElement('span');
        span.textContent = label;
        span.style.cursor = 'pointer';
        span.onclick = () => {
            if (agent.agent_discord_id) {
                window.location.href = `/infos-agent?userId=${agent.agent_discord_id}`;
            }
        };

        div.appendChild(span);

        // Ajouter le bouton × seulement si l'utilisateur n'est pas DOJ
        if (!isDOJ) {
            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove-btn';
            removeBtn.innerHTML = '×';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                removeAgent(index);
            };
            div.appendChild(removeBtn);
        }

        container.appendChild(div);
    });
}

// Retirer un agent
function removeAgent(index) {
    currentAgents.splice(index, 1);
    renderAgents();
}

// Chargement des informations depuis la bdd
async function loadIncidentDetail() {
    const loader = document.getElementById('loaderOverlay');
    loader.style.display = 'flex';
    try {
        const res = await fetch(`/api/getIncident?id=${id}&includeImages=true`);
        if (!res.ok) throw new Error('Erreur chargement');
        const incidents = await res.json();
        const incident = incidents[0];
        if (!incident) throw new Error('Incident non trouvé');

        officierInput.value = incident.officier || '';
        gradeInput.value = incident.grade || '';
        dateInput.value = incident.date || '';
        heureInput.value = incident.heure || '';
        recitInput.value = incident.recit || '';
        typeInput.value = incident.type || '';
        lieuInput.value = incident.lieu || '';
        discord_thread_id = incident.threadId || null;
        messageId = incident.messageId || null;

        const container = document.getElementById('incidents-container');
        container.innerHTML = '';

        if (incident.images && incident.images.length > 0) {
            const imgElements = incident.images.map(url => {
                const img = document.createElement('img');
                img.src = url;
                img.alt = 'Pièce jointe';
                img.style.maxWidth = '200px';
                img.style.margin = '5px';
                container.appendChild(img);
                return img;
            });

            await Promise.all(imgElements.map(img => new Promise((resolve) => {
                if (img.complete) {
                    resolve();
                } else {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                }
            })));

            enableFullscreenOnImages();
        } else {
            container.textContent = 'Aucune pièce jointe disponible.';
        }

        // Charger les agents
        if (incident.agents_impliques && incident.agents_impliques.length > 0) {
            currentAgents = incident.agents_impliques.map(agent => ({
                agent_discord_id: agent.agent_discord_id,
                agent_nom: agent.agent_nom || '',
                agent_prenom: agent.agent_prenom || '',
                agent_matricule: agent.agent_matricule || ''
            }));
            renderAgents();
        } else if (incident.implique && incident.implique.trim() !== '') {
            // Ancien système
            const agentsContainer = document.getElementById('agents-impliques-container');
            if (agentsContainer) {
                agentsContainer.className = '';
                agentsContainer.innerHTML = '';
                const matriculesText = document.createElement('p');
                matriculesText.className = 'old-matricules-text';
                matriculesText.textContent = incident.implique;
                agentsContainer.appendChild(matriculesText);
            }
        } else {
            renderAgents();
        }

    } catch (err) {
        console.error(err);
    } finally {
        loader.style.display = 'none';
    }
}

async function waitForImagesToLoad(container) {
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(images.map(img => {
        if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
        return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
        });
    }));
}

document.querySelector(".send-button").addEventListener("click", async (e) => {
    e.preventDefault();
    const loader = document.getElementById('loaderOverlay');
    loader.style.display = 'flex';

    const originalContainer = document.querySelector(".incident-container");
    if (!originalContainer) {
        showNotification("Erreur : div .incident-container introuvable.", 'error');
        return;
    }
    if (originalContainer.offsetWidth === 0 || originalContainer.offsetHeight === 0) {
        showNotification("Erreur : la div .incident-container est invisible ou a une taille nulle.", 'error');
        return;
    }

    try {
        const clone = originalContainer.cloneNode(true);

        const uploadLabel = clone.querySelector('label[for="pieces"]');
        const uploadWrapper = clone.querySelector(".file-upload-wrapper");
        const attachmentsPreview = clone.querySelector(".attachmentsPreview");
        if (uploadLabel) uploadLabel.remove();
        if (uploadWrapper) uploadWrapper.remove();
        if (attachmentsPreview) attachmentsPreview.remove();

        clone.style.backgroundColor = "#fff";
        clone.style.padding = "40px 50px 100px";
        clone.style.border = "none";
        clone.style.boxShadow = "none";

        const fields = clone.querySelectorAll("input, textarea, select");
        fields.forEach((el) => {
            el.style.backgroundColor = "#f9fafc";
            el.style.border = "1px solid #c5cbd5";
            el.style.borderRadius = "8px";
            el.style.color = "#0b1b5a";
            el.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
            el.style.fontSize = "15px";
            el.style.padding = "10px";
            el.style.boxShadow = "none";
            el.style.resize = "none";
            el.style.width = "100%";
        });

        document.body.appendChild(clone);
        await waitForImagesToLoad(clone);

        const canvas = await html2canvas(clone, { backgroundColor: "#fff" });
        document.body.removeChild(clone);

        if (!canvas) throw new Error("html2canvas n'a pas généré de canvas.");
        const imgData = canvas.toDataURL("image/png");
        if (!imgData || imgData === "data:,") throw new Error("image vide générée !");

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        const pdfBlob = pdf.output("blob");

        const formDataPut = new FormData();
        formDataPut.append("incidentId", id);
        formDataPut.append("date", dateInput.value);
        formDataPut.append("heure", heureInput.value);
        formDataPut.append("officier", officierInput.value);
        formDataPut.append("grade", gradeInput.value);
        formDataPut.append("recit", recitInput.value);
        formDataPut.append("type", typeInput.value);
        formDataPut.append("lieu", lieuInput.value);
        formDataPut.append("discord_thread_id", discord_thread_id || null);
        formDataPut.append("messageId", messageId || null);
        formDataPut.append("pieces", pdfBlob, `incident_${id}.pdf`);
        formDataPut.append("editBy", editBy || 'Utilisateur inconnu');

        // Envoyer les agents impliqués
        const agentsData = currentAgents.map(agent => ({
            id: agent.agent_discord_id,
            nom: agent.agent_nom,
            prenom: agent.agent_prenom,
            matricule: agent.agent_matricule
        }));
        formDataPut.append("agents_impliques", JSON.stringify(agentsData));

        const res = await fetch('/api/updateIncident', {
            method: 'PUT',
            body: formDataPut
        });

        if (!res.ok) throw new Error('Erreur lors de la mise à jour');
        const data = await res.json();
        showAnimation('success').then(() => {
            window.location.href = `/viewIncident?id=${id}`;
        });
    } catch (err) {
        console.error(err);
        showAnimation('error');
    } finally {
        loader.style.display = 'none';
    }
});

// loadIncidentDetail(); // Maintenant appelé dans DOMContentLoaded après chargement de userInfo

function showAnimation(type = 'success') {
    return new Promise((resolve) => {
        const container = document.getElementById('feedbackAnimation');
        container.innerHTML = '';

        const content = document.createElement('div');
        content.className = 'feedback-inner';

        if (type === 'success') {
            content.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
          <circle class="path circle" fill="none" stroke="#0b1b5a" stroke-width="8" cx="65.1" cy="65.1" r="60"/>
          <polyline class="path check" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-linecap="round" points="100.2,40.2 51.5,88.8 29.8,67.5"/>
        </svg>
        <p class="success">Rapport d'incident soumis avec succès!</p>
      `;
        } else {
            content.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
          <circle class="path circle" fill="none" stroke="#D06079" stroke-width="8" cx="65.1" cy="65.1" r="60"/>
          <line class="path line" fill="none" stroke="#D06079" stroke-width="8" x1="34.4" y1="37.9" x2="95.8" y2="92.3"/>
          <line class="path line" fill="none" stroke="#D06079" stroke-width="8" x1="95.8" y1="38" x2="34.4" y2="92.2"/>
        </svg>
        <p class="error">Erreur lors de la soumission du rapport d'incident</p>
      `;
        }

        container.appendChild(content);
        container.style.display = 'flex';

        setTimeout(() => resolve(), 1800);
    });
}

(function () {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        const btn = document.getElementById('backlinkBtn');
        if (!btn) return;

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = '/liste-incidents';
            }
        });
    }
})();
