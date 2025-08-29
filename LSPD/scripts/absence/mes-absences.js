document.addEventListener('DOMContentLoaded', function () {
    let currentDate = new Date();
    let userAbsences = [];
    let currentUser = null;

    loadUserData();
    initializePage();
    setupEventListeners();

    async function loadUserData() {
        try {
            const response = await fetch('/api/user');
            currentUser = await response.json();
            loadUserAbsences();
        } catch (error) {
            console.error('Erreur lors du chargement des données utilisateur:', error);
        }
    }

    async function loadUserAbsences() {
        try {
            showLoader();
            const response = await fetch('/api/absence/mes-absences');

            if (!response.ok) {
                throw new Error('Erreur lors du chargement des absences');
            }

            userAbsences = await response.json();

            updateStatistics();
            updateCalendar();
            updateAbsencesList();
            hideLoader();
        } catch (error) {
            console.error('Erreur lors du chargement des absences:', error);
            hideLoader();
            document.querySelector('.main-container').innerHTML += `
                <div style="background: #ffebee; border: 2px solid #f44336; color: #c62828; padding: 15px; border-radius: 10px; margin: 20px 0; text-align: center;">
                    <strong>Erreur:</strong> Impossible de charger vos absences. Veuillez vous reconnecter.
                </div>
            `;
        }
    }

    function initializePage() {
        updateCalendar();
        document.getElementById('currentMonth').textContent =
            currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    }

    function setupEventListeners() {
        document.getElementById('prevMonth').addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            updateCalendar();
        });

        document.getElementById('nextMonth').addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            updateCalendar();
        });

        document.getElementById('calendarView').addEventListener('click', () => {
            showCalendarView();
        });

        document.getElementById('listView').addEventListener('click', () => {
            showListView();
        });


        document.getElementById('statusFilter').addEventListener('change', updateAbsencesList);
        document.getElementById('typeFilter').addEventListener('change', updateAbsencesList);

        document.querySelector('.close').addEventListener('click', closeModal);
        window.addEventListener('click', (event) => {
            if (event.target === document.getElementById('absenceModal')) {
                closeModal();
            }
        });
    }

    function updateStatistics() {
        const total = userAbsences.length;
        const approved = userAbsences.filter(a => a.statut === 'approuve').length;
        const pending = userAbsences.filter(a => a.statut === 'en_attente').length;
        const rejected = userAbsences.filter(a => a.statut === 'refuse').length;

        document.getElementById('totalAbsences').textContent = total;
        document.getElementById('approvedAbsences').textContent = approved;
        document.getElementById('pendingAbsences').textContent = pending;
        document.getElementById('rejectedAbsences').textContent = rejected;
    }

    function updateCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        document.getElementById('currentMonth').textContent =
            new Date(year, month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        const calendarGrid = document.getElementById('calendarGrid');
        calendarGrid.innerHTML = '';

        // Ajouter les en-têtes des jours
        const dayHeaders = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        dayHeaders.forEach(day => {
            const header = document.createElement('div');
            header.style.fontWeight = 'bold';
            header.style.textAlign = 'center';
            header.style.padding = '10px';
            header.style.background = '#f0f2f5';
            header.textContent = day;
            calendarGrid.appendChild(header);
        });

        // Générer 42 jours (6 semaines)
        for (let i = 0; i < 42; i++) {
            const cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + i);

            const dayCell = createDayCell(cellDate, month);
            calendarGrid.appendChild(dayCell);
        }
    }

    function createDayCell(date, currentMonth) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';

        const dayNumber = document.createElement('span');
        dayNumber.className = 'day-number';
        dayNumber.textContent = date.getDate();
        dayCell.appendChild(dayNumber);

        if (date.getMonth() !== currentMonth) {
            dayCell.classList.add('other-month');
        }

        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            dayCell.classList.add('today');
        }

        const dayAbsences = userAbsences.filter(absence => {
            const startDate = new Date(absence.date_debut);
            const endDate = new Date(absence.date_fin);
            return date >= startDate && date <= endDate;
        });

        if (dayAbsences.length > 0) {
            dayCell.classList.add('has-absence');

            let mainStatus = 'approved';
            if (dayAbsences.some(a => a.statut === 'refuse')) {
                mainStatus = 'rejected';
            } else if (dayAbsences.some(a => a.statut === 'en_attente')) {
                mainStatus = 'pending';
            }

            dayCell.classList.add(mainStatus);

            dayAbsences.forEach(absence => {
                const indicator = document.createElement('div');
                indicator.className = `absence-indicator ${absence.statut === 'approuve' ? 'approved' : absence.statut === 'en_attente' ? 'pending' : 'rejected'}`;
                dayCell.appendChild(indicator);
            });

            dayCell.addEventListener('click', () => {
                showAbsenceDetails(dayAbsences);
            });
        }

        return dayCell;
    }

    function updateAbsencesList() {
        const statusFilter = document.getElementById('statusFilter').value;
        const typeFilter = document.getElementById('typeFilter').value;

        let filteredAbsences = [...userAbsences];

        if (statusFilter) {
            filteredAbsences = filteredAbsences.filter(a => a.statut === statusFilter);
        }

        if (typeFilter) {
            filteredAbsences = filteredAbsences.filter(a => a.type_absence === typeFilter);
        }


        filteredAbsences.sort((a, b) => new Date(b.date_creation) - new Date(a.date_creation));

        const container = document.getElementById('absencesList');
        container.innerHTML = '';

        if (filteredAbsences.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; font-style: italic;">Aucune absence trouvée pour les critères sélectionnés.</p>';
            return;
        }

        filteredAbsences.forEach(absence => {
            const card = createAbsenceCard(absence);
            container.appendChild(card);
        });
    }

    function createAbsenceCard(absence) {
        const card = document.createElement('div');
        card.className = `absence-card ${absence.statut === 'approuve' ? 'approved' : absence.statut === 'en_attente' ? 'pending' : 'rejected'}`;

        const statusText = {
            'en_attente': 'En attente',
            'approuve': 'Approuvée',
            'refuse': 'Refusée'
        };

        const typeText = {
            'conge': 'Congé',
            'maladie': 'Maladie',
            'personnel': 'Personnel',
            'formation': 'Formation'
        };

        card.innerHTML = `
            <div class="absence-header">
                <span class="absence-type">${typeText[absence.type_absence] || absence.type_absence}</span>
                <span class="absence-status ${absence.statut === 'approuve' ? 'approved' : absence.statut === 'en_attente' ? 'pending' : 'rejected'}">${statusText[absence.statut]}</span>
            </div>
            <div class="absence-dates">
                <span><strong>Du:</strong> ${formatDate(absence.date_debut)} ${absence.heure_debut || ''}</span>
                <span><strong>Au:</strong> ${formatDate(absence.date_fin)} ${absence.heure_fin || ''}</span>
            </div>
            <div class="absence-motif">
                <strong>Motif:</strong> ${absence.motif}
            </div>
        `;

        card.addEventListener('click', () => {
            showAbsenceDetails([absence]);
        });

        return card;
    }

    function showAbsenceDetails(absences) {
        const modal = document.getElementById('absenceModal');
        const details = document.getElementById('absenceDetails');

        if (absences.length === 1) {
            const absence = absences[0];
            const statusText = {
                'en_attente': 'En attente',
                'approuve': 'Approuvée',
                'refuse': 'Refusée'
            };

            const typeText = {
                'conge': 'Congé',
                'maladie': 'Maladie',
                'personnel': 'Personnel',
                'formation': 'Formation'
            };

            details.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <h3 style="color: #0b1b5a; margin-bottom: 15px;">Demande d'absence</h3>
                    <p><strong>Type:</strong> ${typeText[absence.type_absence] || absence.type_absence}</p>
                    <p><strong>Statut:</strong> <span class="absence-status ${absence.statut === 'approuve' ? 'approved' : absence.statut === 'en_attente' ? 'pending' : 'rejected'}">${statusText[absence.statut]}</span></p>
                    <p><strong>Du:</strong> ${formatDate(absence.date_debut)} ${absence.heure_debut || ''}</p>
                    <p><strong>Au:</strong> ${formatDate(absence.date_fin)} ${absence.heure_fin || ''}</p>
                    <p><strong>Motif:</strong> ${absence.motif}</p>
                    <p><strong>Justificatif urgent:</strong> ${absence.justificatif ? 'Oui' : 'Non'}</p>
                    <p><strong>Demande créée le:</strong> ${formatDateTime(absence.date_creation)}</p>
                    ${absence.date_modification ? `<p><strong>Dernière modification:</strong> ${formatDateTime(absence.date_modification)}</p>` : ''}
                </div>
            `;
        } else {
            const statusText = {
                'en_attente': 'En attente',
                'approuve': 'Approuvée',
                'refuse': 'Refusée'
            };
            details.innerHTML = `
                <div style="margin-bottom: 20px;">
                    <h3 style="color: #0b1b5a; margin-bottom: 15px;">Absences de la journée (${absences.length})</h3>
                    ${absences.map(absence => `
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 10px;">
                            <p><strong>Type:</strong> ${absence.type_absence}</p>
                            <p><strong>Statut:</strong> <span class="absence-status ${absence.statut === 'approuve' ? 'approved' : absence.statut === 'en_attente' ? 'pending' : 'rejected'}">${statusText[absence.statut]}</span></p>
                            <p><strong>Motif:</strong> ${absence.motif}</p>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        modal.style.display = 'block';
    }

    function showCalendarView() {
        document.getElementById('calendarView').classList.add('active');
        document.getElementById('listView').classList.remove('active');
        document.getElementById('calendar-container').style.display = 'block';
        document.getElementById('list-container').style.display = 'none';
    }

    function showListView() {
        document.getElementById('listView').classList.add('active');
        document.getElementById('calendarView').classList.remove('active');
        document.getElementById('list-container').style.display = 'block';
        document.getElementById('calendar-container').style.display = 'none';
        updateAbsencesList();
    }

    function closeModal() {
        document.getElementById('absenceModal').style.display = 'none';
    }

    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('fr-FR');
    }

    function formatDateTime(dateString) {
        return new Date(dateString).toLocaleString('fr-FR');
    }

    function showLoader() {
        document.getElementById('loaderOverlay').style.display = 'flex';
    }

    function hideLoader() {
        document.getElementById('loaderOverlay').style.display = 'none';
    }
});
