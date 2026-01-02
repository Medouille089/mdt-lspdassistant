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
});

const sendButton = document.querySelector('.send-button');
if (sendButton) {
  sendButton.addEventListener('click', async () => {
  const container = document.querySelector('.convocation-container');

  const dateInput = document.getElementById('date-input');
  const heureInput = document.getElementById('heure-input');
  const motifInput = document.getElementById('motif-input');

  const dateFormatted = document.createElement('span');
  const heureFormatted = document.createElement('span');
  const motifFormatted = document.createElement('div');

  dateFormatted.classList.add('content-input-replacement');
  heureFormatted.classList.add('content-input-replacement');
  motifFormatted.classList.add('content-input-replacement');

  if (dateInput.value) {
    const [yyyy, mm, dd] = dateInput.value.split("-");
    dateFormatted.textContent = `${dd}/${mm}/${yyyy}`;
  } else {
    dateFormatted.textContent = "—";
  }

  if (heureInput.value) {
    const [hh, min] = heureInput.value.split(":");
    heureFormatted.textContent = `${hh}h${min}`;
  } else {
    heureFormatted.textContent = "—";
  }

  // Remplacer le textarea par un div avec le contenu
  motifFormatted.textContent = motifInput.value || "";
  motifFormatted.style.whiteSpace = 'pre-wrap';
  motifFormatted.style.wordWrap = 'break-word';

  // Remplacement temporaire
  dateInput.parentNode.replaceChild(dateFormatted, dateInput);
  heureInput.parentNode.replaceChild(heureFormatted, heureInput);
  motifInput.parentNode.replaceChild(motifFormatted, motifInput);

  // Forcer la largeur de la convocation-container
  const originalWidth = container.style.width;
  const originalBorder = container.style.border;

  container.style.width = "900px";
  container.style.border = "none";

  // Inject a temporary style to force readable colors/alignment for the canvas capture.
  // Some users may have browser themes or extensions (dark mode, High Contrast, Dark Reader, etc.)
  // that override colors and alignment; html2canvas captures the rendered output, so we
  // enforce explicit styles here and remove them immediately after capture.
  const tempStyle = document.createElement('style');
  tempStyle.setAttribute('data-temp', 'convocation-canvas-fix');
  tempStyle.textContent = `
    /* Make all text inside the convocation explicitly black so it's visible on white bg */
    .convocation-container, .convocation-container * { color: #000 !important; }
    /* Ensure inputs/replacements keep dark text and expected backgrounds */
    .convocation-container input, .convocation-container textarea, .convocation-container select, .content-input-replacement { color: #000 !important; background-color: transparent !important; }
    /* Make sure replaced input spans are left-aligned (some user styles may center them) */
    .content-input-replacement { text-align: left !important; }
    /* Keep header/title alignment as designed */
    .header-title { text-align: center !important; }
  `;
  container.appendChild(tempStyle);

  // Ensure our temporary replacement elements are explicitly left-aligned and black
  dateFormatted.style.color = '#000';
  dateFormatted.style.textAlign = 'left';
  heureFormatted.style.color = '#000';
  heureFormatted.style.textAlign = 'left';
  motifFormatted.style.color = '#000';
  motifFormatted.style.textAlign = 'left';

  const canvas = await html2canvas(container, { scale: 2 });

  // Remove the temporary style to restore original appearance
  if (tempStyle && tempStyle.parentNode) tempStyle.parentNode.removeChild(tempStyle);
  const imageBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

  // Restaurer la largeur et la bordure originale
  container.style.width = originalWidth;
  container.style.border = originalBorder;

  // Rétablir les inputs
  dateFormatted.parentNode.replaceChild(dateInput, dateFormatted);
  heureFormatted.parentNode.replaceChild(heureInput, heureFormatted);
  motifFormatted.parentNode.replaceChild(motifInput, motifFormatted);

  const nom = document.getElementById('nom-input').value.trim();
  const prenom = document.getElementById('prenom-input').value.trim();

  const formData = new FormData();
  formData.append('image', imageBlob, 'convocation.png');
  formData.append('nom', nom);
  formData.append('prenom', prenom);
  formData.append('date', dateInput.value);
  formData.append('heure', heureInput.value);
  formData.append('officier', document.getElementById('officier').value);
  formData.append('grade', document.getElementById('grade').value);
  formData.append('motif', document.getElementById('motif-input').value.trim());
  formData.append('lieu', document.getElementById('lieu-input').value.trim());


  const response = await fetch('/upload-convocation', {
    method: 'POST',
    body: formData
  });


  const feedback = document.getElementById('feedbackAnimation');
  function showAnimation(type = 'success', msg) {
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
          <p class="success">Convocation envoyée avec succès sur Discord !</p>
        `;
      } else {
        content.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
            <circle class="path circle" fill="none" stroke="#D06079" stroke-width="8" cx="65.1" cy="65.1" r="60"/>
            <line class="path line" fill="none" stroke="#D06079" stroke-width="8" x1="34.4" y1="37.9" x2="95.8" y2="92.3"/>
            <line class="path line" fill="none" stroke="#D06079" stroke-width="8" x1="95.8" y1="38" x2="34.4" y2="92.2"/>
          </svg>
          <p class="error">${msg || 'Échec de l\'envoi.'}</p>
        `;
      }
      feedback.appendChild(content);
      feedback.style.display = 'flex';
      setTimeout(() => resolve(), 1800);
    });
  }
  if (response.ok) {
    await showAnimation('success');
    feedback.classList.add('fade-out');
    feedback.addEventListener('transitionend', () => {
      location.reload();
    }, { once: true });
  } else {
    await showAnimation('error');
  }
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