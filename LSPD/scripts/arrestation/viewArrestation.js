document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loaderOverlay').style.display = 'flex';
});

const urlParams = new URLSearchParams(window.location.search);
const id = urlParams.get('id');
if (!id) {
    showAnimation('error').then(() => {
        window.location.href = 'getArrestation.html';
    });
}

if (id) {
    document.title = `Rapport d'arrestation - ${id}`;
} else {
    document.title = "Rapport d'arrestation - Aucun ID";
}

if (id) {
    document.title = `Rapport d'arrestation - ${id}`;
    const titres = document.querySelectorAll('h1, h3');
    titres.forEach(el => {
        el.textContent = `RAPPORT D'ARRESTATION - ${id}`;
    });
} else {
    document.title = "Rapport d'arrestation - Aucun ID";
}

const dateInput = document.getElementById('date');
const nameInput = document.getElementById('name');
const fileInput1 = document.getElementById('preview1');
const fileInput2 = document.getElementById('preview2');
const professionInput = document.getElementById('profession');
const ddnInput = document.getElementById('DDN');
const addressInput = document.getElementById('address');
const telInput = document.getElementById('tel');
const droitsInput = document.getElementById('droits');
const entreeCelluleInput = document.getElementById('entreecellule');
const sortieCelluleInput = document.getElementById('sortiecellule');
const braceletInput = document.getElementById('bracelet');
const mirandaInput = document.getElementById('miranda');
const avocatInput = document.getElementById('avocat');
const nourritureInput = document.getElementById('nourriture');
const emsInput = document.getElementById('ems');
const avocatNameInput = document.getElementById('avocatName');
const officerInput = document.getElementById('officier');
const gradeInput = document.getElementById('grade');
const lieuInput = document.getElementById('lieu');
const motifArrestationInput = document.getElementById('motifArrestation');
const circonstancesInput = document.getElementById('circonstances');
const armeInput = document.getElementById('arme');
const uofInput = document.getElementById('uof');
const listAccusations = document.getElementById('listAccusations');
const piecesInput = document.getElementById('pieces');


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
        const res = await fetch('/api/getArrestation');
        if (!res.ok) throw new Error('Erreur chargement');
        const arrestations = await res.json();
        const arrestation = arrestations.find(i => i.arrestationId == id);
        if (!arrestation) throw new Error('Rap. Arrestation non trouvé');

        console.log(arrestation);
        arrestation.date = arrestation.date.split('T')[0] + "T" + arrestation.date.split('T')[1].substring(0, 5);
        console.log(arrestation.date);
        arrestation.ddn = arrestation.ddn.split('T')[0];

        dateInput.value = arrestation.date || '';
        nameInput.value = arrestation.name || '';
        professionInput.value = arrestation.profession || '';
        ddnInput.value = arrestation.ddn || '';
        addressInput.value = arrestation.address || '';
        telInput.value = arrestation.tel || '';
        droitsInput.value = arrestation.droits || '';
        entreeCelluleInput.value = arrestation.entree_cellule || '';
        sortieCelluleInput.value = arrestation.sortie_cellule || '';
        braceletInput.value = arrestation.bracelet || '';
        mirandaInput.innerText = arrestation.miranda ? 'Oui' : 'Non';
        avocatInput.innerText = arrestation.avocat ? 'Oui' : 'Non';
        nourritureInput.innerText = arrestation.nourriture ? 'Oui' : 'Non';
        emsInput.innerText = arrestation.ems ? 'Oui' : 'Non';
        avocatNameInput.value = arrestation.avocatName || '';
        officerInput.value = arrestation.officer || '';
        gradeInput.value = arrestation.grade || '';
        lieuInput.value = arrestation.lieu || '';
        motifArrestationInput.value = arrestation.motifArrestation || '';
        circonstancesInput.value = arrestation.circonstances || '';
        armeInput.value = arrestation.arme || '';
        uofInput.textContent = arrestation.uof ? 'Oui' : 'Non';

        listAccusations.innerHTML = '';
        if (arrestation.accusations && arrestation.accusations.length > 0) {
            arrestation.accusations.forEach(accusation => {
                const li = document.createElement('li');
                li.textContent = accusation;
                listAccusations.appendChild(li);
            });
        }



        const container = document.getElementById('incident-container');
        container.innerHTML = '';
        console.log(arrestation.images);
        
        if (arrestation.images && arrestation.images.length > 0) {
            // Créer toutes les images
            let i = 1;
            const imgElements = arrestation.images.map(url => {
                if (i === 1) {
                    fileInput1.src = url
                } else if (i === 2) {
                    fileInput2.src = url
                } else {
                    const img = document.createElement('img');
                    img.src = url;
                    img.alt = 'Pièce jointe';
                    img.style.maxWidth = '200px';
                    img.style.margin = '5px';
                    container.appendChild(img);
                    return img;
                }
                i++;
                
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