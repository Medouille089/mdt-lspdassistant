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
});

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

  const originalContainer = document.querySelector(".incident-container");
  if (!originalContainer) return alert("Erreur : div .incident-container introuvable.");
  if (originalContainer.offsetWidth === 0 || originalContainer.offsetHeight === 0)
    return alert("Erreur : la div .incident-container est invisible ou a une taille nulle.");

  const clone = originalContainer.cloneNode(true);

  // Supprimer les éléments inutiles
  const uploadLabel = clone.querySelector('label[for="pieces"]');
  const uploadWrapper = clone.querySelector('.file-upload-wrapper');
  const attachmentsPreview = clone.querySelector('.attachments-preview');
  if (uploadLabel) uploadLabel.remove();
  if (uploadWrapper) uploadWrapper.remove();
  if (attachmentsPreview) attachmentsPreview.remove();

  // Appliquer style manuel pour PDF
  clone.style.backgroundColor = "#fff";
  clone.style.padding = "40px 50px 100px";
  clone.style.border = "none";
  clone.style.boxShadow = "none";

  // Appliquer style inline aux inputs/textarea/select
  const fields = clone.querySelectorAll('input, textarea, select');
  fields.forEach(el => {
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

  if (!canvas) return alert("Erreur : html2canvas n’a pas généré de canvas.");
  const imgData = canvas.toDataURL("image/png");
  if (!imgData || imgData === "data:,") return alert("Erreur : image vide générée !");

  try {
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
    formData.append("pieces", pdfBlob, "rapport.pdf");

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

    const res = await fetch("/api/incident", {
      method: "POST",
      body: formData,
    });

    const result = await res.json();
    alert(result.message || "Rapport envoyé !");
  } catch (error) {
    console.error("Erreur jsPDF :", error);
    alert("Erreur lors de la génération du PDF : " + error.message);
  }
});

document.getElementById('implique').addEventListener('input', function (e) {
  let input = e.target.value.replace(/\D/g, '');
  let formatted = input.match(/.{1,2}/g);
  if (formatted) {
    e.target.value = formatted.join(', ');
  } else {
    e.target.value = '';
  }
});
