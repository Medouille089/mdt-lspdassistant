// Récupérer l'ID depuis l'URL
const urlParams = new URLSearchParams(window.location.search);
const convocationId = urlParams.get('id');

// Éléments du formulaire
const agentInput = document.getElementById('agent');
const dateInput = document.getElementById('date');
const lieuInput = document.getElementById('lieu');
const raisonInput = document.getElementById('raison');
const officierInput = document.getElementById('officier');
const gradeInput = document.getElementById('grade');
const createdAtInput = document.getElementById('created_at');
const backButton = document.getElementById('backButton');
const commentaireInput = document.getElementById('commentaire');
const saveCommentaireBtn = document.getElementById('saveCommentaireBtn');
// Provide a global showAnimation helper if not already defined by another script
if (typeof window.showAnimation !== 'function') {
    window.showAnimation = function (type = 'success', message = '') {
        const feedback = document.getElementById('feedbackAnimation');
        if (!feedback) return Promise.resolve();
        return new Promise((resolve) => {
            feedback.innerHTML = '';
            const content = document.createElement('div');
            content.className = 'feedback-inner';
            if (type === 'success') {
                content.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
                      <circle class="path circle" fill="none" stroke="#0b1b5a" stroke-width="8" cx="65.1" cy="65.1" r="60"/>
                      <polyline class="path check" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-linecap="round" points="100.2,40.2 51.5,88.8 29.8,67.5"/>
                    </svg>
                    <p class="success">${message || 'Opération réussie.'}</p>
                `;
            } else {
                content.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
                      <circle class="path circle" fill="none" stroke="#D06079" stroke-width="8" cx="65.1" cy="65.1" r="60"/>
                      <line class="path line" fill="none" stroke="#D06079" stroke-width="8" x1="34.4" y1="37.9" x2="95.8" y2="92.3"/>
                      <line class="path line" fill="none" stroke="#D06079" stroke-width="8" x1="95.8" y1="38" x2="34.4" y2="92.2"/>
                    </svg>
                    <p class="error">${message || 'Erreur.'}</p>
                `;
            }
            feedback.appendChild(content);
            feedback.style.display = 'flex';
            setTimeout(() => resolve(), 1200);
        });
    };
}

// Fonction pour formater la date et l'heure
function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Fonction pour formater juste la date
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
}

// Charger les détails de la convocation
async function loadConvocationDetails() {
    if (!convocationId) {
        alert('ID de convocation manquant');
        window.location.href = '/liste-convocations-agent';
        return;
    }

    const loader = document.getElementById('loaderOverlay');
    loader.style.display = 'flex';

    try {
        const response = await fetch('/api/getConvocationsAgents');
        if (!response.ok) throw new Error('Erreur lors du chargement');

        const convocations = await response.json();
        const convocation = convocations.find(c => c.id == convocationId);

        if (!convocation) {
            alert('Convocation introuvable');
            window.location.href = '/liste-convocations-agent';
            return;
        }

        // Remplir les champs
        agentInput.value = convocation.agent_convoque_nom || '';
        dateInput.value = formatDate(convocation.date) || '';
        lieuInput.value = convocation.lieu || '';
        raisonInput.value = convocation.raison || '';
        officierInput.value = convocation.agent_convoquant_nom || '';
        gradeInput.value = convocation.agent_convoquant_grade || '';
        createdAtInput.value = formatDateTime(convocation.created_at) || '';
        commentaireInput.value = convocation.commentaire || '';

        // Mettre à jour le titre de la page
        document.title = `Convocation Agent #${convocation.id} - LSPD Assistant`;

    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur lors du chargement des détails');
        window.location.href = '/liste-convocations-agent';
    } finally {
        loader.style.display = 'none';
    }
}


// Charger les détails au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    loadConvocationDetails();
    if (saveCommentaireBtn) {
        saveCommentaireBtn.addEventListener('click', async () => {
            const commentaire = commentaireInput.value;
            if (!convocationId) {
                await window.showAnimation('error', 'ID de convocation manquant');
                return;
            }
            saveCommentaireBtn.disabled = true;
            document.getElementById('loaderOverlay').style.display = 'flex';
            try {
                const response = await fetch(`/api/convocations_agents/${convocationId}/commentaire`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ commentaire })
                });
                const result = await response.json();
                if (result.success) {
                    await window.showAnimation('success', 'Commentaire sauvegardé !');
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                } else {
                    await window.showAnimation('error', result.error || 'Erreur lors de la sauvegarde');
                }
            } catch (err) {
                await window.showAnimation('error', 'Erreur serveur');
            } finally {
                saveCommentaireBtn.disabled = false;
                document.getElementById('loaderOverlay').style.display = 'none';
            }
        });
    }
});

(function () {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        const btn = document.getElementById('backlinkBtn');
        if (!btn) return;

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = '/getConvocationAgent';
            }
        });
    }
})();