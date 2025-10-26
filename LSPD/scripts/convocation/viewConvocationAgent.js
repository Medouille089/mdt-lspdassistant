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