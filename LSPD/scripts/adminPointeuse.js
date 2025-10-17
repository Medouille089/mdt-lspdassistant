// Fonctions utilitaires pour loader et feedback
function showLoader(show = true) {
  const loader = document.getElementById("loaderOverlay");
  if (loader) loader.style.display = show ? "flex" : "none";
}

function showFeedback(message, isSuccess = true) {
  const feedback = document.getElementById("feedbackAnimation");
  if (!feedback) return;

  feedback.innerHTML = "";
  const content = document.createElement("div");
  content.className = "feedback-inner";

  if (isSuccess) {
    content.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
        <circle class="path circle" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-miterlimit="10" cx="65.1" cy="65.1" r="60"/>
        <polyline class="path check" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" points="100.2,40.2 51.5,88.8 29.8,67.5 "/>
      </svg>
      <p class="success">${message}</p>
    `;
  } else {
    content.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
        <circle class="path circle" fill="none" stroke="#D06079" stroke-width="8" stroke-miterlimit="10" cx="65.1" cy="65.1" r="60"/>
        <line class="path line" fill="none" stroke="#D06079" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" x1="34.4" y1="37.9" x2="95.8" y2="92.3"/>
        <line class="path line" fill="none" stroke="#D06079" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" x1="95.8" y1="38" x2="34.4" y2="92.2"/>
      </svg>
      <p class="error">${message}</p>
    `;
  }

  feedback.appendChild(content);
  feedback.style.display = "flex";

  setTimeout(() => {
    feedback.style.display = "none";
  }, 3000);
}
async function loadRoles() {
  const res = await fetch("/config/pointeuse");
  if (!res.ok) {
    showFeedback("Erreur lors du chargement des rôles", false);
    return;
  }
  const data = await res.json();

  // Trier les rôles par nom (role_name) par ordre alphabétique
  data.sort((a, b) => a.role_name.localeCompare(b.role_name));

  const tbody = document.getElementById("roles-body");
  tbody.innerHTML = "";
  data.forEach((role) => {
    const tr = document.createElement("tr");
    tr.dataset.id = role.id; // <-- ajout de l'attribut data-id pour update/delete
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
  const tr = button.closest("tr");
  const id = tr.dataset.id;
  const discord_role_id = tr.children[0].querySelector("input").value.trim();
  const role_name = tr.children[1].querySelector("input").value.trim();
  const salary_rate = parseFloat(tr.children[2].querySelector("input").value);
  const rank = parseInt(tr.children[3].querySelector("input").value);

  if (
    !id ||
    !discord_role_id ||
    !role_name ||
    isNaN(salary_rate) ||
    isNaN(rank)
  ) {
    showFeedback("Tous les champs doivent être remplis correctement.", false);
    return;
  }

  showLoader(true);
  const res = await fetch("/config/pointeuse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, discord_role_id, role_name, salary_rate, rank }),
  });

  showLoader(false);
  if (!res.ok) {
    showFeedback("Erreur lors de la modification", false);
    return;
  }

  showFeedback("Rôle modifié avec succès", true);
  await loadRoles();
}

async function deleteRole(roleId) {
  if (!confirm("Supprimer ce rôle ?")) return;

  showLoader(true);
  const res = await fetch(`/config/pointeuse/${roleId}`, {
    method: "DELETE",
  });

  showLoader(false);
  if (!res.ok) {
    showFeedback("Erreur lors de la suppression du rôle", false);
    return;
  }

  showFeedback("Rôle supprimé avec succès", true);
  await loadRoles();
}

async function loadUsersWithSalary() {
  const res = await fetch("/admin/users-salaries");
  if (!res.ok) {
    showFeedback("Erreur lors du chargement des utilisateurs", false);
    return;
  }
  const users = await res.json();
  const tbody = document.getElementById("users-salary-body");
  tbody.innerHTML = "";

  // Créer un tableau avec les displayNames pour le tri
  const usersWithDisplayNames = [];

  for (const user of users) {
    // Récupère le pseudo Discord
    const userRes = await fetch(`/api/user/${user.discordId}`);
    const userData = await userRes.json();

    const salaryThisWeek = Number(user.salaryThisWeek) || 0;
    const hoursThisWeek = Number(user.hoursThisWeek) || 0;
    const salaryLastWeek = Number(user.salaryLastWeek) || 0;
    const hoursLastWeek = Number(user.hoursLastWeek) || 0;

    usersWithDisplayNames.push({
      displayName: userData.displayName || "Inconnu",
      discordId: user.discordId,
      salaryThisWeek,
      hoursThisWeek,
      salaryLastWeek,
      hoursLastWeek,
    });
  }

  // Trier par nom d'utilisateur (displayName) par ordre alphabétique
  usersWithDisplayNames.sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  // Créer les lignes du tableau triées
  usersWithDisplayNames.forEach((user) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${user.displayName}</td>
      <td>${user.discordId}</td>
      <td>${user.salaryThisWeek.toFixed(2)} $</td>
      <td>${user.hoursThisWeek.toFixed(2)} h</td>
      <td>${user.salaryLastWeek.toFixed(2)} $</td>
      <td>${user.hoursLastWeek.toFixed(2)} h</td>
      <td id="actionsBtns">
        <button onclick="modifyUser('${user.discordId}')">✏️</button>
        <button onclick="deleteUser('${user.discordId}')">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function deleteUser(userId) {
  if (!confirm("Supprimer toutes les données de cet utilisateur ?")) return;

  showLoader(true);
  const res = await fetch("/admin/pointeuse/users/" + userId, {
    method: "DELETE",
  });
  showLoader(false);

  if (!res.ok) {
    showFeedback("Erreur lors de la suppression de l'utilisateur", false);
    return;
  }

  showFeedback("Utilisateur supprimé avec succès", true);
  await loadUsersWithSalary();
}

// --------------------
// MODIFICATION DES SESSIONS UTILISATEUR
// --------------------
async function modifyUser(userId) {
  try {
    showLoader(true);
    const res = await fetch(`/admin/pointeuse/sessions/${userId}`);
    showLoader(false);

    if (!res.ok) {
      showFeedback("Erreur lors du chargement des sessions", false);
      return;
    }

    const sessions = await res.json();
    await showUserSessionsModal(userId, sessions);
  } catch (err) {
    showLoader(false);
    showFeedback("Erreur lors du chargement des sessions", false);
    console.error(err);
  }
}

async function showUserSessionsModal(userId, sessions) {
  const userRes = await fetch(`/api/user/${userId}`);
  const userData = await userRes.json();
  const displayName = userData.displayName || userId;

  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "user-sessions-modal-overlay";
    modal.innerHTML = `
      <div class="user-sessions-modal">
        <div class="modal-header">
          <h2>Sessions de pointeuse - ${displayName}</h2>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-content">
          <div class="sessions-container">
            ${renderSessionsTable(sessions)}
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel">Annuler</button>
          <button class="btn-save">Sauvegarder les modifications</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector(".modal-close");
    const cancelBtn = modal.querySelector(".btn-cancel");
    const saveBtn = modal.querySelector(".btn-save");

    function closeModal() {
      document.body.removeChild(modal);
      resolve(false);
    }

    async function saveChanges() {
      try {
        showLoader(true);
        const modifiedSessions = getModifiedSessions(modal);

        for (const session of modifiedSessions) {
          const res = await fetch(`/admin/pointeuse/session/${session.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              start_time: session.start_time,
              end_time: session.end_time,
            }),
          });

          if (!res.ok) {
            throw new Error(`Erreur modification session ${session.id}`);
          }
        }

        showLoader(false);
        showFeedback("Sessions modifiées avec succès !", true);
        await loadUsersWithSalary();
        document.body.removeChild(modal);
        resolve(true);
      } catch (err) {
        showLoader(false);
        showFeedback("Erreur lors de la sauvegarde", false);
        console.error(err);
      }
    }

    closeBtn.addEventListener("click", closeModal);
    cancelBtn.addEventListener("click", closeModal);
    saveBtn.addEventListener("click", saveChanges);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  });
}

