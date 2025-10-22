// Ajout du bouton de remplissage automatique
const autoFillBtn = document.createElement('button');
autoFillBtn.type = 'button';
autoFillBtn.textContent = 'Remplir automatiquement';
autoFillBtn.style.marginBottom = '10px';
autoFillBtn.className = 'btn btn-autofill';
const form = document.querySelector('form');
if (form) {
  form.appendChild(autoFillBtn);
  autoFillBtn.addEventListener('click', function () {
    // Remplissage automatique des champs sauf bracelet, chefs d'accusation et rapports liés
    const fields = [
      { id: 'date', value: new Date().toISOString().slice(0, 16) },
      { id: 'name', value: 'John Doe' },
      { id: 'profession', value: 'Agent de sécurité' },
      { id: 'DDN', value: '1990-01-01' },
      { id: 'address', value: '123 Rue de la Paix' },
      { id: 'tel', value: '0601020304' },
      { id: 'droits', value: '12:00' },
      { id: 'entreecellule', value: '12:30' },
      { id: 'sortiecellule', value: '13:00' },
      { id: 'miranda', value: true },
      { id: 'avocat', value: false },
      { id: 'nourriture', value: true },
      { id: 'ems', value: false },
      { id: 'avocatName', value: 'Maître Dupont' },
      { id: 'officier', value: 'Capitaine Martin' },
      { id: 'grade', value: 'Capitaine' },
      { id: 'lieu', value: 'Commissariat Central' },
      { id: 'motifArrestation', value: 'Trouble à l’ordre public' },
      { id: 'circonstances', value: 'Interpellation sur la voie publique.' },
      { id: 'arme', value: 'Aucune' },
      { id: 'uof', value: false }
    ];
    fields.forEach(f => {
      const el = document.getElementById(f.id);
      if (el) {
        if (el.type === 'checkbox') {
          el.checked = !!f.value;
        } else {
          el.value = f.value;
        }
      }
    });
  });
}
// Ajout de l'envoi des liens rapport/convocation
document.querySelector('form').addEventListener('submit', async function (e) {
  e.preventDefault();

  // Collecte des liens ajoutés
  const liensUl = document.getElementById('liensRapportsConvoc');
  // On envoie un tableau d'ids comme pour accusations
  const liens = [...liensUl.children].map(li => {
    if (li.dataset.type === 'INC') {
      return li.dataset.incidentId || li.dataset.id;
    } else {
      return li.dataset.id;
    }
  });

  // Met à jour l'input caché avant l'envoi
  const hiddenInput = document.getElementById('rapports_lies_hidden');
  hiddenInput.value = JSON.stringify(liens);
  // Ajout d'un log pour vérifier la valeur juste avant la création du FormData
  console.log('Valeur rapports_lies_hidden:', hiddenInput.value);

  const formData = new FormData(this);
  // Ajout du champ rapports_lies comme pour accusations
  formData.append('rapports_lies', hiddenInput.value || '[]');
  // Log pour vérifier la valeur dans le FormData
  console.log('FormData rapports_lies:', formData.get('rapports_lies'));

  // DEBUG: log FormData content
  for (let pair of formData.entries()) {
    window.alert(pair[0] + ': ' + pair[1]);
  }

  // Envoi AJAX
  const res = await fetch('/api/arrestation', {
    method: 'POST',
    body: formData
  });

  // Remplace l'envoi classique par fetch si besoin
  // ...existing code d'envoi...
});
// Ajout d'un lien rapport/convocation sélectionné
window.ajouterLienRapportConvoc = function () {
  const input = document.getElementById('searchRapportConvoc');
  const ul = document.getElementById('liensRapportsConvoc');
  const id = input.dataset.selectedId;
  const type = input.dataset.selectedType;
  let label = input.value;
  // Log pour debug : affiche l'id, le type et le label sélectionné
  console.log('ajouterLienRapportConvoc:', { id, type, label, incidentId: input.dataset.incidentId });
  if (!id || !type || !label) {
    alert('Sélectionnez un rapport ou une convocation dans la recherche.');
    return;
  }
  // Empêcher doublon
  if ([...ul.children].some(li => li.dataset && li.dataset.id === id && li.dataset.type === type)) {
    alert('Déjà ajouté !');
    return;
  }

  // Formatage label selon type
  if (type === 'INC') {
    // label = numéro incident uniquement
    label = input.dataset.incidentId || id;
  } else if (type === 'CONVOC') {
    // label = CONVOCid - prénom nom
    const nom = input.dataset.nom || '';
    const prenom = input.dataset.prenom || '';
    label = `CONVOC${id} - ${prenom} ${nom}`.trim();
  }

  // Affichage style chef d'accusation (même style que #listAccusations)
  const li = document.createElement('li');
  li.dataset.id = id;
  li.dataset.type = type;
  li.textContent = label + (type ? ` (${type})` : '');
  if (type === 'INC') {
    li.dataset.incidentId = input.dataset.incidentId || '';
  }
  li.style.cursor = 'pointer';
  li.addEventListener('click', function () {
    li.remove();
    // Si plus aucun rapport, le message vide s'affiche automatiquement via le CSS
  });
  ul.appendChild(li);
  input.value = '';
  input.dataset.selectedId = '';
  input.dataset.selectedType = '';
  input.dataset.incidentId = '';
};
// Recherche rapports et convocations par nom
// Affichage des résultats au focus
const searchInput = document.getElementById('searchRapportConvoc');
const resultsDiv = document.getElementById('searchResultsRapportConvoc');
if (searchInput && resultsDiv) {
  searchInput.addEventListener('focus', function () {
    resultsDiv.style.display = 'block';
  });
  searchInput.addEventListener('blur', function () {
    setTimeout(() => { resultsDiv.style.display = 'none'; }, 200);
  });
}
document.getElementById('searchRapportConvoc').addEventListener('input', async function () {
  const query = this.value.trim();
  const resultsDiv = document.getElementById('searchResultsRapportConvoc');
  resultsDiv.innerHTML = '';
  if (query.length < 2) return;

  // Requête incidents
  let incidents = [];
  try {
    const resInc = await fetch(`/api/incidents/search?name=${encodeURIComponent(query)}`);
    if (resInc.ok) incidents = await resInc.json();
  } catch { }

  // Requête convocations
  let convocations = [];
  try {
    const resConv = await fetch(`/api/convocations/search?name=${encodeURIComponent(query)}`);
    if (resConv.ok) convocations = await resConv.json();
  } catch { }

  // Affichage résultats
  function formatDateTime(dateStr, heureStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    let datePart = dateStr;
    if (!isNaN(d)) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      datePart = `${day}/${month}/${year}`;
    }
    let heurePart = '';
    if (heureStr && heureStr.length >= 5) {
      heurePart = heureStr.slice(0,5);
    }
    return `Date : ${datePart}${heurePart ? ' à ' + heurePart : ''}`;
  }
  // Filter convocations by id, 'CONVOC'+id, nom, or prenom
  const queryLower = query.toLowerCase();
  let filteredConvocs;
  if (!query) {
    filteredConvocs = convocations;
  } else {
    filteredConvocs = convocations.filter(conv => {
      const idStr = String(conv.id);
      // Match if query is exactly the id, contained in id, matches 'CONVOC'+id, or matches name/prénom
      return (
        idStr === query ||
        idStr.includes(query) ||
        ('convoc' + idStr).toLowerCase().includes(queryLower) ||
        (conv.nom && conv.nom.toLowerCase().includes(queryLower)) ||
        (conv.prenom && conv.prenom.toLowerCase().includes(queryLower))
      );
    });
  }
  const allResults = [
    ...incidents.map(inc => {
      // Use only one incident_id, never duplicate, no name/prénom for incidents
      let labelId = '';
      if (inc.incident_id) {
        labelId = inc.incident_id;
      } else if (inc.id) {
        labelId = inc.id.startsWith('INC') ? inc.id : `INC${inc.id}`;
      }
      return {
        type: 'INC',
        id: inc.id,
        nom: '',
        prenom: '',
        date_incident: inc.date_incident,
        heure_incident: inc.heure_incident,
        title: `${labelId}`,
        infos: `${formatDateTime(inc.date_incident, inc.heure_incident)} Officier: ${inc.officier_redacteur} Lieu: ${inc.lieu_incident}`,
        incident_id: inc.incident_id // Ajout de l'ID d'incident
      };
    }),
    ...filteredConvocs.map(conv => ({
      type: 'CONVOC',
      id: conv.id,
      nom: conv.nom || '',
      prenom: conv.prenom || '',
      date: conv.date,
      heure: conv.heure,
      title: `CONVOC${conv.id} - ${conv.prenom || ''} ${conv.nom || ''}`.trim(),
        infos: `${formatDateTime(conv.date, conv.heure)} Par: ${conv.officer}`
    }))
  ];

  allResults.forEach(res => {
    const div = document.createElement('div');
    div.className = 'search-result-item';
    div.innerHTML = `<strong>${res.title}</strong><br><span style='font-size:0.9em;'>${res.infos}</span>`;
    div.dataset.type = res.type;
    div.dataset.id = res.id;
    div.dataset.title = res.title;
    div.dataset.nom = res.nom || '';
    div.dataset.prenom = res.prenom || '';
    if (res.type === 'INC' && res.incident_id) {
      div.dataset.incidentId = res.incident_id;
      div.dataset.date_incident = res.date_incident || '';
    }
    div.addEventListener('click', function () {
      const input = document.getElementById('searchRapportConvoc');
      if (res.type === 'INC') {
        input.value = res.title;
        input.dataset.incidentId = res.incident_id || '';
        input.dataset.nom = res.nom || '';
        input.dataset.prenom = res.prenom || '';
        input.dataset.date_incident = res.date_incident || '';
      } else {
        input.value = res.title;
        input.dataset.incidentId = '';
        input.dataset.nom = res.nom || '';
        input.dataset.prenom = res.prenom || '';
      }
      input.dataset.selectedId = res.id;
      input.dataset.selectedType = res.type;
      resultsDiv.innerHTML = '';
      window.ajouterLienRapportConvoc();
    });
    resultsDiv.appendChild(div);
  });
});
document.addEventListener("DOMContentLoaded", async () => {

  try {
    let user;

    if (window.clientCache && typeof window.clientCache.getOrFetch === 'function') {
      user = await window.clientCache.getOrFetch('user', async () => {
        const res = await fetch('/api/user');
        if (!res.ok) throw new Error('Non connecté');
        return await res.json();
      }, window.CLIENT_CACHE_TTL ? window.CLIENT_CACHE_TTL.USER : 300);
    } else {
      const res = await fetch('/api/user');
      if (!res.ok) throw new Error('Non connecté');
      user = await res.json();
    }

    document.getElementById("officier").value = user.username;
    document.getElementById("grade").value = user.grade;
  } catch (err) {
    console.error("Erreur chargement utilisateur :", err);
    document.getElementById("officier").value = "Erreur de chargement";
    document.getElementById("grade").value = "";
  }

  // Charger les accusations depuis la DB
  loadAccusations();

  // Charger les bracelets depuis la DB
  loadBracelets();
});

