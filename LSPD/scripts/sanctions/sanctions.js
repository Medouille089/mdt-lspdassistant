let allRoles = [];
let agentsCache = [];

// Charger les agents
async function loadAgents() {
    try {
        const res = await fetch('/api/agents');
        const agents = await res.json();
        agentsCache = agents;
        const select = document.getElementById('agent');
        select.innerHTML = '<option value="">-- Choisir un agent --</option>';

        agents.sort((a, b) => a.username.localeCompare(b.username))
            .forEach(a => {
                const opt = document.createElement('option');
                opt.value = a.discord_id;
                opt.textContent = a.username;
                select.appendChild(opt);
            });
    } catch (err) {
        console.error("Erreur chargement agents:", err);
        await showAnimation('error', "Impossible de charger la liste des agents");
    }
}

// Charger les rôles de sanction
async function loadSanctionRoles() {
    try {
        const res = await fetch('/api/sanctions/roles');
        const roles = await res.json();
        allRoles = roles;

        const typeSelect = document.getElementById('type');
        typeSelect.innerHTML = '<option value="">-- Choisir un type de sanction --</option>';

        roles.forEach(role => {
            const opt = document.createElement('option');
            opt.value = role.id_discord;
            opt.textContent = role.nom;
            typeSelect.appendChild(opt);
        });
    } catch (err) {
        console.error("Erreur chargement rôles sanctions:", err);
        await showAnimation('error', "Impossible de charger les types de sanction");
    }
}

// Afficher les sanctions d’un agent sélectionné
// Afficher les sanctions d’un agent sélectionné
function renderSanctionRoles(agentId) {
    const agent = agentsCache.find(a => a.discord_id === agentId);
    const typeSelect = document.getElementById('type');

    typeSelect.innerHTML = '<option value="">-- Choisir un type de sanction --</option>';

    if (!agent) return;

    // Filtrer les rôles que l'agent n'a pas déjà
    const availableRoles = allRoles.filter(role => !agent.roles.includes(role.id_discord));

    availableRoles.forEach(role => {
        const opt = document.createElement('option');
        opt.value = role.id_discord;
        opt.textContent = role.nom;
        typeSelect.appendChild(opt);
    });

    typeSelect.value = '';
}

// ----------------- DOMContentLoaded -----------------
document.addEventListener("DOMContentLoaded", async () => {
    const loader = document.getElementById("loaderOverlay");
    loader.style.display = "flex";

    try {
        const userRes = await fetch("/api/user");
        const user = await userRes.json();
        document.getElementById("officier").value = user.username;
        document.getElementById("grade").value = user.grade;
    } catch (err) {
        console.error("Erreur chargement utilisateur :", err);
        document.getElementById("officier").value = "Erreur de chargement";
        document.getElementById("grade").value = "";
        await showAnimation('error', "Impossible de charger les informations de l'utilisateur");
    } finally {
        loader.style.display = "none";
    }

    await loadAgents();
    await loadSanctionRoles();

    document.getElementById('agent').addEventListener('change', (e) => {
        renderSanctionRoles(e.target.value || null);
    });

    // Formulaire
    document.getElementById('sanctionForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const player_id = document.getElementById('agent').value;
        const type = document.getElementById('type').value;
        const date_from = document.getElementById('start_date').value;
        const date_end = document.getElementById('end_date').value;
        const reason = document.getElementById('reason').value;

        if (!player_id || !type || !reason || !date_from) {
            return showAnimation('error', "Veuillez remplir tous les champs obligatoires");
        }

        // Popup confirmation
        const confirmed = await showConfirm('send');
        if (!confirmed) return;

        try {
            loader.style.display = "flex";
            const grade = document.getElementById('grade').value;

            const res = await fetch('/api/sanctions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id, type, reason, date_from, date_end, grade })
            });

            const data = await res.json();

            if (res.ok) {
                await showAnimation('success', "La sanction a été appliquée avec succès !");

                // Reset champs
                document.getElementById('reason').value = '';
                document.getElementById('start_date').value = new Date().toISOString().split('T')[0];
                document.getElementById('end_date').value = '';

                await loadAgents();
                await loadSanctionRoles();

                const agentSelect = document.getElementById('agent');
                agentSelect.value = player_id;
                renderSanctionRoles(player_id);
            } else {
                await showAnimation('error', data.error || "Erreur lors de l'application de la sanction");
            }
        } catch (err) {
            console.error(err);
            await showAnimation('error', "Erreur serveur lors de l'application de la sanction");
        } finally {
            loader.style.display = "none";
        }
    });

    // Dates → min = aujourd'hui
    const today = new Date().toISOString().split('T')[0];
    const startInput = document.getElementById('start_date');
    const endInput = document.getElementById('end_date');
    startInput.value = today;
    startInput.min = today;
    endInput.min = today;

    startInput.addEventListener('change', () => {
        endInput.min = startInput.value;
    });
});

// ----------------- Popups et animations -----------------
function showAnimation(type = 'success', message = '') {
    return new Promise((resolve) => {
        const container = document.getElementById('feedbackAnimation');
        container.innerHTML = '';

        const content = document.createElement('div');
        content.className = 'feedback-inner';

        if (type === 'success') {
            content.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2" width="100" height="100">
                    <circle class="path circle" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-miterlimit="10" cx="65.1" cy="65.1" r="60"/>
                    <polyline class="path check" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" points="100.2,40.2 51.5,88.8 29.8,67.5 "/>
                </svg>
                <p class="success">${message || 'Opération réussie !'}</p>
            `;
        } else {
            content.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2" width="100" height="100">
                    <circle class="path circle" fill="none" stroke="#D06079" stroke-width="8" stroke-miterlimit="10" cx="65.1" cy="65.1" r="60"/>
                    <line class="path line" fill="none" stroke="#D06079" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" x1="34.4" y1="37.9" x2="95.8" y2="92.3"/>
                    <line class="path line" fill="none" stroke="#D06079" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" x1="95.8" y1="38" x2="34.4" y2="92.2"/>
                </svg>
                <p class="error">${message || "Erreur lors de l'opération"}</p>
            `;
        }

        container.appendChild(content);
        container.style.display = 'flex';

        setTimeout(() => {
            container.style.display = 'none';
            container.innerHTML = '';
            resolve();
        }, 1800);
    });
}

function showConfirm(type = 'send') {
    return new Promise((resolve) => {
        const overlay = document.getElementById(`customConfirm${type.charAt(0).toUpperCase() + type.slice(1)}`);
        overlay.style.display = 'flex';

        const cancelBtn = overlay.querySelector('.btn-blue');
        const confirmBtn = overlay.querySelector('.btn-red');

        function cleanup() {
            overlay.style.display = 'none';
            cancelBtn.removeEventListener('click', onCancel);
            confirmBtn.removeEventListener('click', onConfirm);
        }

        function onCancel() {
            cleanup();
            resolve(false);
        }
        function onConfirm() {
            cleanup();
            resolve(true);
        }

        cancelBtn.addEventListener('click', onCancel);
        confirmBtn.addEventListener('click', onConfirm);
    });
}
