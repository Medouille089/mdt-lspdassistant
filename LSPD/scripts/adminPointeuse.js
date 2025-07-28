document.addEventListener('DOMContentLoaded', async () => {
    const loader = document.getElementById('loaderOverlay');
    if (loader) loader.style.display = 'flex';

    try {
        await loadRoles();
        await loadUsersWithSalary();
    } catch (err) {
        console.error("Erreur initialisation dashboard :", err);
    } finally {
        if (loader) loader.style.display = 'none';
    }
});

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
        tr.innerHTML = `
      <td><input type="text" value="${role.discord_role_id}"></td>
      <td><input type="text" value="${role.role_name}"></td>
      <td><input type="number" step="0.01" value="${role.salary_rate}"></td>
      <td><input type="number" value="${role.rank}"></td>
      <td>
        <button onclick="updateRole(this)">Modifier</button>
        <button onclick="deleteRole('${role.discord_role_id}')">Supprimer</button>
      </td>
    `;
        tbody.appendChild(tr);
    });
}

async function updateRole(button) {
    const tr = button.closest('tr');
    const role_id = tr.children[0].querySelector('input').value.trim();
    const role_name = tr.children[1].querySelector('input').value.trim();
    const salary_rate = parseFloat(tr.children[2].querySelector('input').value);
    const rank = parseInt(tr.children[3].querySelector('input').value);

    if (!role_id || !role_name || isNaN(salary_rate) || isNaN(rank)) {
        alert("Tous les champs doivent être remplis correctement.");
        return;
    }

    const res = await fetch('/config/pointeuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id, role_name, salary_rate, rank }),
    });

    if (!res.ok) {
        alert("Erreur lors de la modification");
        return;
    }

    alert("Rôle modifié avec succès");
    loadRoles();
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
    const res = await fetch('/admin/pointeuse/users');
    if (!res.ok) {
        alert("Erreur lors du chargement des utilisateurs");
        return;
    }
    const users = await res.json();
    const tbody = document.getElementById('users-salary-body');
    tbody.innerHTML = '';

    users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${user.display_name}</td>
          <td>${user.id_discord}</td>
          <td>${user.total_current_week.toFixed(2)} $</td>
          <td>${user.total_last_week.toFixed(2)} $</td>
          <td><button onclick="deleteUser('${user.id_discord}')">Supprimer</button></td>
        `;
        tbody.appendChild(tr);
    });
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
        role_id: document.getElementById('role_id').value.trim(),
        role_name: document.getElementById('role_name').value.trim(),
        salary_rate: parseFloat(document.getElementById('salary_rate').value),
        rank: parseInt(document.getElementById('rank').value),
    };

    const res = await fetch('/config/pointeuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        alert("Erreur lors de l'ajout / modification");
        return;
    }

    e.target.reset();
    await loadRoles();
});

loadRoles();
loadUsersWithSalary();