async function loadAccusations() {
  try {
    // Pour l'instant, on utilise une liste par défaut
    // Plus tard, remplacez cette partie par un fetch vers notre API
    const accusations = await getAccusationsFromDB();

    const select = document.getElementById('accusations-input');
    while (select.children.length > 1) {
      select.removeChild(select.lastChild);
    }
    accusations.forEach(accusation => {
      const option = document.createElement('option');
      option.value = accusation.chef_accusation || accusation;
      option.textContent = accusation.chef_accusation || accusation;
      option.accusation = accusation;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Erreur lors du chargement des accusations:", error);
    loadDefaultAccusations();
  }

  document.getElementById('accusations-input').addEventListener('change', function (e) {
    if (this.value) {
      ajouterElement();
    }
  });
}

async function getAccusationsFromDB() {
  // TODO: Remplacer par un vrai fetch vers notre API
  return fetch('/api/getDelits').then(res => res.json());

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        "Vol de véhicule",
        "Agression",
        "Port d'arme illégale",
        "Menaces",
        "Harcèlement",
        "Conduite sans permis",
        "Fuite de contrôle",
        "Non-respect des ordres",
        "Détérioration de biens publics"
      ]);
    }, 100);
  });
}

function loadDefaultAccusations() {
  const accusations = [
    "Vol de véhicule",
    "Agression",
    "Port d'arme illégal",
    "Trafic de drogue",
    "Résistance à arrestation",
    "Conduite en état d'ivresse",
    "Excès de vitesse",
    "Vandalisme",
    "Trouble à l'ordre public",
    "Faux et usage de faux"
  ];

  const select = document.getElementById('accusations-input');
  accusations.forEach(accusation => {
    const option = document.createElement('option');
    option.value = accusation;
    option.textContent = accusation;
    option.accusation = accusation;
    select.appendChild(option);
  });
}

