document.addEventListener('DOMContentLoaded', () => {
  // Détection iframe pour ajuster le scale de l'overlay
  if (window.self !== window.top) {
    document.body.classList.add('in-iframe');
  }

  const loader = document.getElementById('loaderOverlay');
  if (loader) loader.style.display = 'flex';

  fetchUser()
    .then(loadDashboardStats)
    .finally(() => {
      if (loader) loader.style.display = 'none';
    })
    .catch(err => {
      console.error("Erreur initialisation dashboard :", err);
    });
});

async function fetchUser() {
  try {
    let user;

    if (window.clientCache && typeof window.clientCache.getOrFetch === 'function') {
      user = await window.clientCache.getOrFetch('user', async () => {
        const res = await fetch('/api/user');
        if (!res.ok) throw new Error('Non connecté');
        return await res.json();
      }, window.CLIENT_CACHE_TTL ? window.CLIENT_CACHE_TTL.USER : 300);
    } else {
      const res = await fetch('/api/user');
      if (!res.ok) throw new Error('Non connecté');
      user = await res.json();
    }

    const usernameEl = document.getElementById('messageUsername');
    const gradeEl = document.getElementById('messageGrade');
    const overlayMsg = document.getElementById('overlayMessage');
    const overlayGrade = document.getElementById('overlayGrade');

    if (usernameEl) usernameEl.innerHTML = `Bonjour <strong>${user.username}</strong>`;
    if (gradeEl) gradeEl.textContent = user.grade || '';
    if (overlayMsg) overlayMsg.innerHTML = `Bonjour <strong>${user.username}</strong>`;
    if (overlayGrade) overlayGrade.textContent = user.grade || '';

    const now = Date.now();
    const lastSeen = localStorage.getItem('overlayLastSeen');
    const delay = 3600000;

    if (!lastSeen || now - lastSeen > delay) {
      showOverlay();
      localStorage.setItem('overlayLastSeen', now);
    }
  } catch (err) {
    console.error("Erreur fetchUser:", err);
  }
}

function showOverlay() {
  const overlay = document.getElementById('overlay');
  if (!overlay) return;

  overlay.classList.add('show');

  setTimeout(() => {
    overlay.classList.add('hide');
  }, 2000);

  overlay.addEventListener('animationend', () => {
    overlay.classList.remove('show', 'hide');
    overlay.style.display = 'none';
  }, { once: true });
}

