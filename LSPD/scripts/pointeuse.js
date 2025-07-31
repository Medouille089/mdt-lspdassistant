document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loaderOverlay');
    if (loader) loader.style.display = 'flex';
    checkStatus()
        .finally(() => {
            if (loader) loader.style.display = 'none';
        })
        .catch(err => {
            console.error("Erreur initialisation dashboard :", err);
        });
});


const { DateTime } = luxon;
let isRunning = false;

async function checkStatus() {
    const resHist = await fetch('/pointeuse/historique');
    if (!resHist.ok) {
        document.getElementById('status').textContent = 'Erreur serveur';
        return;
    }
    const history = await resHist.json();
    const ongoing = history.find(h => h.end_time === null);
    isRunning = !!ongoing;

    const btn = document.getElementById('btn-start-stop');
    const status = document.getElementById('status');

    if (isRunning) {
        status.textContent = `Pointage en cours depuis : ${DateTime.fromISO(ongoing.start_time).setZone('Europe/Paris').toLocaleString(DateTime.DATETIME_SHORT)}`;
        btn.textContent = 'Arrêter le pointage';
    } else {
        status.textContent = 'Aucun pointage en cours.';
        btn.textContent = 'Démarrer le pointage';
    }

    // Affiche l'historique semaine et le salaire
    await fetchWeeklySalary();
}

async function fetchWeeklySalary() {
    try {
        const res = await fetch('/pointeuse/semaine');
        if (!res.ok) throw new Error('Erreur serveur');

        const data = await res.json();

        // Affiche la plage de la semaine courante
        const startDate = DateTime.fromISO(data.currentWeek.start, { zone: 'Europe/Paris' }).toLocaleString(DateTime.DATE_MED);
        const endDate = DateTime.fromISO(data.currentWeek.end, { zone: 'Europe/Paris' }).toLocaleString(DateTime.DATE_MED);

        document.getElementById('current-week-range').textContent = `${startDate} → ${endDate}`;
        document.getElementById('current-week-total').textContent = data.currentWeek.totalSalary.toFixed(2);

        renderWeeklyHistory(data.currentWeek.entries);

        const ul = document.getElementById('last-weeks-list');
        ul.innerHTML = '';

        if (!data.last3Weeks.length) {
            ul.innerHTML = '<li>Aucune donnée pour les semaines précédentes.</li>';
        } else {
            data.last3Weeks.forEach(week => {
                const li = document.createElement('li');
                li.textContent = `Semaine du ${DateTime.fromISO(week.weekStart).toLocaleString(DateTime.DATE_MED)} : ${week.totalSalary.toFixed(2)} $`;
                ul.appendChild(li);
            });
        }
    } catch (err) {
        document.getElementById('weekly-salary').textContent = 'Impossible de charger les données hebdomadaires.';
        console.error(err);
    }
}

function renderWeeklyHistory(entries) {
    const tbody = document.getElementById('weekly-history-body');
    tbody.innerHTML = '';

    if (!entries.length) {
        tbody.innerHTML = '<tr><td colspan="5">Aucun pointage cette semaine.</td></tr>';
        return;
    }

    entries.forEach(item => {
        const start = DateTime.fromISO(item.start_time, { zone: 'utc' }).setZone('Europe/Paris').toLocaleString(DateTime.DATETIME_SHORT);
        const end = item.end_time
            ? DateTime.fromISO(item.end_time, { zone: 'utc' }).setZone('Europe/Paris').toLocaleString(DateTime.DATETIME_SHORT)
            : '-';

        const role = item.role_name || '-';
        const duration = item.durationHours || '-';
        const earnedNum = Number(item.salary_earned);
        const earned = !isNaN(earnedNum) ? earnedNum.toFixed(2) : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
                    <td>${start}</td>
                    <td>${end}</td>
                    <td>${role}</td>
                    <td>${duration}</td>
                    <td>${earned}</td>
                `;
        tbody.appendChild(tr);
    });
}

document.getElementById('btn-start-stop').addEventListener('click', async () => {
    const url = isRunning ? '/pointeuse/stop' : '/pointeuse/start';
    const res = await fetch(url, { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
        alert(data.error || 'Erreur serveur');
        return;
    }

    alert(isRunning
        ? `Pointage arrêté. Vous avez gagné ${data.earned ? data.earned.toFixed(2) : '?'} $`
        : `Pointage démarré avec le rôle : ${data.role_used}`);

    await checkStatus();
});

// Au chargement de la page
checkStatus();