function ajouterElement() {
  const select = document.getElementById('accusations-input');
  const texte = select.value.trim();
  if (texte && texte !== "") {
    const ul = document.getElementById('listAccusations');

    const existingItems = Array.from(ul.children).map(li => {
      return li.accusation;
    });
    if (existingItems.includes(select.selectedOptions[0].accusation)) {
      alert("Cette accusation est déjà dans la liste !");
      return;
    }
    const li = document.createElement('li');
    li.textContent = " - " + texte + " | " + select.selectedOptions[0].accusation.type + " | " + select.selectedOptions[0].accusation.amende;
    li.accusation = select.selectedOptions[0].accusation;
    li.addEventListener('click', function () {
      li.remove();
    });
    ul.appendChild(li);

    select.value = "";
    select.focus();
  } else {
    alert("Veuillez sélectionner une accusation !");
  }
};

document.getElementById('accusations-input').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    ajouterElement();
  }
});

function supprimerElement(li) {
  const ul = document.getElementById("listAccusations");
  document.removeChild(li)
}



const telInput = document.getElementById('tel');
telInput.addEventListener('input', function () {
  let x = this.value.replace(/\D/g, '').slice(0, 10);
  if (x.length >= 1) x = '(' + x;
  if (x.length >= 4) x = x.slice(0, 4) + ') ' + x.slice(4);
  if (x.length >= 9) x = x.slice(0, 9) + '-' + x.slice(9);
  this.value = x;
});
function setupImagePicker(id) {
  const fileInput = document.getElementById(`fileInput${id}`);
  const customButton = document.getElementById(`customButton${id}`);
  const addLabel = document.getElementById(`addImage${id}`)
  const preview = document.getElementById(`preview${id}`);
  // get div by data-id attribute
  const dataDiv = document.querySelector(`div[data-id="${id}"]`);

  fileInput.addEventListener('change', function () {
    const file = this.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = function (e) {
        preview.src = e.target.result;
        preview.style.display = 'block';
        addLabel.style.display = 'none';


      };
      reader.readAsDataURL(file);
    }
  });

  preview.addEventListener('click', function () {
    fileInput.click();
  });

  dataDiv.addEventListener('click', function () {
    fileInput.click();
  });
}