function renderSessionsTable(sessions) {
  if (sessions.length === 0) {
    return "<p>Aucune session trouvée pour cette semaine et la semaine dernière.</p>";
  }

  const thisWeekSessions = sessions.filter(
    (s) => s.week_type === "cette_semaine"
  );
  const lastWeekSessions = sessions.filter(
    (s) => s.week_type === "semaine_derniere"
  );

  let html = "";

  if (thisWeekSessions.length > 0) {
    html += `
      <h3>Cette semaine (${thisWeekSessions.length} sessions)</h3>
      <table class="sessions-table">
        <thead>
          <tr>
            <th>Début</th>
            <th>Fin</th>
            <th>Durée (h)</th>
            <th>Rôle</th>
            <th>Salaire gagné ($)</th>
          </tr>
        </thead>
        <tbody>
          ${thisWeekSessions
            .map((session) => renderSessionRow(session))
            .join("")}
        </tbody>
      </table>
    `;
  }

  if (lastWeekSessions.length > 0) {
    html += `
      <h3>Semaine dernière (${lastWeekSessions.length} sessions)</h3>
      <table class="sessions-table">
        <thead>
          <tr>
            <th>Début</th>
            <th>Fin</th>
            <th>Durée (h)</th>
            <th>Rôle</th>
            <th>Salaire gagné ($)</th>
          </tr>
        </thead>
        <tbody>
          ${lastWeekSessions
            .map((session) => renderSessionRow(session))
            .join("")}
        </tbody>
      </table>
    `;
  }

  return html;
}

