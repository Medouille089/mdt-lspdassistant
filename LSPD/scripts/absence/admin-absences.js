// Variables globales
let currentDate = new Date();
let allAbsences = [];
let filteredAbsences = [];
let currentAbsenceId = null;
let pendingStatusChange = null;

// Initialisation
document.addEventListener("DOMContentLoaded", function () {
  initializePage();
});

async function initializePage() {
  try {
    showLoading(); // Affiche le loader dès le départ
    await loadStats();
    await loadAbsences();
    generateCalendar();
    displayRequests();
    setupEventListeners();
  } catch (error) {
    console.error("Erreur lors de l'initialisation:", error);
    showError("Erreur lors du chargement des données");
  } finally {
    hideLoading(); // Cache le loader une fois tout chargé
  }
}

// Chargement des statistiques
async function loadStats() {
  try {
    const response = await fetch("/api/absence/stats");
    if (!response.ok)
      throw new Error("Erreur lors du chargement des statistiques");

    const stats = await response.json();

    document.getElementById("total-absences").textContent =
      stats.total_absences || 0;
    document.getElementById("pending-absences").textContent =
      stats.en_attente || 0;
    document.getElementById("approved-absences").textContent =
      stats.approuvees || 0;
    document.getElementById("rejected-absences").textContent =
      stats.refusees || 0;
  } catch (error) {
    console.error("Erreur stats:", error);
  }
}

// Chargement des absences
async function loadAbsences() {
  try {
    const response = await fetch("/api/absence");
    if (!response.ok) throw new Error("Erreur lors du chargement des absences");

    allAbsences = await response.json();
    filteredAbsences = [...allAbsences];
  } catch (error) {
    console.error("Erreur chargement absences:", error);
    showError("Erreur lors du chargement des absences");
  }
}

// Génération du calendrier
function generateCalendar() {
  const calendar = document.getElementById("calendar-grid");
  const monthYear = document.getElementById("current-month-year");

  // Mise à jour du titre
  const months = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ];
  monthYear.textContent = `${
    months[currentDate.getMonth()]
  } ${currentDate.getFullYear()}`;

  // Vider le calendrier
  calendar.innerHTML = "";

  // Headers des jours
  const dayHeaders = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  dayHeaders.forEach((day) => {
    const header = document.createElement("div");
    header.className = "calendar-day-header";
    header.textContent = day;
    calendar.appendChild(header);
  });

  // Première date du mois
  const firstDay = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    0
  );
  const lastDay = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  );
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  // Générer 42 jours (6 semaines)
  for (let i = 1; i < 43; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);

    const dayElement = document.createElement("div");
    dayElement.className = "calendar-day";

    if (date.getMonth() !== currentDate.getMonth()) {
      dayElement.classList.add("other-month");
    }

    if (date.toDateString() === new Date().toDateString()) {
      dayElement.classList.add("today");
    }

    dayElement.innerHTML = `<div class="calendar-day-number">${date.getDate()}</div>`;

    const dayAbsences = getAbsencesForDate(date);
    dayAbsences.forEach((absence) => {
      const indicator = document.createElement("div");
      indicator.className = `absence-indicator ${absence.type_absence}`;
      indicator.textContent = `${absence.officier}`;
      indicator.title = `${absence.officier} (${absence.grade}) - ${absence.type_absence}`;
      dayElement.appendChild(indicator);
    });

    dayElement.addEventListener("click", () =>
      showDayDetails(date, dayAbsences)
    );
    calendar.appendChild(dayElement);
  }
}

function getAbsencesForDate(date) {
  const dateStr = date.toISOString().split("T")[0];
  return filteredAbsences.filter((absence) => {
    const start = new Date(absence.date_debut);
    const end = new Date(absence.date_fin);
    return date >= start && date <= end && absence.statut === "approuve";
  });
}

function displayRequests() {
  const container = document.getElementById("requests-list");
  container.innerHTML = "";

  if (filteredAbsences.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; color: #666; padding: 40px;">Aucune demande d\'absence trouvée</p>';
    return;
  }

  filteredAbsences.forEach((absence) => {
    const card = createRequestCard(absence);
    container.appendChild(card);
  });
}

