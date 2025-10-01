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

    // Formulaire
    document.getElementById('convocationForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const agentId = document.getElementById('agent').value;
        const date = document.getElementById('date').value;
        const lieu = document.getElementById('lieu').value;
        const raison = document.getElementById('raison').value;
        const officier = document.getElementById('officier').value;
        const grade = document.getElementById('grade').value;

        if (!agentId || !date || !lieu || !raison) {
            return showAnimation('error', "Veuillez remplir tous les champs obligatoires");
        }

        // Popup confirmation
        const confirmed = await showConfirm('send');
        if (!confirmed) return;

        try {
            loader.style.display = "flex";

            const res = await fetch('/api/convocations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId, date, lieu, raison, officier, grade })
            });

            const data = await res.json();

            if (res.ok) {
                await showAnimation('success', "La convocation a été envoyée avec succès !");

                // Reset champs
                document.getElementById('lieu').value = '';
                document.getElementById('raison').value = '';
                document.getElementById('date').value = new Date().toISOString().split('T')[0];

                await loadAgents();
                document.getElementById('agent').value = agentId;
            } else {
                await showAnimation('error', data.error || "Erreur lors de l'envoi de la convocation");
            }
        } catch (err) {
            console.error(err);
            await showAnimation('error', "Erreur serveur lors de l'envoi de la convocation");
        } finally {
            loader.style.display = "none";
        }
    });

    // Date → min = aujourd'hui
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('date');
    dateInput.value = today;
    dateInput.min = today;
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
