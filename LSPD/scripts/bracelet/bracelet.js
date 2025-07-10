async function getNextIdBrac() {
    try {
        const res = await fetch('/api/next-id-brac');
        if (!res.ok) throw new Error('Erreur génération ID');
        const data = await res.json();
        document.getElementById('id_brac').value = data.id_brac;
    } catch (err) {
        console.error(err);
        document.getElementById('id_brac').value = "Erreur";
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
const dateFinInput = document.getElementById('dateFin');
const today = new Date().toISOString().split('T')[0];

dateDebutInput.min = today;
dateFinInput.min = today;
dateDebutInput.value = today;
dateFinInput.value = today;

// Initialisation pour que les contraintes soient actives dès le départ
dateFinInput.min = dateDebutInput.value;
dateDebutInput.max = dateFinInput.value;

// Gestion cohérente entre dateDebut et dateFin
dateDebutInput.addEventListener('change', () => {
    const debut = dateDebutInput.value;
    if (dateFinInput.value < debut) {
        dateFinInput.value = debut;
    }
    dateFinInput.min = debut;
});

dateFinInput.addEventListener('change', () => {
    const fin = dateFinInput.value;
    if (dateDebutInput.value > fin) {
        dateDebutInput.value = fin;
    }
    dateDebutInput.max = fin;
});


const timestampDiv = document.getElementById("timestamp");
const now = new Date();
const timeStr = now.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' });
const dateStr = now.toLocaleDateString("fr-FR");
timestampDiv.textContent = `${dateStr} à ${timeStr}`;


document.getElementById('lspdForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const id_brac = document.getElementById('id_brac').value;
    const nom = document.getElementById('nom').value;
    const prenom = document.getElementById('prenom').value;
    const tel = document.getElementById('tel').value;
    const motif = document.getElementById('motif').value;
    const dateDebutRaw = document.getElementById('dateDebut').value;
    const dateFinRaw = document.getElementById('dateFin').value;
    const dateDebutForDB = dateDebutRaw; // format YYYY-MM-DD
    const dateFinForDB = dateFinRaw;
    const dateDebutForDisplay = formatDateForDisplay(dateDebutRaw);
    const dateFinForDisplay = formatDateForDisplay(dateFinRaw);
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
                    name: "Période",
                    value: `Du **${dateDebutForDisplay}** au **${dateFinForDisplay}**`,
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

    try {
        await fetch('/api/create-post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_brac,
                nom,
                prenom,
                tel,
                motif,
                dateDebut: dateDebutForDB,
                dateFin: dateFinForDB
            })
        });

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
                dateFin: dateFinForDB
            })
        });

    } catch (err) {
        alert("Erreur : " + err.message);
    } finally {
        document.getElementById('loaderOverlay').style.display = 'none';
        // setTimeout(() => location.reload(), 500);
    }
});


function formatDateForDisplay(dateStr) {
    const date = new Date(dateStr);
    const d = ('0' + date.getDate()).slice(-2);
    const m = ('0' + (date.getMonth() + 1)).slice(-2);
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}