async function loadDashboardStats() {
  try {
    const res = await fetch('/api/dashboard');
    const data = await res.json();

    // --- Bracelets ---
    const braceletEl = document.getElementById('braceletCount');
    if (braceletEl) braceletEl.textContent = data.braceletCount;

    // --- Rapports ---
    const interventionCount = document.getElementById('interventionCount');
    const interventionInfo = document.getElementById('interventionInfo');
    if (interventionCount) interventionCount.textContent = data.totalReports;
    if (interventionInfo) interventionInfo.textContent = `+${data.interventionsToday} aujourd'hui`;

    // --- Derniers rapports ---
    const tbody = document.getElementById('rapportsTbody');
    if (tbody) {
      tbody.innerHTML = '';

      function getReportUrl(report) {
        if (report.type === 'Incident') {
          return `/viewIncident?id=${report.id}`;
        }
        if (report.type === 'Arrestation') {
          return `/viewArrestation?id=${report.id}`;
        }
        if (report.type === 'Avis de recherche (Disparu)' || report.type === 'Avis de recherche (Most Wanted)' || report.type === 'Avis de recherche') {
          return `/voir-avis-recherche?id=${report.id}`;
        }
        if (report.type === 'Rapport d\'arrestation') {
          return `/voir-rapport-arrestation?id=${report.id}`;
        }
        return '#';
      }

      data.latestReports.forEach(report => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${report.id}</td>
            <td>${report.date}</td>
            <td>${report.agent}</td>
            <td>${report.type}</td>
        `;

        const url = getReportUrl(report);
        tr.style.cursor = url !== '#' ? 'pointer' : 'default';
        if (url !== '#') {
          tr.addEventListener('click', () => {
            window.location.href = url;
          });
        }

        tbody.appendChild(tr);
      });
    }

    // --- Salaire semaine ---
    const weekRes = await fetch('/pointeuse/semaine');
    if (weekRes.ok) {
      const weekData = await weekRes.json();
      const patrouilleCount = document.getElementById('patrouilleCount');
      if (patrouilleCount) {
        patrouilleCount.textContent = `${weekData.currentWeek.totalSalary.toFixed(2)} $`;
      }
    } else {
      console.warn('Impossible de récupérer le salaire de la semaine');
    }

  } catch (err) {
    console.error("Erreur chargement dashboard :", err);
  }
}

fetchUser().then(loadDashboardStats).catch(err => {
  console.error("Erreur initialisation dashboard :", err);
});

async function fetchConnectedAgents() {
  try {
    const response = await fetch('/api/connected-agents', { cache: "no-store" });
    if (!response.ok) throw new Error('Erreur fetch agents connectés');
    const data = await response.json();

    const listEl = document.getElementById('connectedAgentsList');
    listEl.innerHTML = '';

    if (data.agents.length === 0) {
      listEl.innerHTML = '<li>Aucun agent connecté</li>';
      return;
    }

    data.agents.forEach(agent => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.gap = '10px';
      const img = document.createElement('img');
      const defaultAvatar = 'https://media.istockphoto.com/id/1016744004/fr/vectoriel/image-despace-r%C3%A9serv%C3%A9-de-profil-gray-ne-silhouette-aucune-photo.jpg?s=612x612&w=0&k=20&c=7OLCKLuDpDHaXywnkaGuK-bKQS9lnivwYDYnGqD60bc=';
      img.src = agent.avatar || defaultAvatar;
      img.alt = 'PP';
      img.style.width = '38px';
      img.style.height = '38px';
      img.style.borderRadius = '50%';
      img.style.objectFit = 'cover';
      img.onerror = function() { this.src = defaultAvatar; };
      li.appendChild(img);
      const span = document.createElement('span');
      span.style.fontSize = '14px';
      span.textContent = agent.display_name;
      li.appendChild(span);
      listEl.appendChild(li);
    });
  } catch (err) {
    console.error(err);
  }
}

let activityChart = null;
let currentPeriod = 'month';

async function loadActivityChart(period = 'month') {
  currentPeriod = period;
  const res = await fetch(`/api/activity?period=${period}`);
  const response = await res.json();

  // Support ancien et nouveau format de réponse
  const data = response.data || response;

  if (!data || !Array.isArray(data)) {
    console.error('Format de données invalide:', response);
    return;
  }

  let labels;
  if (period === 'day') {
    // Labels par heure : 00h, 01h, ..., 23h
    labels = data.map(d => `${d.hour.toString().padStart(2, '0')}h`);
  } else if (period === 'week') {
    // Labels pour 7 jours : Lun 20/01
    labels = data.map(d => new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }));
  } else {
    // Labels pour 30 jours : 20/01
    labels = data.map(d => new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
  }
  const incidents = data.map(d => d.incidents);
  const arrestations = data.map(d => d.arrestations);
  const bracelets = data.map(d => d.bracelets);
  const convocations = data.map(d => d.convocations);
  const avisRecherche = data.map(d => d.avisRecherche);
  const rapportsArrestation = data.map(d => d.rapportsArrestation);

  const ctx = document.getElementById('activityChart').getContext('2d');

  // Détruire le graphique existant s'il y en a un
  if (activityChart) {
    activityChart.destroy();
  }

  // Fonction pour créer un dégradé vertical
  function createGradient(ctx, color) {
    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    gradient.addColorStop(0, color.replace('1)', '0.4)'));
    gradient.addColorStop(1, color.replace('1)', '0.02)'));
    return gradient;
  }

  // Couleurs modernes et harmonieuses
  const colors = {
    incidents: 'rgba(99, 102, 241, 1)',      // Indigo
    arrestations: 'rgba(244, 63, 94, 1)',     // Rose
    bracelets: 'rgba(234, 179, 8, 1)',        // Jaune
    convocations: 'rgba(34, 197, 94, 1)',     // Vert
    avisRecherche: 'rgba(168, 85, 247, 1)',   // Violet
    rapports: 'rgba(249, 115, 22, 1)'         // Orange
  };

  activityChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Incidents',
          data: incidents,
          borderColor: colors.incidents,
          backgroundColor: createGradient(ctx, colors.incidents),
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: colors.incidents,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2
        },
        {
          label: 'Arrestations',
          data: arrestations,
          borderColor: colors.arrestations,
          backgroundColor: createGradient(ctx, colors.arrestations),
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: colors.arrestations,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2
        },
        {
          label: 'Bracelets',
          data: bracelets,
          borderColor: colors.bracelets,
          backgroundColor: createGradient(ctx, colors.bracelets),
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: colors.bracelets,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2
        },
        {
          label: 'Convocations',
          data: convocations,
          borderColor: colors.convocations,
          backgroundColor: createGradient(ctx, colors.convocations),
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: colors.convocations,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2
        },
        {
          label: 'Avis de recherche',
          data: avisRecherche,
          borderColor: colors.avisRecherche,
          backgroundColor: createGradient(ctx, colors.avisRecherche),
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: colors.avisRecherche,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2
        },
        {
          label: 'Rapports d\'arrestation',
          data: rapportsArrestation,
          borderColor: colors.rapports,
          backgroundColor: createGradient(ctx, colors.rapports),
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: colors.rapports,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'center',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 20,
            boxWidth: 8,
            boxHeight: 8,
            font: {
              size: 12,
              weight: '500'
            }
          }
        },
        title: { display: false },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#1f2937',
          bodyColor: '#4b5563',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          boxPadding: 6,
          usePointStyle: true
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          border: {
            display: false
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.06)',
            drawTicks: false
          },
          ticks: {
            stepSize: 1,
            padding: 10,
            color: '#9ca3af',
            font: {
              size: 11
            },
            callback: function (value) {
              if (Number.isInteger(value)) {
                return value;
              }
            }
          }
        },
        x: {
          border: {
            display: false
          },
          grid: {
            display: false
          },
          ticks: {
            padding: 10,
            color: '#9ca3af',
            font: {
              size: 11
            },
            maxRotation: period === 'month' ? 45 : 0,
            minRotation: period === 'month' ? 45 : 0
          }
        }
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadActivityChart('month');

  // Sélecteur de période
  const periodBtns = document.querySelectorAll('.period-btn');
  periodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      periodBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadActivityChart(btn.dataset.period);
    });
  });

  // Bouton Refresh
  const refreshBtn = document.getElementById('refreshDashboardBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      location.reload();
    });
  }
});

fetchConnectedAgents();
setInterval(fetchConnectedAgents, 5000);