document.addEventListener("DOMContentLoaded", () => {
  fetch("/api/user")
    .then((res) => res.json())
    .then((user) => {
      document.getElementById("officier").value = user.username;
      document.getElementById("grade").value = user.grade;
    })
    .catch((err) => {
      console.error("Erreur chargement utilisateur :", err);
      document.getElementById("officier").value = "Erreur de chargement";
      document.getElementById("grade").value = "";
    });

  // Charger les accusations depuis la DB
  loadAccusations();
});

// Fonction pour charger les accusations
async function loadAccusations() {
  try {
    // Pour l'instant, on utilise une liste par défaut
    // Plus tard, remplacez cette partie par un fetch vers votre API
    const accusations = await getAccusationsFromDB();

    const select = document.getElementById('accusations-input');

    // Vider les options existantes (sauf la première)
    while (select.children.length > 1) {
      select.removeChild(select.lastChild);
    }

    // Ajouter les nouvelles options
    accusations.forEach(accusation => {
      const option = document.createElement('option');
      option.value = accusation.value || accusation;
      option.textContent = accusation.label || accusation;
      select.appendChild(option);
    });

  } catch (error) {
    console.error("Erreur lors du chargement des accusations:", error);
    // En cas d'erreur, utiliser la liste par défaut
    loadDefaultAccusations();
  }
}

async function getAccusationsFromDB() {
  // TODO: Remplacer par un vrai fetch vers votre API
  // return fetch('/api/accusations').then(res => res.json());

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        "Vol de véhicule",
        "Agression",
        "Port d'arme illégal",
        "Trafic de drogue",
        "Résistance à arrestation",
        "Conduite en état d'ivresse",
        "Excès de vitesse",
        "Vandalisme",
        "Trouble à l'ordre public",
        "Faux et usage de faux",
        "Homicide",
        "Tentative d'homicide",
        "Vol à main armée",
        "Cambriolage",
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

// Fonction de fallback avec la liste par défaut
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
    select.appendChild(option);
  });
}

function ajouterElement() {
  const select = document.getElementById('accusations-input');
  const texte = select.value.trim();
  if (texte && texte !== "") {
    const ul = document.getElementById('listAccusations');

    // Vérifier si l'accusation n'est pas déjà dans la liste
    const existingItems = Array.from(ul.children).map(li => li.textContent.trim().replace(' - ', ''));
    if (existingItems.includes(texte)) {
      alert("Cette accusation est déjà dans la liste !");
      return;
    }

    const li = document.createElement('li');
    li.textContent = " - " + texte;
    li.addEventListener('click', function () {
      li.remove();
    });
    ul.appendChild(li);

    // Remettre le select à la valeur par défaut
    select.value = "";
    select.focus();
  } else {
    alert("Veuillez sélectionner une accusation !");
  }
};

// Permet l'ajout avec la touche Entrée sur le select
document.getElementById('accusations-input').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    console.log("Ajout par Entrée")
    ajouterElement();
  }
})

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
// 1. Le tableau de base
const items = [
  "Pomme", "Banane", "Abricot", "Cerise",
  "Datte", "Figue", "Groseille",
  "Kiwi", "Mangue", "Orange",
  "Papaye", "Poire"
];

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
        li.textContent = item;
        li.addEventListener('click', () => toggle(item));
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

// 8. Lancement pour tous les widgets
document
  .querySelectorAll('.select-box')
  .forEach(box => initSelectBox(box, items));

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

document.getElementById("pieces").addEventListener("change", previewAttachments);

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
      console.log("Champ manquant:", field, el);
      alert("Veuillez remplir tous les champs obligatoires: " + field);
      el.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        el.focus();
        console.log("Focus appliqué sur:", field, "ReadOnly:", el.readOnly, "Disabled:", el.disabled);
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
    formData.append("pieces", pdfBlob, "Rapport d'arrestation.pdf");

    const files = document.getElementById("pieces").files;
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        try {
          const compressed = await compressImage(file, 0.6);
          formData.append("pieces", compressed);
        } catch (err) {
          console.warn("Erreur compression fichier :", file.name, err);
        }
      }
    }

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

document.getElementById('implique').addEventListener('input', function (e) {
  let input = e.target.value.replace(/\D/g, '');
  let formatted = input.match(/.{1,2}/g);
  e.target.value = formatted ? formatted.join(', ') : '';
});

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
        <p class="success">Rapport d'incident soumis avec succès!</p>
      `;
    } else {
      content.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
          <circle class="path circle" fill="none" stroke="#D06079" stroke-width="8" cx="65.1" cy="65.1" r="60"/>
          <line class="path line" fill="none" stroke="#D06079" stroke-width="8" x1="34.4" y1="37.9" x2="95.8" y2="92.3"/>
          <line class="path line" fill="none" stroke="#D06079" stroke-width="8" x1="95.8" y1="38" x2="34.4" y2="92.2"/>
        </svg>
        <p class="error">Erreur lors de la soumission du rapport d'incident</p>
      `;
    }

    container.appendChild(content);
    container.style.display = 'flex';

    setTimeout(() => resolve(), 1800);
  });
}
