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
                <p class="success" style="color: #0b1b5a;">${message || 'Opération réussie !'}</p>
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
    Promise.all([checkStatus(), renderMonthlyChart()])
        .finally(() => {
            if (loader) loader.style.display = 'none';
        })
        .catch(err => console.error("Erreur initialisation dashboard :", err));
});

const { DateTime } = luxon;
let isRunning = false;
let timerInterval = null;
let pointageStartTime = null;

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
            pointageStartTime = DateTime.fromISO(ongoing.start_time).setZone('Europe/Paris');
            status.textContent = `Pointage en cours depuis : ${pointageStartTime.toLocaleString(DateTime.DATETIME_SHORT)}`;
            btn.textContent = 'Arrêter le pointage';
            btn.classList.add('running');
            startLiveTimer();
        } else {
            status.textContent = 'Aucun pointage en cours.';
            btn.textContent = 'Démarrer le pointage';
            btn.classList.remove('running');
            stopLiveTimer();
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

    document.getElementById('current-week-range').textContent = `${startDate} au ${endDate}`;
    document.getElementById('current-week-total').textContent = `${data.currentWeek.totalSalary.toFixed(2)}$`;

        renderWeeklyHistory(data.currentWeek.entries);

        // Render last 3 weeks as dashboard-style cards
        const container = document.getElementById('last-weeks-cards');
        container.innerHTML = '';

        if (!data.last3Weeks.length) {
            const empty = document.createElement('div');
            empty.className = 'card stat';
            empty.innerHTML = `
                <div class="title">Historique</div>
                <div class="number">—</div>
                <div class="info">Aucune donnée pour les semaines précédentes</div>
            `;
            container.appendChild(empty);
        } else {
            data.last3Weeks.forEach((week, idx) => {
                const startDT = DateTime.fromISO(week.weekStart);
                const endDT = startDT.plus({ days: 6 });
                const start = startDT.toLocaleString(DateTime.DATE_MED);
                const end = endDT.toLocaleString(DateTime.DATE_MED);
                const card = document.createElement('div');
                card.className = 'card stat';
                card.innerHTML = `
                    <div class="title">Semaine du ${start} au ${end}</div>
                    <div class="number">${Number(week.totalSalary).toFixed(2)}$</div>
                `;
                container.appendChild(card);
            });
        }
    } catch (err) {
        const tgt = document.getElementById('current-week-total');
        if (tgt) tgt.textContent = 'Erreur de chargement';
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
            : 'En cours';

        const role = item.role_name || '-';
        const isActive = !item.end_time;
        let duration;
        
        if (isActive && pointageStartTime) {
            const now = DateTime.now().setZone('Europe/Paris');
            const diff = now.diff(pointageStartTime, ['hours', 'minutes']).toObject();
            const hours = Math.floor(diff.hours || 0);
            const minutes = Math.floor(diff.minutes || 0);
            duration = `${hours}h ${minutes.toString().padStart(2, '0')}min`;
        } else if (item.durationHours) {
            duration = item.durationHours;
        } else {
            duration = 'En cours';
        }
        
        const earnedNum = Number(item.salary_earned);
        const earned = !isNaN(earnedNum) && item.end_time ? earnedNum.toFixed(2) : 'En cours';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${start}</td>
            <td>${end}</td>
            <td>${role}</td>
            <td class="${isActive ? 'live-timer-cell' : ''}">${duration}</td>
            <td>${earned}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --------------------
// LIVE TIMER
// --------------------
function startLiveTimer() {
    // Timer will be shown in the table row
    function updateTimer() {
        if (!pointageStartTime) return;
        const now = DateTime.now().setZone('Europe/Paris');
        const diff = now.diff(pointageStartTime, ['hours', 'minutes']).toObject();
        const hours = Math.floor(diff.hours || 0);
        const minutes = Math.floor(diff.minutes || 0);
        const timerCell = document.querySelector('.live-timer-cell');
        if (timerCell) {
            timerCell.textContent = `${hours}h ${minutes.toString().padStart(2, '0')}min`;
        }
    }
    
    updateTimer();
    timerInterval = setInterval(updateTimer, 60000); // Update every minute
}

function stopLiveTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    pointageStartTime = null;
}

// --------------------
// MONTHLY CHART
// --------------------
async function renderMonthlyChart() {
    try {
        const res = await fetch('/pointeuse/monthly');
        if (!res.ok) throw new Error('Erreur serveur');
        
        const data = await res.json();
        const ctx = document.getElementById('monthlyChart').getContext('2d');
        document.getElementById('monthlyChart').height = 260;
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Heures travaillées',
                    data: data.hours,
                    backgroundColor: 'rgba(11, 27, 90, 1)',
                    borderWidth: 0,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        display: true,
                        labels: {
                            color: '#0b1b5a',
                            font: { size: 14 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#0b1b5a',
                        bodyColor: '#0b1b5a',
                        borderColor: '#0b1b5a',
                        borderWidth: 2,
                        callbacks: {
                            label: (context) => `${context.parsed.y.toFixed(1)}h`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#0b1b5a',
                            font: { size: 12, weight: '600' },
                            callback: (value) => value + 'h'
                        },
                        grid: { color: 'rgba(11, 27, 90, 0.1)' }
                    },
                    x: {
                        ticks: {
                            color: '#0b1b5a',
                            font: { size: 11 }
                        },
                        grid: { display: false }
                    }
                }
            }
        });
    } catch (err) {
        console.error('Erreur chart mensuel:', err);
    }
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