setupImagePicker(1)
setupImagePicker(2)

let braceletItems = [];

async function loadBracelets() {
  try {
    const response = await fetch('/api/formulaires');
    braceletItems = await response.json();
    document.querySelectorAll('.select-bracelet').forEach(box => initSelectBox(box, braceletItems));
  } catch (err) {
    console.error("Erreur chargement des bracelets :", err);
    braceletItems = ["Bracelet-001", "Bracelet-002", "Bracelet-003"];

    document.querySelectorAll('.select-bracelet').forEach(box => initSelectBox(box, braceletItems));
  }
}


// 2. Initialisation sur chaque conteneur
function initSelectBox(container, items) {
  const isMultiple = container.dataset.multiple !== undefined;
  let selected = [];
  const selectedEl = container.querySelector('.selected-items');
  const inputEl = container.querySelector('.search-input');
  const listEl = container.querySelector('.options-list');

  // 3. Affiche la liste filtrée
  function renderOptions(regex) {
    listEl.innerHTML = '';
    items
      .filter(item => regex.test(item))
      .forEach(item => {
        const li = document.createElement('li');
        li.textContent = item.id_brac;
        li.addEventListener('click', () => toggle(item.id_brac));
        listEl.appendChild(li);
      });
  }

  // 4. Sélectionne ou désélectionne un item
  function toggle(item) {
    const idx = selected.indexOf(item);

    if (isMultiple) {
      idx < 0 ? selected.push(item) : selected.splice(idx, 1);
    } else {
      selected = idx < 0 ? [item] : [];
      inputEl.value = '';
      renderOptions(/.*/);
    }

    renderSelected();
  }

  // 5. Met à jour les étiquettes affichées
  function renderSelected() {
    selectedEl.innerHTML = '';
    selected.forEach(item => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = item + ' ×';
      tag.addEventListener('click', () => toggle(item));
      selectedEl.appendChild(tag);
    });
  }

  // 6. Filtrage regex au fil de la frappe
  inputEl.addEventListener('input', () => {
    try {
      const regex = new RegExp(inputEl.value, 'i');
      renderOptions(regex);
    } catch {
      listEl.innerHTML = '';
    }
  });

  // 7. Premier rendu
  renderOptions(/.*/);
  renderSelected();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (blob) {
          const compressedFile = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
            type: "image/jpeg",
            lastModified: Date.now()
          });
          resolve(compressedFile);
        } else {
          reject(new Error("Compression échouée"));
        }
      }, "image/jpeg", quality);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

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