function renderSessionRow(session) {
  const startTime = new Date(session.start_time).toLocaleString("fr-FR");
  const endTime = session.end_time
    ? new Date(session.end_time).toLocaleString("fr-FR")
    : "En cours";
  const hours = parseFloat(session.hours_worked || 0).toFixed(2);
  const salary = parseFloat(session.salary_earned || 0).toFixed(2);

  return `
    <tr data-session-id="${session.id}" data-salary-rate="${
    session.salary_rate || 0
  }">
      <td>
        <input type="datetime-local" class="session-start" value="${formatDateTimeLocal(
          session.start_time
        )}">
      </td>
      <td>
        <input type="datetime-local" class="session-end" value="${
          session.end_time ? formatDateTimeLocal(session.end_time) : ""
        }">
      </td>
      <td class="session-duration">${hours} h</td>
      <td>${session.role_name || "Inconnu"}</td>
      <td class="session-salary-display">
        ${salary} $
      </td>
    </tr>
  `;
}

function formatDateTimeLocal(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);

  const offset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - offset);

  return localDate.toISOString().slice(0, 16);
}

function getModifiedSessions(modal) {
  const modifiedSessions = [];
  const rows = modal.querySelectorAll(".sessions-table tbody tr");

  rows.forEach((row) => {
    const sessionId = row.dataset.sessionId;
    const startInput = row.querySelector(".session-start");
    const endInput = row.querySelector(".session-end");

    if (startInput && endInput) {
      modifiedSessions.push({
        id: sessionId,
        start_time: startInput.value,
        end_time: endInput.value,
      });
    }
  });

  return modifiedSessions;
}

document
  .getElementById("add-role-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {
      id: document.getElementById("id")
        ? document.getElementById("id").value.trim()
        : undefined,
      discord_role_id: document.getElementById("role_id").value.trim(),
      role_name: document.getElementById("role_name").value.trim(),
      salary_rate: parseFloat(document.getElementById("salary_rate").value),
      rank: parseInt(document.getElementById("rank").value),
    };

    if (
      !body.discord_role_id ||
      !body.role_name ||
      isNaN(body.salary_rate) ||
      isNaN(body.rank)
    ) {
      showFeedback("Tous les champs doivent être remplis correctement.", false);
      return;
    }

    showLoader(true);
    const res = await fetch("/config/pointeuse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    showLoader(false);
    if (!res.ok) {
      showFeedback("Erreur lors de l'ajout / modification", false);
      return;
    }

    showFeedback("Rôle ajouté avec succès", true);
    e.target.reset();
    await loadRoles();
  });

async function loadAlertTime() {
  try {
    const res = await fetch("/config/pointeuse/heure");
    if (!res.ok) throw new Error("Erreur chargement heure");
    const data = await res.json();
    if (data.heure_pointeuse_alerte) {
      document.getElementById("alertTime").value = data.heure_pointeuse_alerte;
    }
  } catch (err) {
    console.warn("Impossible de charger l'heure d'alerte :", err);
  }
}

async function saveAlertTime() {
  const btn = document.getElementById("saveAlertTimeBtn");
  const status = document.getElementById("alertTimeStatus");
  const heure = document.getElementById("alertTime").value;

  if (!heure) {
    showFeedback("Veuillez sélectionner une heure valide.", false);
    return;
  }

  btn.disabled = true;
  status.style.display = "none";
  showLoader(true);

  try {
    const res = await fetch("/config/pointeuse/heure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heure }),
    });

    showLoader(false);
    if (!res.ok) throw new Error("Erreur sauvegarde heure");

    showFeedback("Heure d'alerte sauvegardée", true);
  } catch (err) {
    showLoader(false);
    showFeedback("Erreur lors de la sauvegarde de l'heure.", false);
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

document.getElementById("saveAlertTimeBtn").addEventListener("click", (e) => {
  e.preventDefault();
  saveAlertTime();
});

document.addEventListener("DOMContentLoaded", async () => {
  const loader = document.getElementById("loaderOverlay");
  if (loader) loader.style.display = "flex";

  try {
    await loadRoles();
    await loadUsersWithSalary();
    await loadAlertTime();
    await loadActivePointeuses();
  } catch (err) {
    console.error("Erreur initialisation dashboard :", err);
  } finally {
    if (loader) loader.style.display = "none";
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
    showFeedback("Erreur lors du chargement des pointeuses actives", false);
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

  // Trier par nom d'utilisateur (displayName) par ordre alphabétique
  usersWithDisplayName.sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  // Construire la table
  usersWithDisplayName.forEach((user) => {
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
  if (!confirm("Êtes-vous sûr de vouloir forcer l'arrêt de cette pointeuse ?"))
    return;

  showLoader(true);
  const res = await fetch(`/admin/pointeuse/stop/${discordId}`, {
    method: "POST",
  });

  showLoader(false);
  if (res.ok) {
    showFeedback("Pointeuse arrêtée avec succès", true);
    loadActivePointeuses();
  } else {
    const err = await res.json();
    showFeedback("Erreur : " + err.error, false);
  }
}

(function () {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    const btn = document.getElementById("backlinkBtn");
    if (!btn) return;

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "menu-admin-salons.html";
      }
    });
  }
})();
