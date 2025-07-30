document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loaderOverlay').style.display = 'flex';
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
        window.location.href = 'getConvocation.html';
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
        console.log("Convocation trouvée :", convocation);
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