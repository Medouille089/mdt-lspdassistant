let allRoles = [];
let agentsCache = [];

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
        alert("✅ Rapport envoyé !");
      } else {
        alert("❌ Erreur : " + (result.error || "Inconnue"));
      }
    } catch (err) {
      console.error("Erreur envoi rapport:", err);
      alert("❌ Impossible d’envoyer le rapport.");
    }
  });

});