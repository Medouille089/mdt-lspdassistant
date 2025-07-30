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
});

document.querySelector('.send-button').addEventListener('click', async () => {
  const container = document.querySelector('.convocation-container');

  const dateInput = document.getElementById('date-input');
  const heureInput = document.getElementById('heure-input');

  const dateFormatted = document.createElement('span');
  const heureFormatted = document.createElement('span');

  dateFormatted.classList.add('content-input-replacement');
  heureFormatted.classList.add('content-input-replacement');

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

  // Remplacement temporaire
  dateInput.parentNode.replaceChild(dateFormatted, dateInput);
  heureInput.parentNode.replaceChild(heureFormatted, heureInput);

  // Forcer la largeur de la convocation-container
  const originalWidth = container.style.width;
  const originalBorder = container.style.border;

  container.style.width = "900px";
  container.style.border = "none";

  const canvas = await html2canvas(container, { scale: 2 });
  const imageBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

  // Restaurer la largeur et la bordure originale
  container.style.width = originalWidth;
  container.style.border = originalBorder;

  // Rétablir les inputs
  dateFormatted.parentNode.replaceChild(dateInput, dateFormatted);
  heureFormatted.parentNode.replaceChild(heureInput, heureFormatted);

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


  if (response.ok) {
    alert('Convocation envoyée avec succès sur Discord !');
  } else {
    alert("Échec de l'envoi.");
  }
});

