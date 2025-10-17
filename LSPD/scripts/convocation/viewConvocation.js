let editBy = null;
let userInfo = null; // Stocker les infos utilisateur complètes

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
const editBtn = document.getElementById('editConvocBtn');
const saveAndResendBtn = document.getElementById('saveAndResendBtn');

function setEditable(editable) {
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(i => {
        // Keep some fields readonly even in edit mode (e.g. lieu)
        if (i.id === 'lieu-input') return; // don't change this field
        i.readOnly = !editable ? true : false;
        i.disabled = false;
        if (editable) {
            i.style.backgroundColor = '#fff';
            i.style.cursor = 'text';
        } else {
            i.style.backgroundColor = '#f5f5f5';
            i.style.cursor = 'default';
        }
    });
}

if (editBtn) {
    editBtn.addEventListener('click', () => {
        setEditable(true);
        editBtn.style.display = 'none';
        if (saveAndResendBtn) saveAndResendBtn.style.display = 'inline-block';
    });
}

async function captureConvocationImage() {
    const container = document.querySelector('.convocation-container');
    if (!container) throw new Error('Container introuvable');
    // Remove border during capture so it doesn't appear on the image
    const originalBorder = container.style.border;
    const originalWidth = container.style.width;
    try {
        container.style.border = 'none';
        // Optionally force width to match capture size similar to the creation flow
        container.style.width = '900px';
        const canvas = await html2canvas(container, { scale: 2 });
        return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    } finally {
        // Restore original styles
        container.style.border = originalBorder;
        container.style.width = originalWidth;
    }
}

async function updateConvocationOnServer(id) {
    const payload = {
        nom: nom.value,
        prenom: prenom.value,
        date: dateInput.value,
        heure: heureInput.value,
        lieu: lieuInput.value,
        motif: motifInput.value,
        officier: officierInput.value,
        grade: gradeInput.value
    };

    const res = await fetch(`/api/convocation/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return res.json();
}

if (saveAndResendBtn) {
    saveAndResendBtn.addEventListener('click', async () => {
        try {
            document.getElementById('loaderOverlay').style.display = 'flex';
            await updateConvocationOnServer(id);
            const blob = await captureConvocationImage();
            const form = new FormData();
            form.append('image', blob, 'convocation.png');

            const resendRes = await fetch(`/api/convocation/${id}/resend`, {
                method: 'POST',
                body: form
            });
            const data = await resendRes.json();
            if (data && data.success) {
                // show success checkmark, then reload the page to reflect changes
                await showAnimation('success', 'Convocation mise \u00e0 jour et renvoy\u00e9e.');
                setEditable(false);
                saveAndResendBtn.style.display = 'none';
                editBtn.style.display = 'inline-block';
                // reload after short delay to allow animation to be seen
                setTimeout(() => {
                    window.location.reload();
                }, 700);
            } else {
                await showAnimation('error', data.error || 'Erreur lors du renvoi');
            }
        } catch (err) {
            console.error(err);
            await showAnimation('error', 'Erreur lors de la sauvegarde/renvoi');
        } finally {
            document.getElementById('loaderOverlay').style.display = 'none';
        }
    });
}


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
                window.location.href = '/liste-convocations';
            }
        });
    }
})();