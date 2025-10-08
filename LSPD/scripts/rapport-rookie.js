let allRoles = [];
let agentsCache = [];

function showAnimation(type = 'success', message = '') {
    return new Promise((resolve) => {
        const container = document.getElementById('feedbackAnimation');
        container.innerHTML = '';

        const content = document.createElement('div');
        content.className = 'feedback-inner';

        if (type === 'success') {
            content.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2" width="100" height="100">
                    <circle class="path circle" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-miterlimit="10" cx="65.1" cy="65.1" r="60"/>
                    <polyline class="path check" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" points="100.2,40.2 51.5,88.8 29.8,67.5 "/>
                </svg>
                <p class="success">${message || 'Opération réussie !'}</p>
            `;
        } else {
            content.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2" width="100" height="100">
                    <circle class="path circle" fill="none" stroke="#D06079" stroke-width="8" stroke-miterlimit="10" cx="65.1" cy="65.1" r="60"/>
                    <line class="path line" fill="none" stroke="#D06079" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" x1="34.4" y1="37.9" x2="95.8" y2="92.3"/>
                    <line class="path line" fill="none" stroke="#D06079" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" x1="95.8" y1="38" x2="34.4" y2="92.2"/>
                </svg>
                <p class="error">${message || "Erreur lors de l'opération"}</p>
            `;
        }

        container.appendChild(content);
        container.style.display = 'flex';

        setTimeout(() => {
            container.style.display = 'none';
            container.innerHTML = '';
            resolve();
        }, 1800);
    });
}

// Charger les agents
async function loadAgents() {
  try {
    const res = await fetch('/api/agents-rookie');
    const agents = await res.json();
    agentsCache = agents;
    const select = document.getElementById('agent');
    select.innerHTML = '<option value="">-- Choisir un agent --</option>';

    agents.sort((a, b) => a.username.localeCompare(b.username))
      .forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.discord_id;
        opt.textContent = a.username;
        select.appendChild(opt);
      });
  } catch (err) {
    console.error("Erreur chargement agents:", err);
  }
}

// DOMContentLoaded
document.addEventListener("DOMContentLoaded", async () => {
  const loader = document.getElementById("loaderOverlay");
  loader.style.display = "flex"; // afficher loader

  try {
    // Charger utilisateur
    const userRes = await fetch("/api/user");
    const user = await userRes.json();
    document.getElementById("officier").value = user.username;
    document.getElementById("grade").value = user.grade;
  } catch (err) {
    console.error("Erreur chargement utilisateur :", err);
    document.getElementById("officier").value = "Erreur de chargement";
    document.getElementById("grade").value = "";
  } finally {
    loader.style.display = "none"; // cacher loader après fetch
  }

  // Charger agents et rôles (loader géré uniquement au début)
  await loadAgents();

  document.getElementById("sanctionForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById("submit");
    if (submitBtn) submitBtn.disabled = true;

    const data = {
      agent: document.getElementById("agent").value,
      conduite: document.getElementById("conduite").value,
      radio: document.getElementById("radio").value,
      procedures: document.getElementById("procedures").value,
      ville: document.getElementById("ville").value,
      trello: document.getElementById("trello").value,
      mdt: document.getElementById("mdt").value,
      hierarchie: document.getElementById("hierarchie").value,
      attitude: document.getElementById("attitude").value,
      appreciation: document.getElementById("appreciation").value,
      officier: document.getElementById("officier").value,
      grade: document.getElementById("grade").value
    };

    try {
      const res = await fetch("/api/rapport-rookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      const result = await res.json();
      if (result.success) {
        await showAnimation('success', 'Rapport envoyé !');
        location.reload();
      } else {
        showAnimation('error', result.message || 'Erreur lors de l’envoi du rapport.');
        if (submitBtn) submitBtn.disabled = false;
      }
    } catch (err) {
      console.error("Erreur envoi rapport:", err);
      showAnimation('error', "❌ Impossible d’envoyer le rapport.");
      if (submitBtn) submitBtn.disabled = false;
    }
  });

});