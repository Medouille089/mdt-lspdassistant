document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loaderOverlay').style.display = 'flex';
    getNextIdBrac();
});

async function getNextIdBrac() {
    try {
        const res = await fetch('/api/next-id-brac');
        if (!res.ok) throw new Error('Erreur génération ID');
        const data = await res.json();
        document.getElementById('id_brac').value = data.id_brac;
    } catch (err) {
        console.error(err);
        document.getElementById('id_brac').value = "Erreur";
    } finally {
        document.getElementById('loaderOverlay').style.display = 'none';
    }
}

getNextIdBrac();

const telInput = document.getElementById('tel');
telInput.addEventListener('input', function () {
    let x = this.value.replace(/\D/g, '').slice(0, 10);
    if (x.length >= 1) x = '(' + x;
    if (x.length >= 4) x = x.slice(0, 4) + ') ' + x.slice(4);
    if (x.length >= 9) x = x.slice(0, 9) + '-' + x.slice(9);
    this.value = x;
});

const dateDebutInput = document.getElementById('dateDebut');
const today = new Date().toISOString().split('T')[0];

dateDebutInput.min = today;
dateDebutInput.value = today;

const timestampDiv = document.getElementById("timestamp");
const now = new Date();
const timeStr = now.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' });
const dateStr = now.toLocaleDateString("fr-FR");
timestampDiv.textContent = `${dateStr} à ${timeStr}`;

function showAnimation(type = 'success') {
    return new Promise((resolve) => {
        const container = document.getElementById('feedbackAnimation');
        container.innerHTML = ''; // reset

        const content = document.createElement('div');
        content.className = 'feedback-inner';

        if (type === 'success') {
            content.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
                    <circle class="path circle" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-miterlimit="10" cx="65.1" cy="65.1" r="60"/>
                    <polyline class="path check" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" points="100.2,40.2 51.5,88.8 29.8,67.5 "/>
                </svg>
                <p class="success">Bracelet soumis avec succès!</p>
            `;
        } else {
            content.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
                    <circle class="path circle" fill="none" stroke="#D06079" stroke-width="8" stroke-miterlimit="10" cx="65.1" cy="65.1" r="60"/>
                    <line class="path line" fill="none" stroke="#D06079" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" x1="34.4" y1="37.9" x2="95.8" y2="92.3"/>
                    <line class="path line" fill="none" stroke="#D06079" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" x1="95.8" y1="38" x2="34.4" y2="92.2"/>
                </svg>
                <p class="error">Erreur lors de la soumission du bracelet</p>
            `;
        }


        container.appendChild(content);
        container.style.display = 'flex';

        setTimeout(() => resolve(), 1800);
    });
}

document.getElementById('lspdForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const id_brac = document.getElementById('id_brac').value;
    const nom = document.getElementById('nom').value;
    const prenom = document.getElementById('prenom').value;
    const tel = document.getElementById('tel').value;
    const motif = document.getElementById('motif').value;
    const dateDebutRaw = document.getElementById('dateDebut').value;
    const dateDebutForDB = dateDebutRaw; // format YYYY-MM-DD
    const dateDebutForDisplay = formatDateForDisplay(dateDebutRaw);
    const webhookRes = await fetch('/api/webhook-url');
    const webhookData = await webhookRes.json();
    const webhookUrl = webhookData.webhook;
    const imageUrl = "https://i.ibb.co/DDQWSHmZ/assistant.png";

    document.getElementById('loaderOverlay').style.display = 'flex';

    const payload = {
        embeds: [{
            title: "Nouveau bracelet",
            color: 0x0b1b5a,
            fields: [
                { name: "ID Bracelet", value: id_brac, inline: true },
                { name: "Nom", value: nom, inline: true },
                { name: "Prénom", value: prenom, inline: true },
                { name: "Motif", value: motif, inline: true },
                { name: "Téléphone", value: tel, inline: false },
                {
                    name: "Date de création",
                    value: `**${dateDebutForDisplay}**`,
                    inline: false
                }
            ],
            footer: {
                text: "LSPD Assistant",
                icon_url: imageUrl
            },
            thumbnail: {
                url: imageUrl
            },
            timestamp: new Date().toISOString()
        }]
    };

    let hasError = false;

    try {
        await fetch('/api/formulaire', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                id_brac,
                nom,
                prenom,
                motif,
                tel,
                dateDebut: dateDebutForDB,
            })
        });

    } catch (err) {
        hasError = true;
        document.getElementById('loaderOverlay').style.display = 'none';
        await showAnimation('error');
        alert("Erreur : " + err.message);
    } finally {
        if (!hasError) {
            document.getElementById('loaderOverlay').style.display = 'none';
            await showAnimation('success');

            const container = document.getElementById('feedbackAnimation');
            container.classList.add('fade-out');

            container.addEventListener('transitionend', () => {
                location.reload();
            }, { once: true });
        }
    }
});

function formatDateForDisplay(dateStr) {
    const date = new Date(dateStr);
    const d = ('0' + date.getDate()).slice(-2);
    const m = ('0' + (date.getMonth() + 1)).slice(-2);
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}