function createRequestCard(absence) {
  const card = document.createElement("div");
  card.className = `request-card ${absence.statut}`;
  card.onclick = () => showAbsenceDetails(absence);

  const statusText = {
    en_attente: "En attente",
    approuve: "Approuvée",
    refuse: "Refusée",
  };

  const typeText = {
    conge: "Congé",
    maladie: "Maladie",
    formation: "Formation",
    personnel: "Personnel",
    autre: "Autre",
  };

  card.innerHTML = `
        <div class="request-header">
            <div class="request-agent">${absence.officier} (${
    absence.grade
  })</div>
            <div class="request-status ${absence.statut}">${
    statusText[absence.statut]
  }</div>
        </div>
        <div class="request-details">
            <div class="request-detail">
                <strong>Type</strong>
                ${typeText[absence.type_absence]}
            </div>
            <div class="request-detail">
                <strong>Période</strong>
                Du ${formatDate(absence.date_debut)} au ${formatDate(
    absence.date_fin
  )}
            </div>
            <div class="request-detail">
                <strong>Durée</strong>
                ${calculateDuration(
                  absence.date_debut,
                  absence.date_fin
                )} jour(s)
            </div>
            <div class="request-detail">
                <strong>Demandé le</strong>
                ${formatDateTime(absence.date_creation)}
            </div>
        </div>
    `;

  return card;
}

function showAbsenceDetails(absence) {
  currentAbsenceId = absence.id;
  const modal = document.getElementById("absence-modal");
  const modalBody = document.getElementById("modal-body");

  const statusText = {
    en_attente: "En attente",
    approuve: "Approuvée",
    refuse: "Refusée",
  };

  const typeText = {
    conge: "Congé",
    maladie: "Maladie",
    formation: "Formation",
    personnel: "Personnel",
    autre: "Autre",
  };

  modalBody.innerHTML = `
        <div class="detail-grid">
            <div class="detail-item">
                <div class="detail-label">Agent</div>
                <div class="detail-value">${absence.officier}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Grade</div>
                <div class="detail-value">${absence.grade}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Type d'absence</div>
                <div class="detail-value">${
                  typeText[absence.type_absence]
                }</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Statut</div>
                <div class="detail-value">${statusText[absence.statut]}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Date de début</div>
                <div class="detail-value">${formatDate(absence.date_debut)} ${
    absence.heure_debut || ""
  }</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Date de fin</div>
                <div class="detail-value">${formatDate(absence.date_fin)} ${
    absence.heure_fin || ""
  }</div>
            </div>
        </div>
        
        <div class="detail-item" style="margin-bottom: 15px;">
            <div class="detail-label">Motif</div>
            <div class="detail-value">${absence.motif}</div>
        </div>
        
        <div class="detail-item" style="margin-bottom: 15px;">
            <div class="detail-label">Justificatif</div>
            <div class="detail-value">${
              absence.justificatif ? "Oui" : "Non"
            }</div>
        </div>
        
        ${
          absence.commentaire_admin
            ? `
        <div class="detail-item">
            <div class="detail-label">Commentaire administrateur</div>
            <div class="detail-value">${absence.commentaire_admin}</div>
        </div>
        `
            : ""
        }
    `;

  const approveBtn = modal.querySelector(".btn-success");
  const rejectBtn = modal.querySelector(".btn-danger");

  if (absence.statut === "en_attente") {
    approveBtn.style.display = "inline-block";
    rejectBtn.style.display = "inline-block";
  } else {
    approveBtn.style.display = "none";
    rejectBtn.style.display = "none";
  }

  modal.style.display = "block";
}

function approveAbsence() {
  pendingStatusChange = { status: "approuve", action: "approuver" };
  showCommentModal();
}

function rejectAbsence() {
  pendingStatusChange = { status: "refuse", action: "refuser" };
  showCommentModal();
}

function showCommentModal() {
  const modal = document.getElementById("comment-modal");
  const title = document.getElementById("comment-modal-title");
  title.textContent = `Commentaire pour ${pendingStatusChange.action} la demande`;
  document.getElementById("admin-comment").value = "";
  modal.style.display = "block";
}

async function confirmStatusChange() {
  if (!pendingStatusChange || !currentAbsenceId) return;

  const comment = document.getElementById("admin-comment").value.trim();

  try {
    const response = await fetch(`/api/absence/${currentAbsenceId}/statut`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        statut: pendingStatusChange.status,
        commentaire: comment || null,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Erreur lors de la mise à jour");
    }

    showSuccess(
      `Demande ${
        pendingStatusChange.action === "approuver" ? "approuvée" : "refusée"
      } avec succès`
    );

    closeCommentModal();
    closeModal();
    await refreshData();
  } catch (error) {
    console.error("Erreur:", error);
    showError("Erreur lors de la mise à jour: " + error.message);
  }

  pendingStatusChange = null;
  currentAbsenceId = null;
}

function closeModal() {
  document.getElementById("absence-modal").style.display = "none";
  currentAbsenceId = null;
}

function closeCommentModal() {
  document.getElementById("comment-modal").style.display = "none";
  pendingStatusChange = null;
}

function previousMonth() {
  currentDate.setMonth(currentDate.getMonth() - 1);
  generateCalendar();
}

function nextMonth() {
  currentDate.setMonth(currentDate.getMonth() + 1);
  generateCalendar();
}

