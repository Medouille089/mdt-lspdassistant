document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loaderOverlay').style.display = 'flex';
});

const urlParams = new URLSearchParams(window.location.search);
const id = urlParams.get('id');
if (!id) {
    showAnimation('error').then(() => {
        window.location.href = 'getIncident.html';
    });
}

if (id) {
    document.title = `Rapport d'incident - ${id}`;
} else {
    document.title = "Rapport d'incident - Aucun ID";
}

if (id) {
    document.title = `Rapport d'incident - ${id}`;
    const titres = document.querySelectorAll('h1, h3');
    titres.forEach(el => {
        el.textContent = `RAPPORT D'INCIDENT - ${id}`;
    });
} else {
    document.title = "Rapport d'incident - Aucun ID";
}

const officierInput = document.getElementById('officier');
const gradeInput = document.getElementById('grade');
const dateInput = document.getElementById('date');
const heureInput = document.getElementById('heure');
const recitInput = document.getElementById('recit');
const impliqueInput = document.getElementById('implique');
const typeInput = document.getElementById('type');
const lieuInput = document.getElementById('lieu');

// Fonction d'affichage plein écran
function enableFullscreenOnImages() {
    const overlay = document.getElementById('fullscreenOverlay');
    const fullscreenImg = document.getElementById('fullscreenImage');
    const closeBtn = document.getElementById('fullscreenClose');

    document.querySelectorAll('#incidents-container img').forEach(img => {
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', () => {
            fullscreenImg.src = img.src;
            overlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        });
    });

    closeBtn.addEventListener('click', () => {
        overlay.style.display = 'none';
        fullscreenImg.src = '';
        document.body.style.overflow = '';
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.display = 'none';
            fullscreenImg.src = '';
            document.body.style.overflow = '';
        }
    });
}

// Chargement des informations depuis la bdd
async function loadIncidentDetail() {
    const loader = document.getElementById('loaderOverlay');
    loader.style.display = 'flex';
    try {
        const res = await fetch('/api/getIncident');
        if (!res.ok) throw new Error('Erreur chargement');
        const incidents = await res.json();
        const incident = incidents.find(i => i.id == id);
        if (!incident) throw new Error('Incident non trouvé');

        officierInput.value = incident.officier || '';
        gradeInput.value = incident.grade || '';
        dateInput.value = incident.date || '';
        heureInput.value = incident.heure || '';
        recitInput.value = incident.recit || '';
        impliqueInput.value = incident.implique || '';
        typeInput.value = incident.type || '';
        lieuInput.value = incident.lieu || '';

        const container = document.getElementById('incidents-container');
        container.innerHTML = '';

        if (incident.images && incident.images.length > 0) {
            // Créer toutes les images
            const imgElements = incident.images.map(url => {
                const img = document.createElement('img');
                img.src = url;
                img.alt = 'Pièce jointe';
                img.style.maxWidth = '200px';
                img.style.margin = '5px';
                container.appendChild(img);
                return img;
            });

            // Attendre que toutes les images soient chargées (ou erreurs)
            await Promise.all(imgElements.map(img => new Promise((resolve) => {
                if (img.complete) {
                    resolve();
                } else {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                }
            })));

            enableFullscreenOnImages();

        } else {
            container.textContent = 'Aucune pièce jointe disponible.';
        }

    } catch (err) {
        console.error(err);
    } finally {
        loader.style.display = 'none';
    }
}

loadIncidentDetail();