// Récupérer l'ID depuis l'URL
const urlParams = new URLSearchParams(window.location.search);
const convocationId = urlParams.get('id');

// Éléments du formulaire
const agentInput = document.getElementById('agent');
const dateInput = document.getElementById('date');
const lieuInput = document.getElementById('lieu');
const raisonInput = document.getElementById('raison');
const commentaireInput = document.getElementById('commentaire');
const officierInput = document.getElementById('officier');
const gradeInput = document.getElementById('grade');
const createdAtInput = document.getElementById('created_at');
const backButton = document.getElementById('backButton');

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

        // Gestion de la sauvegarde du commentaire via le bouton
        const ajouterBtn = document.getElementById('ajouterCommentaireBtn');
        const savedMsg = document.getElementById('commentaireSavedMsg');
        if (ajouterBtn) {
            ajouterBtn.addEventListener('click', async function() {
                const newComment = commentaireInput.value;
                try {
                    const res = await fetch(`/api/convocationsAgents/${convocationId}/commentaire`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ commentaire: newComment })
                    });
                    if (!res.ok) throw new Error('Erreur lors de la sauvegarde du commentaire');

                    // Affiche le checkmark SVG animé comme dans incident.js
                    const container = document.getElementById('feedbackAnimation');
                    container.innerHTML = '';
                    const content = document.createElement('div');
                    content.className = 'feedback-inner';
                    content.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
                          <circle class="path circle" fill="none" stroke="#0b1b5a" stroke-width="8" cx="65.1" cy="65.1" r="60"/>
                          <polyline class="path check" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-linecap="round" points="100.2,40.2 51.5,88.8 29.8,67.5"/>
                        </svg>
                        <p class="success">Commentaire ajouté avec succès</p>
                    `;
                    container.appendChild(content);
                    container.style.display = 'flex';
                    setTimeout(() => {
                        container.classList.add('fade-out');
                        container.addEventListener('transitionend', () => {
                            location.reload();
                        }, { once: true });
                    }, 1200);
                } catch (e) {
                    alert('Erreur lors de la sauvegarde du commentaire');
                }
            });
        }

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