document.getElementById("annonce-send").onclick = async function () {
  const texte = document.getElementById("annonce-text").value.trim();
  const dureeSec = parseInt(document.getElementById("annonce-duree").value, 10);
  const feedback = document.getElementById("annonce-feedback");
  feedback.textContent = "";
  if (!texte || !dureeSec) {
    feedback.textContent = "Veuillez remplir tous les champs.";
    feedback.className = "annonce-error";
    return;
  }
  let auteur = "Admin";
  try {
    const userRes = await fetch("/api/user");
    if (userRes.ok) {
      const user = await userRes.json();
      auteur = user.username || "Admin";
    }
  } catch {}
  try {
    const res = await fetch("/api/annonce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texte, auteur, dureeSec }),
    });
    if (res.ok) {
      feedback.textContent = "Annonce envoyée !";
      feedback.className = "annonce-success";
      document.getElementById("annonce-text").value = "";
    } else {
      const err = await res.json();
      feedback.textContent = err.error || "Erreur lors de l'envoi.";
      feedback.className = "annonce-error";
    }
  } catch (e) {
    feedback.textContent = "Erreur réseau.";
    feedback.className = "annonce-error";
  }
};

(function () {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    const btn = document.getElementById("backlinkBtn");
    if (!btn) return;

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      if (window.history.length > 1) {
        window.history.back();
      } else {
  window.location.href = "/menu-admin-salons";
      }
    });
  }
})();