const piecesInput = document.getElementById("pieces");
if (piecesInput) {
  piecesInput.addEventListener("change", previewAttachments);
}

async function waitForImagesToLoad(container) {
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(images.map(img => {
    if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
    return new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  }));
}

document.querySelector(".send-button").addEventListener("click", async (e) => {
  e.preventDefault();
  let hasError = false;

  const loader = document.getElementById("loaderOverlay");

  const originalContainer = document.querySelector(".incident-container");
  if (!originalContainer) return alert("Erreur : div .incident-container introuvable.");
  if (originalContainer.offsetWidth === 0 || originalContainer.offsetHeight === 0)
    return alert("Erreur : la div .incident-container est invisible ou a une taille nulle.");

  // check if all required fields are filled
  const requiredFields = [
    "date", "name", "profession", "DDN", "address", "tel",
    "droits", "entreecellule", "sortiecellule",
    "officier", "grade", "lieu", "motifArrestation", "circonstances"
  ];
  for (const field of requiredFields) {
    const el = document.getElementById(field);
    if (!el || !el.value.trim()) {
      alert("Veuillez remplir tous les champs obligatoires: " + field);
      el.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        el.focus();
      }, 100);
      return;
    }
  }



  try {
    loader.style.display = "flex";

    const clone = originalContainer.cloneNode(true);

    const uploadLabel = clone.querySelector('label[for="pieces"]');
    const uploadWrapper = clone.querySelector(".file-upload-wrapper");
    const attachmentsPreview = clone.querySelector(".attachmentsPreview");
    const addInput = clone.querySelector(".addInput");
    const searchInput = clone.querySelector(".search-input");
    const listOptions = clone.querySelector(".options-list");
    if (uploadLabel) uploadLabel.remove();
    if (uploadWrapper) uploadWrapper.remove();
    if (attachmentsPreview) attachmentsPreview.remove();
    if (addInput) addInput.remove();
    if (searchInput) searchInput.remove();
    if (listOptions) listOptions.remove();



    clone.style.backgroundColor = "#fff";
    clone.style.padding = "40px 50px 100px";
    clone.style.border = "none";
    clone.style.boxShadow = "none";

    // replace all checkboxes with "Oui" or "Non" in pdf
    const checkboxes = clone.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      const label = document.createElement('span');
      label.style.display = "none"; // Masquer le label original
      checkbox.parentNode.insertBefore(label, checkbox);
      if (checkbox.checked) {
        label.textContent = "Oui";
      } else {
        label.textContent = "Non";
      }
      checkbox.remove();
      label.style.display = "inline-block";
      label.style.marginRight = "10px";
      label.style.fontWeight = "bold";
      label.style.color = "#0b1b5a";
      label.style.fontSize = "16px";
    });

    // Replace select boxes with selected items in pdf
    const singleSelect = clone.querySelector('#singleSelect');
    singleSelect.querySelectorAll('.selected-items').forEach(selectedItems => {
      const selectedText = Array.from(selectedItems.children)
        .map(item => item.textContent.replace(' ×', ''))
        .join(', ');
      selectedItems.style.marginBottom = "0px";
      selectedItems.textContent = selectedText || "Aucun sélectionné";
    });

    const fields = clone.querySelectorAll("input, textarea, select");
    fields.forEach((el) => {
      el.style.backgroundColor = "#f9fafc";
      el.style.border = "1px solid #c5cbd5";
      el.style.borderRadius = "8px";
      el.style.color = "#0b1b5a";
      el.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
      el.style.fontSize = "15px";
      el.style.padding = "10px";
      el.style.boxShadow = "none";
      el.style.resize = "none";
      el.style.width = "100%";
    });

    // Gérer les sauts de page pour la génération PDF
    const pageBreaks = clone.querySelectorAll('.page-break');
    pageBreaks.forEach(pageBreak => {
      pageBreak.style.pageBreakAfter = 'always';
      pageBreak.style.breakAfter = 'page';
      pageBreak.style.height = '0';
      pageBreak.style.margin = '0';
      pageBreak.style.padding = '0';
      pageBreak.style.display = 'block';
      pageBreak.style.clear = 'both';

      // Forcer un espace pour le saut de page
      pageBreak.style.minHeight = '25vh';
      pageBreak.style.backgroundColor = 'transparent';
      pageBreak.style.border = 'none';
    });

    document.body.appendChild(clone);
    await waitForImagesToLoad(clone);

    const canvas = await html2canvas(clone, {
      backgroundColor: "#fff",
      height: clone.scrollHeight,
      width: clone.scrollWidth,
      useCORS: true,
      scale: 1
    });
    document.body.removeChild(clone);

    if (!canvas) throw new Error("html2canvas n'a pas généré de canvas.");
    const imgData = canvas.toDataURL("image/png");
    if (!imgData || imgData === "data:,") throw new Error("image vide générée !");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Si le contenu dépasse une page, le diviser automatiquement
    if (pdfHeight > pageHeight) {
      let position = 0;
      let pageNumber = 0;

      while (position < pdfHeight) {
        if (pageNumber > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, "PNG", 0, -position, pdfWidth, pdfHeight);
        position += pageHeight;
        pageNumber++;
      }
    } else {
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    }

    const pdfBlob = pdf.output("blob");

    const formData = new FormData();
    formData.append("date", document.getElementById("date").value);
    formData.append("name", document.getElementById("name").value);
    formData.append("fileInput1", document.getElementById("fileInput1").files[0]);
    formData.append("fileInput2", document.getElementById("fileInput2").files[0]);
    formData.append("profession", document.getElementById("profession").value);
    formData.append("DDN", document.getElementById("DDN").value);
    formData.append("address", document.getElementById("address").value);
    formData.append("tel", document.getElementById("tel").value);
    formData.append("droits", document.getElementById("droits").value);
    formData.append("entreecellule", document.getElementById("entreecellule").value);
    formData.append("sortiecellule", document.getElementById("sortiecellule").value);
    formData.append("bracelet", document.getElementById("selectedBracelet").textContent.replace(' ×', '') || "");
    formData.append("miranda", document.getElementById("miranda").checked);
    formData.append("avocat", document.getElementById("avocat").checked);
    formData.append("nourriture", document.getElementById("nourriture").checked);
    formData.append("ems", document.getElementById("ems").checked);
    formData.append("avocatName", document.getElementById("avocatName").value);
    formData.append("officer", document.getElementById("officier").value);
    formData.append("grade", document.getElementById("grade").value);
    formData.append("lieu", document.getElementById("lieu").value);
    formData.append("motifArrestation", document.getElementById("motifArrestation").value);
    formData.append("circonstances", document.getElementById("circonstances").value);
    formData.append("arme", document.getElementById("arme").value);
    formData.append("uof", document.getElementById("uof").checked);
    const listAccusations = document.getElementById("listAccusations");
    formData.append("accusations", JSON.stringify(Array.from(listAccusations.children).map(li => li.textContent.trim())));
    const liensUl = document.getElementById('liensRapportsConvoc');
    const hiddenRapports = document.getElementById("rapports_lies_hidden");
    hiddenRapports.value = JSON.stringify(
      Array.from(liensUl.children).map(li => {
        if (li.dataset.type === 'INC') {
          return li.dataset.incidentId; // corrige ici
        } else {
          return li.dataset.id;
        }
      })
    );

    formData.append("rapports_lies", hiddenRapports.value);


    const res = await fetch("/api/arrestation", {
      method: "POST",
      body: formData,
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Erreur lors de la soumission.");
  } catch (err) {
    hasError = true;
    loader.style.display = 'none';
    await showAnimation('error');
    alert("Erreur : " + err.message);
  } finally {
    if (!hasError) {
      loader.style.display = 'none';
      await showAnimation('success');

      const container = document.getElementById('feedbackAnimation');
      container.classList.add('fade-out');

      container.addEventListener('transitionend', () => {
        location.reload();
      }, { once: true });
    }
  }
});


