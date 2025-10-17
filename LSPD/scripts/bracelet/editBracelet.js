const urlParams = new URLSearchParams(window.location.search);
const id = urlParams.get('id');
if (!id) {
    showAnimation('error').then(() => {
        window.location.href = 'liste-bracelets.html';
    });
}

const idInput = document.getElementById('id_brac');
const nomInput = document.getElementById('nom');
const prenomInput = document.getElementById('prenom');
const motifInput = document.getElementById('motif');
const telInput = document.getElementById('tel');
const dateDebutInput = document.getElementById('dateDebut');

const loaderOverlay = document.getElementById('loaderOverlay');

telInput.addEventListener('input', function () {
    let x = this.value.replace(/\D/g, '').slice(0, 10);
    if (x.length >= 1) x = '(' + x;
    if (x.length >= 4) x = x.slice(0, 4) + ') ' + x.slice(4);
    if (x.length >= 9) x = x.slice(0, 9) + '-' + x.slice(9);
    this.value = x;
});

const today = new Date().toISOString().split('T')[0];
dateDebutInput.min = today;
dateDebutInput.value = today;

const timestampDiv = document.getElementById("timestamp");
const now = new Date();
const timeStr = now.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' });
const dateStr = now.toLocaleDateString("fr-FR");
timestampDiv.textContent = `${dateStr} à ${timeStr}`;

async function loadBracelet() {
    try {
        const res = await fetch('/api/formulaires');
        if (!res.ok) throw new Error('Erreur chargement');
        const list = await res.json();
        const bracelet = list.find(b => b.id == id);
        if (!bracelet) {
            await showAnimation('error');
            window.location.href = 'liste-bracelets.html';
            return;
        }

        idInput.value = bracelet.id_brac;
        nomInput.value = bracelet.nom;
        prenomInput.value = bracelet.prenom;
        motifInput.value = bracelet.motif;
        telInput.value = bracelet.tel;
        dateDebutInput.value = bracelet.dateDebut;

        document.getElementById('id_brac_title').textContent = `- ${bracelet.id_brac}`;
        if (bracelet.created_by) {
            document.getElementById('createdBy').value = bracelet.created_by;
        } else {
            document.getElementById('createdBy').value = '—';
        }

    } catch (err) {
        await showAnimation('error');
        console.error(err);
    }
}

// --- Popup elements ---
const customConfirmDelete = document.getElementById('customConfirmDelete');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

const customConfirmModify = document.getElementById('customConfirmModify');
const cancelModifyBtn = document.getElementById('cancelModifyBtn');
const confirmModifyBtn = document.getElementById('confirmModifyBtn');

// --- DELETE ---
document.getElementById('deleteBtn').addEventListener('click', () => {
    customConfirmDelete.style.display = 'flex';
});

cancelDeleteBtn.addEventListener('click', () => {
    customConfirmDelete.style.display = 'none';
});

confirmDeleteBtn.addEventListener('click', async () => {
    customConfirmDelete.style.display = 'none';
    loaderOverlay.style.display = 'flex';

    try {
        const res = await fetch('/api/formulaires/' + id, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Erreur suppression');

        loaderOverlay.style.display = 'none';
        await showAnimation('success', 'Bracelet archivé avec succès!');
        window.location.href = 'historique-bracelets.html';
    } catch (err) {
        loaderOverlay.style.display = 'none';
        await showAnimation('error');
        console.error(err);
    }
});

// --- MODIFY (submit interception + popup confirm) ---
document.getElementById('editForm').addEventListener('submit', e => {
    e.preventDefault();
    customConfirmModify.style.display = 'flex';
});

cancelModifyBtn.addEventListener('click', () => {
    customConfirmModify.style.display = 'none';
});

confirmModifyBtn.addEventListener('click', async () => {
    customConfirmModify.style.display = 'none';

    const nom = nomInput.value.trim();
    const prenom = prenomInput.value.trim();
    const tel = telInput.value.trim();
    const motif = motifInput.value.trim();
    const dateDebut = dateDebutInput.value;

    loaderOverlay.style.display = 'flex';

    try {
        const res = await fetch('/api/formulaires/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nom, prenom, tel, motif, dateDebut })
        });
        if (!res.ok) throw new Error('Erreur mise à jour');

        loaderOverlay.style.display = 'none';
        await showAnimation('success', 'Bracelet modifié avec succès!');
        window.location.href = 'liste-bracelets.html';
    } catch (err) {
        loaderOverlay.style.display = 'none';
        await showAnimation('error');
        console.error(err);
    }
});

// --- POINTER ---
document.getElementById('pointerBtn').addEventListener('click', async () => {
    try {
        loaderOverlay.style.display = 'flex';

        const res = await fetch('/api/formulaires/pointer/' + id, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
            },
        });

        
        if (!res.ok) throw new Error('Erreur pointage');
        loaderOverlay.style.display = 'none';

        await showAnimation('success', 'Bracelet pointé avec succès!');
    } catch (err) {
        loaderOverlay.style.display = 'none';
        await showAnimation('error');
        console.error(err);
    }
});

loadBracelet();

function showAnimation(type = 'success', message = '') {
    return new Promise((resolve) => {
        const container = document.getElementById('feedbackAnimation');
        container.innerHTML = '';

        const content = document.createElement('div');
        content.className = 'feedback-inner';

        if (type === 'success') {
            content.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2" width="100" height="100">
                    <circle class="path circle" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-miterlimit="10" cx="65.1" cy="65.1" r="60"/>
                    <polyline class="path check" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" points="100.2,40.2 51.5,88.8 29.8,67.5 "/>
                </svg>
                <p class="success">${message || 'Opération réussie !'}</p>
            `;
        } else {
            content.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2" width="100" height="100">
                    <circle class="path circle" fill="none" stroke="#D06079" stroke-width="8" stroke-miterlimit="10" cx="65.1" cy="65.1" r="60"/>
                    <line class="path line" fill="none" stroke="#D06079" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" x1="34.4" y1="37.9" x2="95.8" y2="92.3"/>
                    <line class="path line" fill="none" stroke="#D06079" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" x1="95.8" y1="38" x2="34.4" y2="92.2"/>
                </svg>
                <p class="error">${message || "Erreur lors de l'opération"}</p>
            `;
        }

        container.appendChild(content);
        container.style.display = 'flex';

        setTimeout(() => {
            container.style.display = 'none';
            container.innerHTML = '';
            resolve();
        }, 1800);
    });
}

