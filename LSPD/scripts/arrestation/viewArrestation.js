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

async function previewAttachments(event) {
    const files = event.target.files;
    const preview = document.getElementById('attachmentsPreview');
    preview.innerHTML = '';

    for (const file of files) {
        if (file.type.startsWith('image/')) {
            try {
                const base64 = await fileToBase64(file);
                const img = document.createElement('img');
                img.src = base64;
                img.classList.add('preview-image');
                preview.appendChild(img);
            } catch (e) {
                console.error("Erreur conversion image :", e);
            }
        }
    }
}

document.getElementById("incident-container").addEventListener("change", previewAttachments);

const urlParams = new URLSearchParams(window.location.search);
const id = urlParams.get('id');
if (!id) {
    showAnimation('error').then(() => {
        window.location.href = '/getdossier-arrestation';
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

    document.querySelectorAll('.preview-image').forEach(img => {
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

        arrestation.date = arrestation.date.split('T')[0] + "T" + arrestation.date.split('T')[1].substring(0, 5);
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
        const preview = document.getElementById('attachmentsPreview');
        preview.innerHTML = '';

        // Affichage enrichi des rapports/convocations liés
        if (arrestation.rapports_lies && Array.isArray(arrestation.rapports_lies) && arrestation.rapports_lies.length > 0) {
            const label = document.createElement('label');
            label.textContent = "Rapports/Convocations liés";
            label.style.marginTop = "25px";
            label.style.fontWeight = "600";
            label.style.fontSize = "14px";
            label.style.color = "var(--main-color)";
            container.appendChild(label);

            const ul = document.createElement('ul');
            ul.id = "liensRapportsConvoc";
            ul.style.listStyle = "none";
            ul.style.padding = "0";
            ul.style.margin = "15px 0 20px 0";
            ul.style.border = "1px solid #e2e8f0";
            ul.style.borderRadius = "8px";
            ul.style.backgroundColor = "#f8fafc";

            const isProd = window.location.hostname === 'lspd-assistant.fr';
            const baseUrl = isProd ? 'https://lspd-assistant.fr' : '';

            // Fonction utilitaire pour fetch et afficher chaque lien
            async function fetchAndRenderLien(lien) {
                let type = 'INC';
                let idLien = lien;
                if (typeof lien === 'object') {
                    type = lien.type || (lien.incidentId ? 'INC' : 'CONVOC');
                    idLien = lien.incidentId || lien.id || lien;
                } else if (typeof lien === 'string' && lien.startsWith('INC')) {
                    type = 'INC';
                } else {
                    type = 'CONVOC';
                }

                let label = idLien;
                let infos = '';
                let found = false;
                try {
                    if (type === 'INC') {
                        const res = await fetch(`/api/incidents/${idLien}`);
                        if (res.ok) {
                            const data = await res.json();
                            label = `INC${idLien.replace('INC','')}${(data.prenom || data.nom) ? ' - ' : ''}${data.prenom || ''} ${data.nom || ''}`.trim();
                            infos = `Date: ${data.date_incident || ''} Par: ${data.officier_redacteur || ''}`;
                            found = true;
                        }
                    } else {
                        const res = await fetch(`/api/convocations/${idLien}`);
                        if (res.ok) {
                            const data = await res.json();
                            label = `CONVOC${idLien} - ${data.prenom || ''} ${data.nom || ''}`.trim();
                            infos = `Date: ${data.date || ''} Par: ${data.agent_redacteur || ''}`;
                            found = true;
                        }
                    }
                } catch {}

                // Si pas trouvé, fallback minimal
                if (!found) {
                    if (type === 'INC') {
                        label = `INC${idLien.replace('INC','')}`;
                    } else {
                        label = `CONVOC${idLien}`;
                    }
                    infos = '';
                }

                                const li = document.createElement('li');
                                li.innerHTML = `
                                    <span style="font-weight:700;font-size:16px;letter-spacing:0.5px;">${label}</span><br>
                                    <span style="font-size:15px;color:#0b1b5a;">${infos}</span>
                                `;
                                li.style.padding = "12px 16px";
                                li.style.margin = "0";
                                li.style.backgroundColor = "#fff";
                                li.style.borderBottom = "1px solid #e2e8f0";
                                li.style.color = "var(--main-color)";
                                li.style.fontSize = "15px";
                                li.style.cursor = "pointer";
                                li.style.transition = "all 0.2s ease";
                                li.style.position = "relative";
                                li.style.borderLeft = "4px solid var(--main-color)";
                                li.addEventListener('click', function () {
                                        let url = '#';
                                        if (type === 'INC') url = `${baseUrl}/viewIncident?id=${idLien}`;
                                        if (type === 'CONVOC') url = `${baseUrl}/viewConvocation?id=${idLien}`;
                                        window.location.href = url;
                                });
                                li.addEventListener('mouseenter', function () {
                                    li.style.backgroundColor = '#f5f5f5';
                                });
                                li.addEventListener('mouseleave', function () {
                                    li.style.backgroundColor = '#fff';
                                });
                                ul.appendChild(li);
            }

            // Pour chaque lien, fetch et affiche
            Promise.all(arrestation.rapports_lies.map(fetchAndRenderLien)).then(() => {
                container.appendChild(ul);
            });
        }

        const placeholderUrl = 'https://media.istockphoto.com/id/1016744004/fr/vectoriel/image-despace-r%C3%A9serv%C3%A9-de-profil-gray-ne-silhouette-aucune-photo.jpg?s=612x612&w=0&k=20&c=7OLCKLuDpDHaXywnkaGuK-bKQS9lnivwYDYnGqD60bc=';
        if (arrestation.images && arrestation.images.length > 0) {
            // première image uploadée -> preview1 (photo masquée)
            if (arrestation.images[0]) {
                fileInput1.src = arrestation.images[0];
            } else {
                fileInput1.src = placeholderUrl;
            }
            // deuxième image uploadée -> preview2 (démasquée)
            if (arrestation.images[1]) {
                fileInput2.src = arrestation.images[1];
            } else {
                fileInput2.src = placeholderUrl;
            }
            // Les autres images (s'il y en a)
            for (let idx = 2; idx < arrestation.images.length; idx++) {
                const url = arrestation.images[idx] || placeholderUrl;
                const img = document.createElement('img');
                img.src = url;
                img.alt = 'Pièce jointe';
                img.style.maxWidth = '200px';
                img.style.margin = '5px';
                img.style.cursor = 'pointer';
                img.classList.add('preview-image');
                container.appendChild(img);
            }

            // List of img elements to wait for
            const imgContainer = Array.from(document.querySelectorAll('#incident-container img'));

            // Attendre que toutes les images soient chargées (ou erreurs)
            await Promise.all(imgContainer.map(img => new Promise((resolve) => {
                if (img.complete) {
                    resolve();
                } else {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                }
            })));

            enableFullscreenOnImages();

        } else {
            // Si aucune image, afficher les placeholders pour preview1 et preview2
            fileInput1.src = placeholderUrl;
            fileInput2.src = placeholderUrl;
            container.textContent = 'Aucune pièce jointe disponible.';
        }

    } catch (err) {
        console.error(err);
    } finally {
        loader.style.display = 'none';
    }
}

loadIncidentDetail();

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
                window.location.href = '/getdossier-arrestation';
            }
        });
    }
})();