const impliqueInput = document.getElementById('implique');
if (impliqueInput) {
  impliqueInput.addEventListener('input', function (e) {
    let input = e.target.value.replace(/\D/g, '');
    let formatted = input.match(/.{1,2}/g);
    e.target.value = formatted ? formatted.join(', ') : '';
  });
}

function showAnimation(type = 'success') {
  return new Promise((resolve) => {
    const container = document.getElementById('feedbackAnimation');
    container.innerHTML = '';

    const content = document.createElement('div');
    content.className = 'feedback-inner';

    if (type === 'success') {
      content.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
          <circle class="path circle" fill="none" stroke="#0b1b5a" stroke-width="8" cx="65.1" cy="65.1" r="60"/>
          <polyline class="path check" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-linecap="round" points="100.2,40.2 51.5,88.8 29.8,67.5"/>
        </svg>
        <p class="success">Rapport d'arrestation soumis avec succès!</p>
      `;
    } else {
      content.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
          <circle class="path circle" fill="none" stroke="#D06079" stroke-width="8" cx="65.1" cy="65.1" r="60"/>
          <line class="path line" fill="none" stroke="#D06079" stroke-width="8" x1="34.4" y1="37.9" x2="95.8" y2="92.3"/>
          <line class="path line" fill="none" stroke="#D06079" stroke-width="8" x1="95.8" y1="38" x2="34.4" y2="92.2"/>
        </svg>
        <p class="error">Erreur lors de la soumission du rapport d'arrestation</p>
      `;
    }

    container.appendChild(content);
    container.style.display = 'flex';

    setTimeout(() => resolve(), 1800);
  });
}

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
        window.location.href = '/menu-rapports';
      }
    });
  }
})();