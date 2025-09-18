document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('absenceForm');
    const loader = document.getElementById("loaderOverlay");

    // Afficher le loader au démarrage
    loader.style.display = "flex";

    fetch("/api/user")
        .then((res) => res.json())
        .then((user) => {
            document.getElementById("officier").value = user.username;
            document.getElementById("grade").value = user.grade;
        })
        .catch((err) => {
            console.error("Erreur chargement utilisateur :", err);
            document.getElementById("officier").value = "Erreur de chargement";
            document.getElementById("grade").value = "";
        })
        .finally(() => {
            // Cacher le loader après le fetch
            loader.style.display = "none";
        });

    const dateDebutInput = document.getElementById('dateDebut');
    const dateFinInput = document.getElementById('dateFin');
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const minDate = `${yyyy}-${mm}-${dd}`;
    dateDebutInput.setAttribute('min', minDate);
    dateFinInput.setAttribute('min', minDate);

    dateDebutInput.addEventListener('change', function () {
        dateFinInput.setAttribute('min', dateDebutInput.value);
        if (dateFinInput.value < dateDebutInput.value) {
            dateFinInput.value = dateDebutInput.value;
        }
    });


    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        let hasError = false;
        const loader = document.getElementById("loaderOverlay");

        if (!validateForm()) {
            return;
        }

        const formData = new FormData(form);

        const absenceData = {
            officier: formData.get('officier'),
            grade: formData.get('grade'),
            dateDebut: formData.get('dateDebut'),
            dateFin: formData.get('dateFin'),
            heureDebut: formData.get('heureDebut'),
            heureFin: formData.get('heureFin'),
            typeAbsence: formData.get('typeAbsence'),
            motif: formData.get('motif'),
            justificatif: formData.get('urgent') === 'on'
        };

        try {
            loader.style.display = "flex";

            const response = await fetch('/api/absence', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(absenceData)
            });

            if (response.ok) {
                const result = await response.json();
                showSuccess('Absence enregistrée avec succès !');
                form.reset();
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Erreur lors de l\'enregistrement');
            }
        } catch (error) {
            hasError = true;
            console.error('Erreur:', error);
            loader.style.display = 'none';

            await showAnimation('error');
            showError('Erreur lors de l\'enregistrement de l\'absence: ' + error.message);
        } finally {
            if (!hasError) {
                loader.style.display = 'none';
                await showAnimation('success');

                const container = document.getElementById('feedbackAnimation');
                container.classList.add('fade-out');

                container.addEventListener('transitionend', () => {
                    location.reload();
                }, { once: true });
            }
        }


    });

    function showAnimation(type = 'success') {
        return new Promise((resolve) => {
            const container = document.getElementById('feedbackAnimation');
            container.innerHTML = '';

            const content = document.createElement('div');
            content.className = 'feedback-inner';

            if (type === 'success') {
                content.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
          <circle class="path circle" fill="none" stroke="#0b1b5a" stroke-width="8" cx="65.1" cy="65.1" r="60"/>
          <polyline class="path check" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-linecap="round" points="100.2,40.2 51.5,88.8 29.8,67.5"/>
        </svg>
        <p class="success">Absence soumise avec succès!</p>
      `;
            } else {
                content.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
          <circle class="path circle" fill="none" stroke="#D06079" stroke-width="8" cx="65.1" cy="65.1" r="60"/>
          <line class="path line" fill="none" stroke="#D06079" stroke-width="8" x1="34.4" y1="37.9" x2="95.8" y2="92.3"/>
          <line class="path line" fill="none" stroke="#D06079" stroke-width="8" x1="95.8" y1="38" x2="34.4" y2="92.2"/>
        </svg>
        <p class="error">Erreur lors de la soumission de l'absence</p>
      `;
            }

            container.appendChild(content);
            container.style.display = 'flex';

            setTimeout(() => resolve(), 1800);
        });
    }

    function validateForm() {
        const officier = document.getElementById('officier').value.trim();
        const grade = document.getElementById('grade').value.trim();
        const dateDebut = document.getElementById('dateDebut').value;
        const dateFin = document.getElementById('dateFin').value;
        const typeAbsence = document.getElementById('typeAbsence').value;
        const motif = document.getElementById('motif').value.trim();

        if (!officier || !grade) {
            showError('Veuillez remplir tous les champs obligatoires (Officier, Grade)');
            return false;
        }

        if (!dateDebut || !dateFin) {
            showError('Veuillez sélectionner les dates de début et de fin');
            return false;
        }

        if (new Date(dateFin) < new Date(dateDebut)) {
            showError('La date de fin ne peut pas être antérieure à la date de début');
            return false;
        }

        if (!typeAbsence) {
            showError('Veuillez sélectionner un type d\'absence');
            return false;
        }

        if (!motif) {
            showError('Veuillez préciser le motif de l\'absence');
            return false;
        }

        return true;
    }

    document.getElementById('dateDebut').addEventListener('change', function () {
        const dateDebut = this.value;
        const dateFin = document.getElementById('dateFin');

        if (dateDebut && !dateFin.value) {
            dateFin.value = dateDebut;
        }
    });

    document.getElementById('heureDebut').addEventListener('change', function () {
        const heureDebut = this.value;
        const heureFin = document.getElementById('heureFin');

        if (heureDebut && !heureFin.value) {
            const [hours, minutes] = heureDebut.split(':');
            const newHour = parseInt(hours) + 8;
            if (newHour <= 23) {
                heureFin.value = `${newHour.toString().padStart(2, '0')}:${minutes}`;
            }
        }
    });

    function showSuccess(message) {
        removeExistingMessages();
        const successDiv = document.createElement('div');
        successDiv.className = 'message success-message';
        successDiv.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20,6 9,17 4,12"></polyline>
            </svg>
            ${message}
        `;
        document.querySelector('.absence-container').insertBefore(successDiv, document.querySelector('form'));

        setTimeout(() => {
            successDiv.remove();
        }, 5000);
    }

    function showError(message) {
        removeExistingMessages();
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message error-message';
        errorDiv.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            ${message}
        `;
        document.querySelector('.absence-container').insertBefore(errorDiv, document.querySelector('form'));

        setTimeout(() => {
            errorDiv.remove();
        }, 7000);
    }

    function removeExistingMessages() {
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());
    }
});

const styles = `
<style>
.message {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 8px;
    margin-bottom: 20px;
    font-weight: 500;
    animation: slideInDown 0.3s ease;
}

.success-message {
    background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%);
    border: 2px solid #4caf50;
    color: #2e7d32;
}

.error-message {
    background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
    border: 2px solid #f44336;
    color: #c62828;
}

@keyframes slideInDown {
    from {
        transform: translateY(-20px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', styles);
