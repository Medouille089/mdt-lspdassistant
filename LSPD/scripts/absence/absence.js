document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('absenceForm');
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
        });

    form.addEventListener('submit', async function (e) {
        e.preventDefault();

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
            showLoader();

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
            console.error('Erreur:', error);
            showError('Erreur lors de l\'enregistrement de l\'absence: ' + error.message);
        } finally {
            hideLoader();
        }
    });

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

    function showLoader() {
        const loader = document.createElement('div');
        loader.id = 'absence-loader';
        loader.className = 'loader-overlay';
        loader.innerHTML = `
            <div class="loader-spinner">
                <div class="spinner"></div>
                <p>Enregistrement en cours...</p>
            </div>
        `;
        document.body.appendChild(loader);
    }

    function hideLoader() {
        const loader = document.getElementById('absence-loader');
        if (loader) {
            loader.remove();
        }
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

.loader-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
}

.loader-spinner {
    background: white;
    padding: 30px;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.spinner {
    width: 40px;
    height: 40px;
    margin: 0 auto 15px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #0b1b5a;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
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
