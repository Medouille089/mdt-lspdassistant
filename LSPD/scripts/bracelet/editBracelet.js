const urlParams = new URLSearchParams(window.location.search);
const id = urlParams.get('id');
if (!id) {
    alert('ID du bracelet manquant');
    window.location.href = 'getBracelet.html';
}

const idInput = document.getElementById('id_brac');
const nomInput = document.getElementById('nom');
const prenomInput = document.getElementById('prenom');
const motifInput = document.getElementById('motif');
const telInput = document.getElementById('tel');
const dateDebutInput = document.getElementById('dateDebut');
const dateFinInput = document.getElementById('dateFin');

dateDebutInput.addEventListener('change', () => {
    const debut = dateDebutInput.value;
    if (dateFinInput.value && dateFinInput.value < debut) {
        dateFinInput.value = debut;
    }
    dateFinInput.min = debut;
});

dateFinInput.addEventListener('change', () => {
    const fin = dateFinInput.value;
    if (dateDebutInput.value && dateDebutInput.value > fin) {
        dateDebutInput.value = fin;
    }
    dateDebutInput.max = fin;
});

telInput.addEventListener('input', function () {
    let x = this.value.replace(/\D/g, '').slice(0, 10);
    if (x.length >= 1) x = '(' + x;
    if (x.length >= 4) x = x.slice(0, 4) + ') ' + x.slice(4);
    if (x.length >= 9) x = x.slice(0, 9) + '-' + x.slice(9);
    this.value = x;
});

const today = new Date().toISOString().split('T')[0];
document.getElementById('dateDebut').min = today;
document.getElementById('dateFin').min = today;
document.getElementById('dateDebut').value = today;

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
            alert('Bracelet non trouvé');
            window.location.href = 'getBracelet.html';
            return;
        }

        idInput.value = bracelet.id_brac;
        nomInput.value = bracelet.nom;
        prenomInput.value = bracelet.prenom;
        motifInput.value = bracelet.motif;
        telInput.value = bracelet.tel;
        dateDebutInput.value = bracelet.dateDebut;
        dateFinInput.value = bracelet.dateFin;

        document.getElementById('id_brac_title').textContent = `- ${bracelet.id_brac}`;

    } catch (err) {
        alert('Erreur chargement');
        console.error(err);
    }
}

document.getElementById('editForm').addEventListener('submit', async e => {
    e.preventDefault();

    const id_brac = document.getElementById('id_brac').value;
    const nom = nomInput.value.trim();
    const prenom = prenomInput.value.trim();
    const tel = telInput.value.trim();
    const motif = motif.value.trim();
    const dateDebut = dateDebutInput.value;
    const dateFin = dateFinInput.value;
    const dateDebutForDisplay = formatDateForDisplay(dateDebut);
    const dateFinForDisplay = formatDateForDisplay(dateFin);
    const webhookRes = await fetch('/api/webhook-url');
    const webhookData = await webhookRes.json();
    const webhookUrl = webhookData.url;
    const imageUrl = "https://i.ibb.co/DDQWSHmZ/assistant.png";

    const payload = {
        embeds: [{
            title: "Bracelet modifié",
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
        document.getElementById('loaderOverlay').style.display = 'flex';

        const webhookRes = await fetch('/api/webhook-url');
        const webhookData = await webhookRes.json();
        const webhookUrl = webhookData.url;

        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const res = await fetch('/api/formulaires/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nom, prenom, tel, motif, dateDebut, dateFin })
        });
        if (!res.ok) throw new Error('Erreur mise à jour');

        document.getElementById('loaderOverlay').style.display = 'none';
        window.location.href = 'getBracelet.html';
    } catch (err) {
        document.getElementById('loaderOverlay').style.display = 'none';
        alert('Erreur modification');
        console.error(err);
    }
});

document.getElementById('deleteBtn').addEventListener('click', async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce bracelet ?')) return;

    try {
        const res = await fetch('/api/formulaires/' + id, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Erreur suppression');

        alert('Bracelet supprimé avec succès, Maître.');
        window.location.href = 'getBracelet.html';
    } catch (err) {
        alert('Erreur suppression');
        console.error(err);
    }
});

function formatDateForDisplay(dateString) {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-'); // pas de Date()
    return `${day}/${month}/${year}`;
}

loadBracelet();