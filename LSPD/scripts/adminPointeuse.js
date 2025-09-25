// --------------------
// FEEDBACK / ANIMATION
// --------------------
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

// --------------------
// CHARGEMENT HEURE ALERTE
// --------------------
async function loadAlertTime() {
    try {
        const res = await fetch('/config/pointeuse/heure');
        if (!res.ok) throw new Error("Erreur chargement heure");
        const data = await res.json();
        if (data.heure_pointeuse_alerte) {
            document.getElementById('alertTime').value = data.heure_pointeuse_alerte;
        }
    } catch (err) {
        console.warn("Impossible de charger l'heure d'alerte :", err);
    }
}

// --------------------
// GESTION DES ROLES
// --------------------
async function loadRoles() {
    const res = await fetch('/config/pointeuse');
    if (!res.ok) {
        await showAnimation('error', "Erreur lors du chargement des rôles");
        return;
    }
    const data = await res.json();
    const tbody = document.getElementById('roles-body');
    tbody.innerHTML = '';
    data.forEach(role => {
        const tr = document.createElement('tr');
        tr.dataset.id = role.id;
        tr.innerHTML = `
            <td><input type="text" value="${role.discord_role_id}"></td>
            <td><input type="text" value="${role.role_name}"></td>
            <td><input type="number" step="0.01" value="${role.salary_rate}"></td>
            <td><input type="number" value="${role.rank}"></td>
            <td>
                <button onclick="updateRole(this)">Modifier</button>
                <button onclick="deleteRole('${role.id}')">Supprimer</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function updateRole(button) {
    const tr = button.closest('tr');
    const id = tr.dataset.id;
    const discord_role_id = tr.children[0].querySelector('input').value.trim();
    const role_name = tr.children[1].querySelector('input').value.trim();
    const salary_rate = parseFloat(tr.children[2].querySelector('input').value);
    const rank = parseInt(tr.children[3].querySelector('input').value);

    if (!id || !discord_role_id || !role_name || isNaN(salary_rate) || isNaN(rank)) {
        await showAnimation('error', "Tous les champs doivent être remplis correctement.");
        return;
    }

    const confirmed = await customEditConfirm(`Voulez-vous vraiment modifier le rôle "${role_name}" ?`);
    if (!confirmed) return;

    const res = await fetch('/config/pointeuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, discord_role_id, role_name, salary_rate, rank }),
    });

    if (!res.ok) {
        await showAnimation('error', "Erreur lors de la modification du rôle");
        return;
    }

    await showAnimation('success', `Rôle "${role_name}" modifié avec succès !`);
    await loadRoles();
}

async function deleteRole(roleId) {
    const confirmed = await customConfirm("Supprimer ce rôle ?");
    if (!confirmed) return;

    const res = await fetch(`/config/pointeuse/${roleId}`, { method: 'DELETE' });
    if (!res.ok) {
        await showAnimation('error', "Erreur lors de la suppression du rôle");
        return;
    }

    await showAnimation('success', "Rôle supprimé avec succès !");
    await loadRoles();
}

// --------------------
// UTILISATEURS ET SALAIRES
// --------------------
async function loadUsersWithSalary() {
    const res = await fetch('/admin/users-salaries');
    if (!res.ok) {
        await showAnimation('error', "Erreur lors du chargement des utilisateurs");
        return;
    }
    const users = await res.json();
    const tbody = document.getElementById('users-salary-body');
    tbody.innerHTML = '';

    for (const user of users) {
        const userRes = await fetch(`/api/user/${user.discordId}`);
        const userData = await userRes.json();
        const salaryThisWeek = Number(user.salaryThisWeek) || 0;
        const hoursThisWeek = Number(user.hoursThisWeek) || 0;
        const salaryLastWeek = Number(user.salaryLastWeek) || 0;
        const hoursLastWeek = Number(user.hoursLastWeek) || 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${userData.displayName || "Inconnu"}</td>
            <td>${user.discordId}</td>
            <td>${salaryThisWeek.toFixed(2)} $</td>
            <td>${hoursThisWeek.toFixed(2)} h</td>
            <td>${salaryLastWeek.toFixed(2)} $</td>
            <td>${hoursLastWeek.toFixed(2)} h</td>
            <td><button onclick="deleteUser('${user.discordId}')">Supprimer</button></td>
        `;
        tbody.appendChild(tr);
    }
}

async function deleteUser(userId) {
    const confirmed = await customConfirm("Supprimer toutes les données de cet utilisateur ?");
    if (!confirmed) return;

    const res = await fetch('/admin/pointeuse/users/' + userId, { method: 'DELETE' });
    if (!res.ok) {
        await showAnimation('error', "Erreur lors de la suppression de l'utilisateur");
        return;
    }

    await showAnimation('success', "Utilisateur supprimé avec succès !");
    await loadUsersWithSalary();
}

// --------------------
// AJOUT / MODIFICATION ROLE
// --------------------
document.getElementById('add-role-form').addEventListener('submit', async e => {
    e.preventDefault();
    const body = {
        id: document.getElementById('id') ? document.getElementById('id').value.trim() : undefined,
        discord_role_id: document.getElementById('role_id').value.trim(),
        role_name: document.getElementById('role_name').value.trim(),
        salary_rate: parseFloat(document.getElementById('salary_rate').value),
        rank: parseInt(document.getElementById('rank').value),
    };

    if (!body.discord_role_id || !body.role_name || isNaN(body.salary_rate) || isNaN(body.rank)) {
        await showAnimation('error', "Tous les champs doivent être remplis correctement.");
        return;
    }

    const res = await fetch('/config/pointeuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        await showAnimation('error', "Erreur lors de l'ajout / modification du rôle");
        return;
    }

    e.target.reset();
    await showAnimation('success', `Rôle "${body.role_name}" ajouté / modifié avec succès !`);
    await loadRoles();
});

// --------------------
// SAUVEGARDE HEURE ALERTE
// --------------------
async function saveAlertTime() {
    const btn = document.getElementById('saveAlertTimeBtn');
    const status = document.getElementById('alertTimeStatus');
    const heure = document.getElementById('alertTime').value;

    if (!heure) {
        await showAnimation('error', "Veuillez sélectionner une heure valide.");
        return;
    }

    btn.disabled = true;
    status.style.display = 'none';

    try {
        const res = await fetch('/config/pointeuse/heure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ heure }),
        });
        if (!res.ok) throw new Error("Erreur sauvegarde heure");

        await showAnimation('success', `Heure d'alerte pointage mise à jour : ${heure}`);
    } catch (err) {
        await showAnimation('error', "Erreur lors de la sauvegarde de l'heure.");
        console.error(err);
    } finally {
        btn.disabled = false;
    }
}

