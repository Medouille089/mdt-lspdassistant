document.addEventListener('DOMContentLoaded', () => {
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
        // Ajouter d'autres types ici si besoin
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
      li.textContent = agent.display_name;
      listEl.appendChild(li);
    });
  } catch (err) {
    console.error(err);
  }
}

async function loadActivityChart() {
  const res = await fetch('/api/activity');
  const data = await res.json();

  const labels = data.map(d => new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }));
  const incidents = data.map(d => d.incidents);
  const arrestations = data.map(d => d.arrestations);
  const bracelets = data.map(d => d.bracelets);
  const convocations = data.map(d => d.convocations);

  const ctx = document.getElementById('activityChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Incidents',
          data: incidents,
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          tension: 0.3
        },
        {
          label: 'Arrestations',
          data: arrestations,
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          tension: 0.3
        },
        {
          label: 'Bracelets',
          data: bracelets,
          borderColor: 'rgba(255, 206, 86, 1)',
          backgroundColor: 'rgba(255, 206, 86, 0.2)',
          tension: 0.3
        },
        {
          label: 'Convocations',
          data: convocations,
          borderColor: 'rgba(136, 207, 88, 1)',
          backgroundColor: 'rgba(255, 206, 86, 0.2)',
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        title: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            callback: function (value) {
              if (Number.isInteger(value)) {
                return value;
              }
            }
          }
        }
      }

    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadActivityChart();
});

fetchConnectedAgents();
setInterval(fetchConnectedAgents, 30000);

