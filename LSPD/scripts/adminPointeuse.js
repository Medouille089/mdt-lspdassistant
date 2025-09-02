async function loadRoles() {
  const res = await fetch('/config/pointeuse');
  if (!res.ok) {
    alert("Erreur lors du chargement des rôles");
    return;
  }
  const data = await res.json();
  const tbody = document.getElementById('roles-body');
  tbody.innerHTML = '';
  data.forEach(role => {
    const tr = document.createElement('tr');
    tr.dataset.id = role.id;  // <-- ajout de l'attribut data-id pour update/delete
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
    alert("Tous les champs doivent être remplis correctement.");
    return;
  }

  const res = await fetch('/config/pointeuse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, discord_role_id, role_name, salary_rate, rank }),
  });

  if (!res.ok) {
    alert("Erreur lors de la modification");
    return;
  }

  alert("Rôle modifié avec succès");
  await loadRoles();
}

async function deleteRole(roleId) {
  if (!confirm("Supprimer ce rôle ?")) return;

  const res = await fetch(`/config/pointeuse/${roleId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    alert("Erreur lors de la suppression du rôle");
    return;
  }

  await loadRoles();
}

async function loadUsersWithSalary() {
  const res = await fetch('/admin/users-salaries');
  if (!res.ok) {
    alert("Erreur lors du chargement des utilisateurs");
    return;
  }
  const users = await res.json();
  const tbody = document.getElementById('users-salary-body');
  tbody.innerHTML = '';

  for (const user of users) {
    // Récupère le pseudo Discord
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
  if (!confirm("Supprimer toutes les données de cet utilisateur ?")) return;
  const res = await fetch('/admin/pointeuse/users/' + userId, { method: 'DELETE' });
  if (!res.ok) {
    alert("Erreur lors de la suppression de l'utilisateur");
    return;
  }
  await loadUsersWithSalary();
}

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
    alert("Tous les champs doivent être remplis correctement.");
    return;
  }

  const res = await fetch('/config/pointeuse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    alert("Erreur lors de l'ajout / modification");
    return;
  }

  e.target.reset();
  await loadRoles();
});


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

async function saveAlertTime() {
  const btn = document.getElementById('saveAlertTimeBtn');
  const status = document.getElementById('alertTimeStatus');
  const heure = document.getElementById('alertTime').value;

  if (!heure) {
    alert("Veuillez sélectionner une heure valide.");
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

    status.style.display = 'inline';
    setTimeout(() => {
      status.style.display = 'none';
    }, 2000);
  } catch (err) {
    alert("Erreur lors de la sauvegarde de l'heure.");
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

document.getElementById('saveAlertTimeBtn').addEventListener('click', e => {
  e.preventDefault();
  saveAlertTime();
});

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


async function getDisplayName(discordId) {
  try {
    const res = await fetch(`/api/user/${discordId}`);
    if (!res.ok) return discordId; // fallback à l'id si erreur
    const data = await res.json();
    return data.displayName || discordId;
  } catch {
    return discordId;
  }
}

async function loadActivePointeuses() {
  const res = await fetch("/admin/pointeuses-actives");
  if (!res.ok) {
    alert("Erreur lors du chargement des pointeuses actives");
    return;
  }
  const data = await res.json();

  const tbody = document.getElementById("active-pointeuses-body");
  tbody.innerHTML = "";

  // Récupérer les displayNames pour chaque user (parallélisation)
  const usersWithDisplayName = await Promise.all(
    data.map(async (user) => {
      const displayName = await getDisplayName(user.discord_id);
      return { ...user, displayName };
    })
  );

  // Construire la table
  usersWithDisplayName.forEach(user => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${user.displayName}</td>
      <td>${user.discord_id}</td>
      <td><button onclick="forceStopPointeuse('${user.discord_id}')">Forcer arrêt</button></td>
    `;

    tbody.appendChild(tr);
  });
}

async function forceStopPointeuse(discordId) {
  if (!confirm("Êtes-vous sûr de vouloir forcer l'arrêt de cette pointeuse ?")) return;

  const res = await fetch(`/admin/pointeuse/stop/${discordId}`, {
    method: "POST"
  });

  if (res.ok) {
    alert("Pointeuse arrêtée !");
    loadActivePointeuses();
  } else {
    const err = await res.json();
    alert("Erreur : " + err.error);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  loadActivePointeuses();
});

loadRoles();
loadUsersWithSalary();