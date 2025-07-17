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

  const canvas = await html2canvas(container, { scale: 2 }); // qualité HD
  const imageBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

  const formData = new FormData();
  formData.append('image', imageBlob, 'convocation.png');

  const response = await fetch('/upload-convocation', {
    method: 'POST',
    body: formData
  });

  if (response.ok) {
    alert('Convocation envoyée avec succès sur Discord !');
  } else {
    alert('Échec de l\'envoi.');
  }
});