document.getElementById('saveAlertTimeBtn').addEventListener('click', e => {
    e.preventDefault();
    saveAlertTime();
});

// --------------------
// CONFIRMATION CUSTOM
// --------------------
async function customConfirm(message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customConfirmSend');
        const p = overlay.querySelector('p');
        const btnCancel = overlay.querySelector('.btn-blue');
        const btnConfirm = overlay.querySelector('.btn-red');

        p.textContent = message;
        overlay.style.display = 'flex';

        const cleanup = () => {
            overlay.style.display = 'none';
            btnCancel.removeEventListener('click', onCancel);
            btnConfirm.removeEventListener('click', onConfirm);
        };

        const onCancel = () => { cleanup(); resolve(false); };
        const onConfirm = () => { cleanup(); resolve(true); };

        btnCancel.addEventListener('click', onCancel);
        btnConfirm.addEventListener('click', onConfirm);
    });
}

// CONFIRMATION CUSTOM POUR MODIFIER
async function customEditConfirm(message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customConfirmSend');
        const p = overlay.querySelector('p');
        const btnCancel = overlay.querySelector('.btn-blue');
        const btnConfirm = overlay.querySelector('.btn-red');

        p.textContent = message; // message pour modifier
        overlay.style.display = 'flex';

        // changer les boutons pour "Annuler" / "Confirmer modification"
        btnConfirm.textContent = "Confirmer modification";
        btnCancel.textContent = "Annuler";

        const cleanup = () => {
            overlay.style.display = 'none';
            btnCancel.removeEventListener('click', onCancel);
            btnConfirm.removeEventListener('click', onConfirm);
            btnConfirm.textContent = "Confirmer"; // reset texte
            btnCancel.textContent = "Annuler";     // reset texte
        };

        const onCancel = () => { cleanup(); resolve(false); };
        const onConfirm = () => { cleanup(); resolve(true); };

        btnCancel.addEventListener('click', onCancel);
        btnConfirm.addEventListener('click', onConfirm);
    });
}

// --------------------
// ACTIVE POINTEUSES
// --------------------
async function getDisplayName(discordId) {
    try {
        const res = await fetch(`/api/user/${discordId}`);
        if (!res.ok) return discordId;
        const data = await res.json();
        return data.displayName || discordId;
    } catch {
        return discordId;
    }
}

async function loadActivePointeuses() {
    const res = await fetch("/admin/pointeuses-actives");
    if (!res.ok) {
        await showAnimation('error', "Erreur lors du chargement des pointeuses actives");
        return;
    }
    const data = await res.json();

    const tbody = document.getElementById("active-pointeuses-body");
    tbody.innerHTML = "";

    const usersWithDisplayName = await Promise.all(
        data.map(async (user) => {
            const displayName = await getDisplayName(user.discord_id);
            return { ...user, displayName };
        })
    );

    usersWithDisplayName.forEach(user => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${user.displayName}</td>
            <td>${user.discord_id}</td>
            <td><button onclick="forceStopPointeuse('${user.discord_id}', '${user.displayName}')">Forcer arrêt</button></td>
        `;
        tbody.appendChild(tr);
    });
}

async function forceStopPointeuse(discordId, displayName) {
    const confirmed = await customConfirm(`Êtes-vous sûr de vouloir forcer l'arrêt de la pointeuse de ${displayName} ?`);
    if (!confirmed) return;

    const res = await fetch(`/admin/pointeuse/stop/${discordId}`, { method: "POST" });
    if (!res.ok) {
        const err = await res.json();
        await showAnimation('error', "Erreur : " + (err.error || "Impossible d'arrêter la pointeuse"));
        return;
    }

    await showAnimation('success', `Pointeuse de ${displayName} arrêtée avec succès !`);
    await loadActivePointeuses();
}

// --------------------
// INITIALISATION
// --------------------
document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('loaderOverlay');
    if (loader) loader.style.display = 'flex';

    try {
        await loadRoles();
        await loadUsersWithSalary();
        await loadAlertTime();
        await loadActivePointeuses();
    } catch (err) {
        console.error("Erreur initialisation dashboard :", err);
    } finally {
        if (loader) loader.style.display = 'none';
    }
});
