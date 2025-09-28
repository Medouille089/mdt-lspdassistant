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

  const now = new Date();
  const formatterDate = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' });
  const formatterTime = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', hour12: false, hour: '2-digit', minute: '2-digit'
  });

  const dateInput = document.getElementById("date");
  if (dateInput) dateInput.value = formatterDate.format(now);

  const heureInput = document.getElementById("heure");
  if (heureInput) {
    const heureParts = formatterTime.formatToParts(now);
    const heure = heureParts.filter(p => p.type === 'hour' || p.type === 'minute')
      .map(p => p.value.padStart(2, '0'))
      .join(':');
    heureInput.value = heure;
  }

  loadSituations();
});

async function fileToBase64(file) {
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

let attachedImages = []; 
async function previewAttachments(event) {
  const files = Array.from(event.target.files); 
  const preview = document.getElementById('attachmentsPreview');

  for (const file of files) {
    if (file.type.startsWith('image/')) {
      attachedImages.push(file);
    }
  }

  renderPreview();
}

async function renderPreview() {
  const preview = document.getElementById('attachmentsPreview');
  preview.innerHTML = '';

  for (let i = 0; i < attachedImages.length; i++) {
    const file = attachedImages[i];
    try {
      const base64 = await fileToBase64(file);
      const wrapper = document.createElement('div');
      wrapper.className = 'preview-wrapper';

      const img = document.createElement('img');
      img.src = base64;
      img.classList.add('preview-image');

      const removeBtn = document.createElement('span');
      removeBtn.className = 'remove-image';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        attachedImages.splice(i, 1);
        renderPreview();
        document.getElementById('pieces').value = ''; 
      });

      wrapper.appendChild(img);
      wrapper.appendChild(removeBtn);
      preview.appendChild(wrapper);
    } catch (e) {
      console.error("Erreur conversion image :", e);
    }
  }
}

document.getElementById('pieces').addEventListener('change', previewAttachments);
// ---------------------------------------------------------------------------------------------

let situationItems = [];

async function loadSituations() {
  try {
    const response = await fetch('/api/getSituations');
    situationItems = await response.json();
    console.log("Situations chargées :", situationItems);
    document.querySelectorAll('.select-situations').forEach(box => initSelectBox(box, situationItems));
  } catch (err) {
    console.error("Erreur chargement des situations :", err);
    situationItems = ["Situation-001", "Situation-002", "Situation-003"];

    document.querySelectorAll('.select-situations').forEach(box => initSelectBox(box, situationItems));
  }
}

function initSelectBox(container, items) {
  const isMultiple = container.dataset.multiple !== undefined;
  let selected = [];
  const selectedEl = container.querySelector('.selected-items');
  const inputEl = container.querySelector('.search-input');
  const listEl = container.querySelector('.options-list');

  function renderOptions(regex) {
    listEl.innerHTML = '';
    items
      .filter(item => regex.test(item.name))
      .forEach(item => {
        const li = document.createElement('li');
        li.textContent = item.name;
        li.situation = item;
        li.addEventListener('click', () => toggle(item));
        listEl.appendChild(li);
      });
  }

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

  function renderSelected() {
    selectedEl.innerHTML = '';
    selected.forEach(item => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.situation = item;
      tag.textContent = item.name + ' ×';
      tag.addEventListener('click', () => toggle(item));
      selectedEl.appendChild(tag);
    });
  }

  inputEl.addEventListener('input', () => {
    try {
      const regex = new RegExp(inputEl.value, 'i');
      renderOptions(regex);
    } catch {
      listEl.innerHTML = '';
    }
  });

  renderOptions(/.*/);
  renderSelected();
}

// ------------------- Soumission du formulaire -------------------
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

  try {
    loader.style.display = "flex";

    const clone = originalContainer.cloneNode(true);

    const uploadLabel = clone.querySelector('label[for="pieces"]');
    const uploadWrapper = clone.querySelector(".file-upload-wrapper");
    const attachmentsPreview = clone.querySelector(".attachmentsPreview");
    if (uploadLabel) uploadLabel.remove();
    if (uploadWrapper) uploadWrapper.remove();
    if (attachmentsPreview) attachmentsPreview.remove();

    clone.style.backgroundColor = "#fff";
    clone.style.padding = "40px 50px 100px";
    clone.style.border = "none";
    clone.style.boxShadow = "none";

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

    document.body.appendChild(clone);
    await waitForImagesToLoad(clone);

    const canvas = await html2canvas(clone, { backgroundColor: "#fff" });
    document.body.removeChild(clone);

    if (!canvas) throw new Error("html2canvas n’a pas généré de canvas.");
    const imgData = canvas.toDataURL("image/png");
    if (!imgData || imgData === "data:,") throw new Error("image vide générée !");

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    const pdfBlob = pdf.output("blob");

    const formData = new FormData();
    formData.append("date", document.getElementById("date").value);
    formData.append("heure", document.getElementById("heure").value);
    formData.append("officier", document.getElementById("officier").value);
    formData.append("recit", document.getElementById("recit").value);
    formData.append("implique", document.getElementById("implique").value);
    formData.append("type", document.getElementById("type").value);
    formData.append("lieu", document.getElementById("lieu").value);
    formData.append("grade", document.getElementById("grade").value);

    const selectedSituations = Array.from(document.querySelectorAll('.select-situations .tag'))
      .map(tag => tag.situation);
    formData.append("situations", JSON.stringify(selectedSituations));

    formData.append("pieces", pdfBlob, "Rapport d'incident.pdf");

    for (const file of attachedImages) {
      try {
        const compressed = await compressImage(file, 0.6);
        formData.append("pieces", compressed);
      } catch (err) {
        console.warn("Erreur compression fichier :", file.name, err);
      }
    }

    const res = await fetch("/api/incident", {
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
