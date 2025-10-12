document.addEventListener('DOMContentLoaded', function () {
    let currentDate = new Date();
    let currentWeekStart = getWeekStart(new Date());
    let allAbsences = [];
    let allEvents = [];
    let currentUser = null;
    let currentView = 'month';
    let availableGrades = [];
    let availableMembers = [];
    let gradesAndMembersLoaded = false;
    let absenceFilter = 'all';

    loadUserData();
    initializePage();
    setupEventListeners();

    async function loadUserData() {
        try {
            const response = await fetch('/api/user');
            currentUser = await response.json();

            document.getElementById('btnNewEvent').style.display = 'block';

            await Promise.all([
                loadAllAbsences(),
                loadAllEvents(),
                loadGradesAndMembers()
            ]);
        } catch (error) {
            console.error('Erreur lors du chargement des données utilisateur:', error);
        }
    }

    async function loadGradesAndMembers() {
        try {
            gradesAndMembersLoaded = false;

            const [gradesResponse, membersResponse] = await Promise.all([
                fetch('/api/calendar/grades'),
                fetch('/api/calendar/members')
            ]);


            if (!gradesResponse.ok) {
                const errorText = await gradesResponse.text();
                console.error('Erreur grades:', errorText);
                availableGrades = [];
            } else {
                availableGrades = await gradesResponse.json();
            }

            if (!membersResponse.ok) {
                const errorText = await membersResponse.text();
                console.error('Erreur membres:', errorText);
                availableMembers = [];
            } else {
                availableMembers = await membersResponse.json();

            }

            if (availableGrades.length > 0 || availableMembers.length > 0) {
                gradesAndMembersLoaded = true;
            }

            populateGradesSelector();
            populateMembersSelector();
        } catch (error) {
            console.error('❌ Erreur lors du chargement des grades et membres:', error);
            availableGrades = [];
            availableMembers = [];
            gradesAndMembersLoaded = false;
        }
    }

    function populateGradesSelector() {
        const select = document.getElementById('eventGrades');
        if (!select) {
            console.error('Élément eventGrades introuvable !');
            return;
        }
        select.innerHTML = '';

        availableGrades.forEach(grade => {
            const option = document.createElement('option');
            option.value = grade.id;
            option.textContent = grade.name;
            select.appendChild(option);
        });
    }

    function populateMembersSelector() {
        const select = document.getElementById('eventPersonnes');
        if (!select) {
            console.error('Élément eventPersonnes introuvable !');
            return;
        }
        select.innerHTML = '';

        availableMembers.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.displayName;
            select.appendChild(option);
        });
    }

    async function loadAllAbsences() {
        try {
            showLoader();
            const response = await fetch('/api/absence');

            if (!response.ok) {
                throw new Error('Erreur lors du chargement des absences');
            }

            allAbsences = await response.json();
            updateStatistics();
            updateCurrentView();
            hideLoader();
        } catch (error) {
            console.error('Erreur lors du chargement des absences:', error);
            hideLoader();
        }
    }

    async function loadAllEvents() {
        try {
            const response = await fetch('/api/calendar/events');

            if (!response.ok) {
                throw new Error('Erreur lors du chargement des événements');
            }

            const allEventsData = await response.json();

            allEvents = allEventsData.filter(event => isEventVisibleForUser(event));

            updateStatistics();
            updateCurrentView();
        } catch (error) {
            console.error('Erreur lors du chargement des événements:', error);
        }
    }

    function isEventVisibleForUser(event) {
        if (currentUser.isSupervisor || currentUser.isCommandStaff) {
            return true;
        }

        const hasGradesFilter = event.grades_concernes && Array.isArray(event.grades_concernes) && event.grades_concernes.length > 0;
        const hasPersonnesFilter = event.personnes_concernees && Array.isArray(event.personnes_concernees) && event.personnes_concernees.length > 0;

        if (!hasGradesFilter && !hasPersonnesFilter) {
            return true;
        }

        if (hasPersonnesFilter && event.personnes_concernees.includes(currentUser.id)) {
            return true;
        }

        if (hasGradesFilter && currentUser.roles) {
            const userHasGrade = event.grades_concernes.some(gradeId => currentUser.roles.includes(gradeId));
            if (userHasGrade) {
                return true;
            }
        }

        return false;
    }

    function initializePage() {
        updateCalendar();
        document.getElementById('currentMonth').textContent =
            currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

        const today = new Date().toISOString().split('T')[0];
        document.getElementById('eventDateDebut').value = today;
        document.getElementById('eventDateFin').value = today;
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

        document.getElementById('prevWeek').addEventListener('click', () => {
            currentWeekStart.setDate(currentWeekStart.getDate() - 7);
            updateWeekView();
        });

        document.getElementById('nextWeek').addEventListener('click', () => {
            currentWeekStart.setDate(currentWeekStart.getDate() + 7);
            updateWeekView();
        });

        document.getElementById('monthView').addEventListener('click', () => {
            showMonthView();
        });

        document.getElementById('weekView').addEventListener('click', () => {
            showWeekView();
        });

        document.getElementById('listView').addEventListener('click', () => {
            showListView();
        });

        document.getElementById('statusFilter').addEventListener('change', updateListView);
        document.getElementById('typeFilterList').addEventListener('change', updateListView);
        document.getElementById('searchFilter').addEventListener('input', updateListView);

        window.addEventListener('click', (event) => {
            if (event.target === document.getElementById('absenceModal')) {
                closeModal();
            }
            if (event.target === document.getElementById('eventModal')) {
                closeEventModal();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeModal();
                closeEventModal();
            }
        });

        document.getElementById('eventForm').addEventListener('submit', handleEventSubmit);
    }

    function updateStatistics() {
        const filteredAbsences = getFilteredAbsences();

        const validAbsences = filteredAbsences.filter(a => a.statut !== 'refuse');
        const total = validAbsences.length;
        const approved = filteredAbsences.filter(a => a.statut === 'approuve').length;
        const pending = filteredAbsences.filter(a => a.statut === 'en_attente').length;
        const totalEvents = allEvents.length;

        document.getElementById('totalAbsences').textContent = total;
        document.getElementById('approvedAbsences').textContent = approved;
        document.getElementById('pendingAbsences').textContent = pending;
        document.getElementById('totalEvents').textContent = totalEvents;
    }

    function updateCurrentView() {
        if (currentView === 'month') {
            updateCalendar();
        } else if (currentView === 'week') {
            updateWeekView();
        } else if (currentView === 'list') {
            updateListView();
        }
    }

    function getFilteredAbsences() {
        if (absenceFilter === 'mine' && currentUser) {
            const userName = currentUser.guild_member?.nick || currentUser.username;

            return allAbsences.filter(absence =>
                absence.officier === userName
            );
        }
        return allAbsences;
    }

    window.toggleAbsenceFilter = function (filter) {
        absenceFilter = filter;

        document.getElementById('btnShowAll').classList.toggle('active', filter === 'all');
        document.getElementById('btnShowMine').classList.toggle('active', filter === 'mine');

        updateStatistics();
        updateCurrentView();
    };

    function updateCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        document.getElementById('currentMonth').textContent =
            new Date(year, month).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

        const firstDay = new Date(year, month, 1);
        const startDate = new Date(firstDay);
        const dayOfWeek = firstDay.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startDate.setDate(startDate.getDate() + diff);

        const calendarGrid = document.getElementById('calendarGrid');
        calendarGrid.innerHTML = '';

        const dayHeaders = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        dayHeaders.forEach(day => {
            const header = document.createElement('div');
            header.style.fontWeight = 'bold';
            header.style.textAlign = 'center';
            header.style.padding = '10px';
            header.style.background = '#f0f2f5';
            header.textContent = day;
            calendarGrid.appendChild(header);
        });

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

        const filteredAbsences = getFilteredAbsences();
        const dayAbsences = filteredAbsences.filter(absence => {
            if (absence.statut === 'refuse') return false;

            const startDate = new Date(absence.date_debut);
            const endDate = new Date(absence.date_fin);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            const checkDate = new Date(date);
            checkDate.setHours(12, 0, 0, 0);
            return checkDate >= startDate && checkDate <= endDate;
        });

        const dayEvents = allEvents.filter(event => {
            const startDate = new Date(event.date_debut);
            const endDate = new Date(event.date_fin);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            const checkDate = new Date(date);
            checkDate.setHours(12, 0, 0, 0);
            return checkDate >= startDate && checkDate <= endDate;
        });

        const allItems = [...dayEvents, ...dayAbsences];

        if (allItems.length > 0) {
            dayCell.classList.add('has-items');

            allItems.slice(0, 3).forEach(item => {
                const itemCard = document.createElement('div');
                itemCard.className = 'calendar-item-card';

                if (item.statut) {
                    itemCard.classList.add(item.statut === 'approuve' ? 'approved' : 'pending');
                    itemCard.innerHTML = `<span class="item-text">${item.officier}</span>`;
                    itemCard.title = `${item.officier} - ${item.type_absence}`;
                } else {
                    itemCard.classList.add('event');
                    itemCard.style.borderLeftColor = item.couleur || '#3498db';
                    itemCard.innerHTML = `<span class="item-text">${item.titre}</span>`;
                    itemCard.title = item.titre;
                }

                dayCell.appendChild(itemCard);
            });

            if (allItems.length > 3) {
                const moreIndicator = document.createElement('div');
                moreIndicator.className = 'more-indicator';
                moreIndicator.textContent = `+${allItems.length - 3}`;
                dayCell.appendChild(moreIndicator);
            }

            dayCell.addEventListener('click', () => {
                showDayDetails(date, dayAbsences, dayEvents);
            });
        }

        return dayCell;
    }

    function getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    function updateWeekView() {
        const weekGrid = document.getElementById('weekGrid');
        weekGrid.innerHTML = '';

        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 6);

        document.getElementById('currentWeek').textContent =
            `${currentWeekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;

        const header = document.createElement('div');
        header.className = 'week-header';

        const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
        dayNames.forEach((dayName, index) => {
            const dayDate = new Date(currentWeekStart);
            dayDate.setDate(currentWeekStart.getDate() + index);

            const headerCell = document.createElement('div');
            headerCell.className = 'week-day-header';
            headerCell.innerHTML = `
                <div class="day-name">${dayName}</div>
                <div class="day-date">${dayDate.getDate()}/${dayDate.getMonth() + 1}</div>
            `;
            header.appendChild(headerCell);
        });
        weekGrid.appendChild(header);

        const content = document.createElement('div');
        content.className = 'week-content';

        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(currentWeekStart);
            dayDate.setDate(currentWeekStart.getDate() + i);

            const dayColumn = document.createElement('div');
            dayColumn.className = 'week-day-column';

            const filteredAbsences = getFilteredAbsences();
            const dayAbsences = filteredAbsences.filter(absence => {
                if (absence.statut === 'refuse') return false;

                const startDate = new Date(absence.date_debut);
                const endDate = new Date(absence.date_fin);
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(23, 59, 59, 999);
                const checkDate = new Date(dayDate);
                checkDate.setHours(12, 0, 0, 0);
                return checkDate >= startDate && checkDate <= endDate;
            });

            const dayEvents = allEvents.filter(event => {
                const startDate = new Date(event.date_debut);
                const endDate = new Date(event.date_fin);
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(23, 59, 59, 999);
                const checkDate = new Date(dayDate);
                checkDate.setHours(12, 0, 0, 0);
                return checkDate >= startDate && checkDate <= endDate;
            });

            dayEvents.forEach(event => {
                const eventCard = document.createElement('div');
                eventCard.className = 'week-event-card event';
                eventCard.style.borderLeft = `4px solid ${event.couleur || '#3498db'}`;
                eventCard.innerHTML = `
                    <div class="event-title">${event.titre}</div>
                    <div class="event-time">${event.type_evenement}</div>
                `;
                eventCard.addEventListener('click', () => showEventDetails(event));
                dayColumn.appendChild(eventCard);
            });

            dayAbsences.forEach(absence => {
                const absenceCard = document.createElement('div');
                absenceCard.className = `week-event-card ${absence.statut === 'approuve' ? 'approved' : absence.statut === 'en_attente' ? 'pending' : 'rejected'}`;
                absenceCard.innerHTML = `
                    <div class="event-title">${absence.officier}</div>
                    <div class="event-time">${absence.type_absence}</div>
                `;
                absenceCard.addEventListener('click', () => showAbsenceDetails([absence]));
                dayColumn.appendChild(absenceCard);
            });

            content.appendChild(dayColumn);
        }
        weekGrid.appendChild(content);
    }

    function updateListView() {
        const typeFilter = document.getElementById('typeFilterList').value;
        const statusFilter = document.getElementById('statusFilter').value;
        const searchQuery = document.getElementById('searchFilter').value.toLowerCase();

        let items = [];

        if (typeFilter === '' || typeFilter === 'absence') {
            let filteredAbsences = [...getFilteredAbsences()];
            filteredAbsences = filteredAbsences.filter(a => a.statut !== 'refuse');
            if (statusFilter) {
                filteredAbsences = filteredAbsences.filter(a => a.statut === statusFilter);
            }
            if (searchQuery) {
                filteredAbsences = filteredAbsences.filter(a =>
                    a.officier.toLowerCase().includes(searchQuery)
                );
            }
            items.push(...filteredAbsences.map(a => ({ ...a, type: 'absence' })));
        }

        if (typeFilter === '' || typeFilter === 'evenement') {
            let filteredEvents = [...allEvents];

            if (searchQuery) {
                filteredEvents = filteredEvents.filter(e =>
                    e.titre.toLowerCase().includes(searchQuery) ||
                    e.auteur.toLowerCase().includes(searchQuery)
                );
            }

            items.push(...filteredEvents.map(e => ({ ...e, type: 'evenement' })));
        }

        items.sort((a, b) => new Date(b.date_debut) - new Date(a.date_debut));

        const container = document.getElementById('absencesList');
        container.innerHTML = '';

        if (items.length === 0) {
            container.innerHTML = '<div class="no-results">Aucun element trouve</div>';
            return;
        }

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'absence-card';

            if (item.type === 'absence') {
                card.innerHTML = `
                    <div class="absence-header">
                        <div class="absence-info">
                            <span class="absence-name">${item.officier}</span>
                            <span class="absence-grade">${item.grade}</span>
                        </div>
                        <span class="absence-status ${item.statut}">
                            ${item.statut === 'approuve' ? 'Approuvee' : item.statut === 'en_attente' ? 'En attente' : 'Refusee'}
                        </span>
                    </div>
                    <div class="absence-body">
                        <div class="absence-dates">
                            <span>Du ${formatDate(item.date_debut)} au ${formatDate(item.date_fin)}</span>
                        </div>
                        <div class="absence-type">
                            <span>Type: ${item.type_absence}</span>
                        </div>
                        <div class="absence-motif">
                            <strong>Motif:</strong> ${item.motif}
                        </div>
                    </div>
                `;
                card.addEventListener('click', () => showAbsenceDetails([item]));
            } else {
                card.innerHTML = `
                    <div class="absence-header" style="border-left: 4px solid ${item.couleur || '#3498db'}">
                        <div class="absence-info">
                            <span class="absence-name">${item.titre}</span>
                            <span class="absence-grade">${item.type_evenement}</span>
                        </div>
                        <span class="event-author">Par ${item.auteur}</span>
                    </div>
                    <div class="absence-body">
                        <div class="absence-dates">
                            <span>Du ${formatDate(item.date_debut)} au ${formatDate(item.date_fin)}</span>
                        </div>
                        ${item.lieu ? `<div class="absence-type"><span>Lieu: ${item.lieu}</span></div>` : ''}
                        ${item.description ? `<div class="absence-motif"><strong>Description:</strong> ${item.description}</div>` : ''}
                    </div>
                `;
                card.addEventListener('click', () => showEventDetails(item));
            }

            container.appendChild(card);
        });
    }

    function showMonthView() {
        currentView = 'month';
        document.getElementById('calendar-container').style.display = 'block';
        document.getElementById('week-container').style.display = 'none';
        document.getElementById('list-container').style.display = 'none';

        document.querySelectorAll('.view-toggle .btn-filter').forEach(btn => btn.classList.remove('active'));
        document.getElementById('monthView').classList.add('active');

        updateCalendar();
    }

    function showWeekView() {
        currentView = 'week';
        document.getElementById('calendar-container').style.display = 'none';
        document.getElementById('week-container').style.display = 'block';
        document.getElementById('list-container').style.display = 'none';

        document.querySelectorAll('.view-toggle .btn-filter').forEach(btn => btn.classList.remove('active'));
        document.getElementById('weekView').classList.add('active');

        currentWeekStart = getWeekStart(new Date());
        updateWeekView();
    }

    function showListView() {
        currentView = 'list';
        document.getElementById('calendar-container').style.display = 'none';
        document.getElementById('week-container').style.display = 'none';
        document.getElementById('list-container').style.display = 'block';

        document.querySelectorAll('.view-toggle .btn-filter').forEach(btn => btn.classList.remove('active'));
        document.getElementById('listView').classList.add('active');

        updateListView();
    }

    function showDayDetails(date, absences, events) {

        const modal = document.getElementById('absenceModal');
        const detailsDiv = document.getElementById('absenceDetails');

        if (!modal || !detailsDiv) {
            console.error('Modal ou detailsDiv non trouvé');
            return;
        }

        const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        let html = `<h3 style="color: var(--main-color); margin-bottom: 20px;">${dateStr}</h3>`;

        if (!gradesAndMembersLoaded) {
            html += `
                <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 12px; margin-bottom: 20px; border-radius: 4px;">
                    <p style="margin: 0; color: #856404; font-size: 14px;">
                        ⚠️ Les noms des grades et personnes sont en cours de chargement. Les IDs seront affichés temporairement.
                    </p>
                </div>
            `;
        }

        if (events.length === 0 && absences.length === 0) {
            html += '<p>Aucun événement ou absence pour cette date.</p>';
        }

        if (events.length > 0) {
            html += `<div class="details-section"><h4>Evenements (${events.length})</h4>`;
            events.forEach(event => {
                html += `
                    <div class="detail-item" style="border-left: 4px solid ${event.couleur || '#3498db'}; background: ${event.couleur ? event.couleur + '15' : '#e3f2fd'};">
                        <strong style="font-size: 16px; color: ${event.couleur || '#3498db'};">${event.titre}</strong>
                        <p><strong>Type:</strong> ${event.type_evenement}</p>
                `;

                const dateDebut = new Date(event.date_debut);
                const dateFin = new Date(event.date_fin);
                const heureDebut = dateDebut.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                const heureFin = dateFin.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

                html += `<p><strong>Horaire:</strong> ${heureDebut} - ${heureFin}</p>`;

                if (event.lieu) {
                    html += `<p><strong>Lieu:</strong> ${event.lieu}</p>`;
                }

                if (event.description) {
                    html += `<p style="margin-top: 10px; font-style: italic;"><strong>Description :</strong> ${event.description}</p>`;
                }

                if (event.grades_concernes && event.grades_concernes.length > 0) {
                    const gradesNoms = event.grades_concernes.map(gradeId => {
                        const grade = availableGrades.find(g => g.id === gradeId);
                        return grade ? grade.name : `Grade inconnu (${gradeId.substring(0, 8)}...)`;
                    }).filter(Boolean);

                    if (gradesNoms.length > 0) {
                        html += `<p><strong>Grades concernés:</strong> ${gradesNoms.join(', ')}</p>`;
                    }
                }

                if (event.personnes_concernees && event.personnes_concernees.length > 0) {
                    const personnesNoms = event.personnes_concernees.map(personneId => {
                        const personne = availableMembers.find(m => m.id === personneId);
                        return personne ? personne.displayName : `Utilisateur inconnu (${personneId.substring(0, 8)}...)`;
                    }).filter(Boolean);

                    if (personnesNoms.length > 0) {
                        html += `<p><strong>Personnes concernées:</strong> ${personnesNoms.join(', ')}</p>`;
                    }
                }


                if ((!event.grades_concernes || event.grades_concernes.length === 0) &&
                    (!event.personnes_concernees || event.personnes_concernees.length === 0)) {
                    html += `<p><strong>Visibilité:</strong> Tous les membres LSPD</p>`;
                }

                html += `<p style="margin-top: 10px;"><small class="event-author">Créé par ${event.auteur}</small></p>`;

                if (currentUser && (currentUser.isSupervisor || currentUser.isCommandStaff || currentUser.isAdmin)) {
                    html += `
                        <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #e0e0e0; text-align: right;">
                            <button onclick="deleteEvent(${event.id})" class="btn-danger">
                                Supprimer cet événement
                            </button>
                        </div>
                    `;
                }

                html += `</div>`;
            });
            html += '</div>';
        }

        if (absences.length > 0) {
            html += `<div class="details-section"><h4>Absences (${absences.length})</h4>`;
            absences.forEach(absence => {
                const statusText = absence.statut === 'approuve' ? '✅ Approuvee' :
                    absence.statut === 'en_attente' ? '⏳ En attente' :
                        '❌ Refusee';
                html += `
                    <div class="detail-item ${absence.statut}">
                        <strong>${absence.officier}</strong> - ${absence.grade}
                        <p>Type: ${absence.type_absence}</p>
                        <p>Du ${new Date(absence.date_debut).toLocaleDateString('fr-FR')} au ${new Date(absence.date_fin).toLocaleDateString('fr-FR')}</p>
                        <p>Motif: ${absence.motif}</p>
                        <p><strong>Statut: ${statusText}</strong></p>
                    </div>
                `;
            });
            html += '</div>';
        }

        detailsDiv.innerHTML = html;
        modal.style.display = 'flex';
    }

    function showAbsenceDetails(absences) {
        if (absences && absences.length > 0) {
            showDayDetails(new Date(absences[0].date_debut), absences, []);
        }
    }

    function showEventDetails(event) {
        if (event) {
            showDayDetails(new Date(event.date_debut), [], [event]);
        }
    }

    async function handleEventSubmit(e) {
        e.preventDefault();

        const gradesSelect = document.getElementById('eventGrades');
        const gradesConcernes = Array.from(gradesSelect.selectedOptions).map(opt => opt.value);

        const personnesSelect = document.getElementById('eventPersonnes');
        const personnesConcernees = Array.from(personnesSelect.selectedOptions).map(opt => opt.value);

        const eventData = {
            titre: document.getElementById('eventTitle').value,
            description: document.getElementById('eventDescription').value,
            dateDebut: document.getElementById('eventDateDebut').value,
            dateFin: document.getElementById('eventDateFin').value,
            heureDebut: document.getElementById('eventHeureDebut').value || '00:00',
            heureFin: document.getElementById('eventHeureFin').value || '23:59',
            typeEvenement: document.getElementById('eventType').value,
            couleur: document.getElementById('eventCouleur').value,
            lieu: document.getElementById('eventLieu').value,
            auteur: currentUser?.guild_member?.nick || currentUser?.username || 'Inconnu',
            gradesConcernes: gradesConcernes.length > 0 ? gradesConcernes : null,
            personnesConcernees: personnesConcernees.length > 0 ? personnesConcernees : null
        };

        try {
            showLoader();
            const response = await fetch('/api/calendar/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventData)
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la creation de l\'evenement');
            }

            await loadAllEvents();
            closeEventModal();
            document.getElementById('eventForm').reset();

            showSuccess('✅ Événement créé avec succès !');
            hideLoader();
        } catch (error) {
            console.error('Erreur lors de la creation de l\'evenement:', error);
            showError('❌ Erreur lors de la création de l\'événement');
            hideLoader();
        }
    }

    function formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('fr-FR');
    }

    function closeModal() {
        document.getElementById('absenceModal').style.display = 'none';
    }

    window.openEventModal = function () {
        document.getElementById('eventModal').style.display = 'flex';
    };

    window.closeEventModal = function () {
        document.getElementById('eventModal').style.display = 'none';
    };

    window.deleteEvent = async function (eventId) {
        const confirmed = await showConfirm(
            'Supprimer cet événement ?',
            'Êtes-vous sûr de vouloir supprimer cet événement ? Cette action est irréversible.'
        );

        if (!confirmed) {
            return;
        }

        try {
            showLoader();
            const response = await fetch(`/api/calendar/events/${eventId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erreur lors de la suppression');
            }

            await loadAllEvents();

            closeModal();

            showSuccess('✅ Événement supprimé avec succès !');
            hideLoader();
        } catch (error) {
            console.error('Erreur lors de la suppression de l\'événement:', error);
            showError('❌ Erreur lors de la suppression : ' + error.message);
            hideLoader();
        }
    };

    function showLoader() {
        document.getElementById('loaderOverlay').style.display = 'flex';
    }

    function hideLoader() {
        document.getElementById('loaderOverlay').style.display = 'none';
    }

    function showSuccess(message) {
        removeExistingMessages();
        const successDiv = document.createElement('div');
        successDiv.className = 'message success-message';
        successDiv.innerHTML = `
            <span style="flex: 1;">${message}</span>
        `;
        document.querySelector('.main-container').insertBefore(successDiv, document.querySelector('.header').nextSibling);

        setTimeout(() => {
            successDiv.style.animation = 'slideOutUp 0.3s ease';
            setTimeout(() => successDiv.remove(), 300);
        }, 5000);
    }

    function showError(message) {
        removeExistingMessages();
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message error-message';
        errorDiv.innerHTML = `
            <span style="flex: 1;">${message}</span>
        `;
        document.querySelector('.main-container').insertBefore(errorDiv, document.querySelector('.header').nextSibling);

        setTimeout(() => {
            errorDiv.style.animation = 'slideOutUp 0.3s ease';
            setTimeout(() => errorDiv.remove(), 300);
        }, 5000);
    }

    function removeExistingMessages() {
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());
    }

    function showConfirm(title, message) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmModal');
            const titleElement = document.getElementById('confirmTitle');
            const messageElement = document.getElementById('confirmMessage');
            const confirmBtn = document.getElementById('confirmOk');
            const cancelBtn = document.getElementById('confirmCancel');

            titleElement.textContent = title;
            messageElement.textContent = message;
            modal.style.display = 'flex';

            function cleanup() {
                modal.style.display = 'none';
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
                modal.removeEventListener('click', handleOutsideClick);
                document.removeEventListener('keydown', handleEscape);
            }

            function handleConfirm() {
                cleanup();
                resolve(true);
            }

            function handleCancel() {
                cleanup();
                resolve(false);
            }

            function handleOutsideClick(event) {
                if (event.target === modal) {
                    cleanup();
                    resolve(false);
                }
            }

            function handleEscape(event) {
                if (event.key === 'Escape') {
                    cleanup();
                    resolve(false);
                }
            }

            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
            modal.addEventListener('click', handleOutsideClick);
            document.addEventListener('keydown', handleEscape);
        });
    }

    // window.testSuccessMessage = function () {
    //     showSuccess('Ceci est un message de succès de test ! Lorem ipsum dolor sit amet, consectetur adipiscing elit.');
    // };

    // window.testErrorMessage = function () {
    //     showError('Ceci est un message d\'erreur de test ! Une erreur s\'est produite lors de l\'opération. Veuillez réessayer plus tard.');
    // };

    // window.testConfirmModal = async function () {
    //     const result = await showConfirm(
    //         'Test de confirmation',
    //         'Ceci est un test de la modal de confirmation. Voulez-vous continuer ?'
    //     );
    //     if (result) {
    //         showSuccess('Vous avez cliqué sur Confirmer !');
    //     } else {
    //         showError('Vous avez cliqué sur Annuler !');
    //     }
    // };
});
