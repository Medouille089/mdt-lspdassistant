let editBy = null;
let userInfo = null; // Stocker les infos utilisateur complètes

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loaderOverlay').style.display = 'flex';

    // Charger les infos utilisateur
    fetch("/api/user")
        .then((res) => res.json())
        .then((user) => {
            editBy = user.username || 'Utilisateur inconnu';
            userInfo = user; // Stocker toutes les infos utilisateur

            // Masquer le bouton et désactiver les inputs si utilisateur DOJ
            if (user.isDOJ && !user.isLSPD && !user.isSuperAdmin) {
                const updateButton = document.querySelector(".send-button");
                if (updateButton) {
                    updateButton.style.display = 'none';
                }

                // Désactiver tous les inputs et textareas
                const inputs = document.querySelectorAll('input, textarea, select');
                inputs.forEach(input => {
                    input.readOnly = true;
                    input.disabled = true;
                    input.style.backgroundColor = '#f5f5f5';
                    input.style.cursor = 'not-allowed';
                });
            }
        })
        .catch((err) => {
            console.error("Erreur chargement utilisateur :", err);
        });
});

// Format date "yyyy-mm-ddT22:00:00" en "dd/mm/yyyy"
function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('T')[0].split('-');
    return `${y}-${m}-${d}`;
}

const urlParams = new URLSearchParams(window.location.search);
const id = urlParams.get('id');
if (!id) {
    showAnimation('error').then(() => {
    window.location.href = '/liste-convocations';
    });
}

if (id) {
    document.title = `Convocation - ${id}`;
} else {
    document.title = "Convocation - Aucun ID";
}

if (id) {
    document.title = `Convocation - ${id}`;
    const titres = document.querySelectorAll('h1, h3');
    titres.forEach(el => {
        el.textContent = `Convocation - ${id}`;
    });
} else {
    document.title = "Convocation - Aucun ID";
}

const nom = document.getElementById('nom-input');
const prenom = document.getElementById('prenom-input');
const dateInput = document.getElementById('date-input');
const heureInput = document.getElementById('heure-input');
const lieuInput = document.getElementById('lieu-input');
const motifInput = document.getElementById('motif-input');
const officierInput = document.getElementById('officier');
const gradeInput = document.getElementById('grade');


// Chargement des informations depuis la bdd
async function loadConvocationDetail() {
    try {
        const res = await fetch('/api/getConvocation');
        if (!res.ok) throw new Error('Erreur chargement');
        const convocations = await res.json();
        const convocation = convocations.find(i => i.id == id);
        if (!convocation) throw new Error('Convocation non trouvée');
        nom.value = convocation.nom || '';
        prenom.value = convocation.prenom || '';
        officierInput.value = convocation.officier || '';
        gradeInput.value = convocation.grade || '';
        dateInput.value = formatDate(convocation.date) || '';
        heureInput.value = convocation.heure || '';
        motifInput.value = convocation.motif || '';
        officierInput.value = convocation.officer || '';
        gradeInput.value = convocation.grade || '';

    } catch (err) {
        console.error(err);
    } finally {
        document.getElementById('loaderOverlay').style.display = 'none';
    }
}

loadConvocationDetail();