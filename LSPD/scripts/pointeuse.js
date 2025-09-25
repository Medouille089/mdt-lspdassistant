// --------------------
// SHOW ANIMATION
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
// CUSTOM CONFIRM
// --------------------
function customConfirm(message, confirmText = "Confirmer", cancelText = "Annuler") {
    return new Promise((resolve) => {
        const overlay = document.getElementById('customConfirmSend');
        const p = overlay.querySelector('p');
        const btnCancel = overlay.querySelector('.btn-blue');
        const btnConfirm = overlay.querySelector('.btn-red');

        p.textContent = message;
        btnConfirm.textContent = confirmText;
        btnCancel.textContent = cancelText;

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

// --------------------
// INITIALIZATION
// --------------------
document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loaderOverlay');
    if (loader) loader.style.display = 'flex';
    checkStatus()
        .finally(() => {
            if (loader) loader.style.display = 'none';
        })
        .catch(err => console.error("Erreur initialisation dashboard :", err));
});

const { DateTime } = luxon;
let isRunning = false;

// --------------------
// CHECK STATUS
// --------------------
async function checkStatus() {
    try {
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

        await fetchWeeklySalary();
    } catch (err) {
        console.error("Erreur checkStatus:", err);
        document.getElementById('status').textContent = 'Erreur serveur';
    }
}

// --------------------
// FETCH WEEKLY SALARY
// --------------------
async function fetchWeeklySalary() {
    try {
        const res = await fetch('/pointeuse/semaine');
        if (!res.ok) throw new Error('Erreur serveur');

        const data = await res.json();

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

// --------------------
// RENDER WEEKLY HISTORY
// --------------------
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

// --------------------
// START / STOP POINTEUSE
// --------------------
document.getElementById('btn-start-stop').addEventListener('click', async () => {
    const action = isRunning ? 'stop' : 'start';
    const message = isRunning ? 'Voulez-vous vraiment arrêter votre pointage ?' : 'Voulez-vous démarrer un nouveau pointage ?';

    const confirmed = await customConfirm(message, `Confirmer ${isRunning ? 'arrêt' : 'démarrage'}`, "Annuler");
    if (!confirmed) return;

    try {
        const res = await fetch(`/pointeuse/${action}`, { method: 'POST' });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Erreur serveur');

        if (isRunning) {
            await showAnimation('success', `Pointage arrêté. Vous avez gagné ${data.earned ? data.earned.toFixed(2) : '?'} $`);
        } else {
            await showAnimation('success', `Pointage démarré avec le rôle : ${data.role_used}`);
        }

        await checkStatus();
    } catch (err) {
        await showAnimation('error', err.message || 'Erreur serveur');
        console.error(err);
    }
});