function applyFilters() {
  const status = document.getElementById("filter-status").value;
  const type = document.getElementById("filter-type").value;
  const dateStart = document.getElementById("filter-date-start").value;
  const dateEnd = document.getElementById("filter-date-end").value;

  filteredAbsences = allAbsences.filter((absence) => {
    if (status && absence.statut !== status) return false;
    if (type && absence.type_absence !== type) return false;
    if (dateStart && new Date(absence.date_debut) < new Date(dateStart))
      return false;
    if (dateEnd && new Date(absence.date_fin) > new Date(dateEnd)) return false;
    return true;
  });

  displayRequests();
  generateCalendar();
}

function clearFilters() {
  document.getElementById("filter-status").value = "";
  document.getElementById("filter-type").value = "";
  document.getElementById("filter-date-start").value = "";
  document.getElementById("filter-date-end").value = "";
  document.getElementById("search-input").value = "";

  filteredAbsences = [...allAbsences];
  displayRequests();
  generateCalendar();
}

function searchRequests() {
  const searchTerm = document
    .getElementById("search-input")
    .value.toLowerCase();

  if (!searchTerm) {
    filteredAbsences = [...allAbsences];
  } else {
    filteredAbsences = allAbsences.filter(
      (absence) =>
        absence.officier.toLowerCase().includes(searchTerm) ||
        absence.grade.toLowerCase().includes(searchTerm) ||
        absence.motif.toLowerCase().includes(searchTerm)
    );
  }
  displayRequests();
  generateCalendar();
}

async function refreshData() {
  try {
    showLoading();
    await loadStats();
    await loadAbsences();
    applyFilters();
    hideLoading();
    showSuccess("Données actualisées");
  } catch (error) {
    hideLoading();
    showError("Erreur lors de l'actualisation");
  }
}

function showDayDetails(date, absences) {
  if (absences.length === 0) return;

  const modal = document.getElementById("absence-modal");
  const modalBody = document.getElementById("modal-body");
  const modalTitle = document.getElementById("modal-title");

  modalTitle.textContent = `Absences du ${formatDate(
    date.toISOString().split("T")[0]
  )}`;

  let content = '<div class="day-absences">';
  absences.forEach((absence) => {
    content += `
            <div class="absence-summary" onclick="showAbsenceDetails(${JSON.stringify(
              absence
            ).replace(/"/g, "&quot;")})">
                <strong>${absence.officier}</strong> (${absence.grade}) - ${
      absence.type_absence
    }
                <br><small>${absence.motif}</small>
            </div>
        `;
  });
  content += "</div>";

  modalBody.innerHTML = content;

  modal.querySelector(".btn-success").style.display = "none";
  modal.querySelector(".btn-danger").style.display = "none";

  modal.style.display = "block";
}

function setupEventListeners() {
  window.onclick = function (event) {
    const absenceModal = document.getElementById("absence-modal");
    const commentModal = document.getElementById("comment-modal");

    if (event.target === absenceModal) {
      closeModal();
    }
    if (event.target === commentModal) {
      closeCommentModal();
    }
  };

  document
    .getElementById("search-input")
    .addEventListener("input", function () {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(searchRequests, 300);
    });

  [
    "filter-status",
    "filter-type",
    "filter-date-start",
    "filter-date-end",
  ].forEach((id) => {
    document.getElementById(id).addEventListener("change", applyFilters);
  });
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("fr-FR");
}

function formatDateTime(dateString) {
  return new Date(dateString).toLocaleString("fr-FR");
}

function calculateDuration(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}

function showSuccess(message) {
  showNotification(message, "success");
}

function showError(message) {
  showNotification(message, "error");
}

function showNotification(message, type) {
  const existing = document.querySelector(".notification");
  if (existing) existing.remove();

  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;

  Object.assign(notification.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    padding: "15px 20px",
    borderRadius: "8px",
    color: "white",
    fontWeight: "600",
    zIndex: "10000",
    animation: "slideInRight 0.3s ease",
    backgroundColor: type === "success" ? "#28a745" : "#dc3545",
  });

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 5000);
}

function showLoading() {
  document.body.classList.add("loading");
}

function hideLoading() {
  document.body.classList.remove("loading");
}

const notificationStyles = `
<style>
@keyframes slideInRight {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

.absence-summary {
    background: #f8f9fa;
    padding: 10px;
    margin-bottom: 10px;
    border-radius: 6px;
    border-left: 4px solid #0b1b5a;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.absence-summary:hover {
    background: #e9ecef;
}

.day-absences {
    max-height: 300px;
    overflow-y: auto;
}
</style>
`;

document.head.insertAdjacentHTML("beforeend", notificationStyles);

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
