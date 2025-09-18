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
    }
}

// Charger les rôles de sanction
async function loadSanctionRoles() {
    try {
        const res = await fetch('/api/sanctions/roles');
        allRoles = await res.json();
        renderSanctionRoles();
    } catch (err) {
        console.error("Erreur chargement rôles:", err);
    }
}

// Rendu des rôles (filtrés si un agent est sélectionné)
function renderSanctionRoles(agentId = null) {
    const select = document.getElementById('type');
    select.innerHTML = '<option value="">-- Choisir un type de sanction --</option>';

    let rolesToDisplay = [...allRoles];

    if (agentId) {
        const agent = agentsCache.find(a => a.discord_id === agentId);
        if (agent) {
            const rolesDiscord = agent.roles || [];
            rolesToDisplay = rolesToDisplay.filter(r => !rolesDiscord.includes(r.id_discord));
        }
    }

    rolesToDisplay.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id_discord;
        opt.textContent = r.nom;
        select.appendChild(opt);
    });
}

// DOMContentLoaded
document.addEventListener("DOMContentLoaded", async () => {
    const loader = document.getElementById("loaderOverlay");
    loader.style.display = "flex"; // afficher loader

    try {
        // Charger utilisateur
        const userRes = await fetch("/api/user");
        const user = await userRes.json();
        document.getElementById("officier").value = user.username;
        document.getElementById("grade").value = user.grade;
    } catch (err) {
        console.error("Erreur chargement utilisateur :", err);
        document.getElementById("officier").value = "Erreur de chargement";
        document.getElementById("grade").value = "";
    } finally {
        loader.style.display = "none"; // cacher loader après fetch
    }

    // Charger agents et rôles (loader géré uniquement au début)
    await loadAgents();
    await loadSanctionRoles();

    // Gestion du changement d'agent
    document.getElementById('agent').addEventListener('change', (e) => {
        const agentId = e.target.value;
        renderSanctionRoles(agentId || null);
    });

    // Gestion du formulaire
    document.getElementById('sanctionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const player_id = document.getElementById('agent').value;
        const type = document.getElementById('type').value;
        const date_from = document.getElementById('start_date').value;
        const date_end = document.getElementById('end_date').value;
        const reason = document.getElementById('reason').value;

        if (!player_id || !type || !reason || !date_from) {
            return alert('Merci de remplir tous les champs obligatoires.');
        }

        try {
            loader.style.display = "flex"; // loader pendant l'envoi

            const grade = document.getElementById('grade').value;
            const res = await fetch('/api/sanctions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id, type, reason, date_from, date_end, grade })
            });

            const data = await res.json();
            if (res.ok) {
                alert('Sanction appliquée !');

                // Reset des champs
                document.getElementById('reason').value = '';
                document.getElementById('start_date').value = new Date().toISOString().split('T')[0];
                document.getElementById('end_date').value = '';

                // Recharger agents et rôles
                await loadAgents();
                await loadSanctionRoles();

                // Garder l’agent sélectionné et réactualiser ses sanctions
                const agentSelect = document.getElementById('agent');
                agentSelect.value = player_id;
                renderSanctionRoles(player_id);
            } else {
                alert('Erreur: ' + data.error);
            }
        } catch (err) {
            console.error(err);
            alert('Erreur serveur');
        } finally {
            loader.style.display = "none"; // cacher loader
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
