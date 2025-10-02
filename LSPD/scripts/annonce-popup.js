// Script à inclure sur toutes les pages pour afficher la popup d'annonce dynamique

(function () {
  let lastAnnonceId = null;
  let popupTimeout = null;
  let barreInterval = null;
  let userId = null;

  async function getUserId() {
    if (userId) return userId;
    try {
      const res = await fetch('/api/user');
      if (!res.ok) return null;
      const user = await res.json();
      userId = user.id;
      return userId;
    } catch {
      return null;
    }
  }

  function createAnnoncePopup(annonce) {
    // Supprime l'ancienne popup si présente
    const old = document.getElementById('annonce-popup-global');
    if (old) old.remove();
    if (!annonce) return;

    // Crée la popup
    const popup = document.createElement('div');
    popup.id = 'annonce-popup-global';
    popup.className = 'annonce-popup-global';
    popup.innerHTML = `
      <div class="annonce-warning-icon">⚠️</div>
      <div class="annonce-popup-content">
        <div class="annonce-popup-title">Annonce de <b>${annonce.auteur}</b></div>
        <div class="annonce-popup-text">${annonce.texte}</div>
        <div class="annonce-popup-barre"></div>
      </div>
      <button class="annonce-popup-close" title="Fermer">×</button>
    `;
    document.body.appendChild(popup);

    // Animation entrée
    setTimeout(() => popup.classList.add('show'), 10);

    // Barre de durée
    const barre = popup.querySelector('.annonce-popup-barre');
    let elapsed = 0;
    const total = annonce.dureeSec;
    barre.style.width = '100%';
    barreInterval = setInterval(() => {
      elapsed += 0.1;
      barre.style.width = ((total - elapsed) / total * 100) + '%';
      if (elapsed >= total) {
        clearInterval(barreInterval);
      }
    }, 100);

    // Fermeture auto
    popupTimeout = setTimeout(() => closePopup(popup, annonce), total * 1000);
    // Fermeture manuelle
    popup.querySelector('.annonce-popup-close').onclick = () => closePopup(popup, annonce);
  }

  async function closePopup(popup, annonce) {
    if (barreInterval) clearInterval(barreInterval);
    if (popupTimeout) clearTimeout(popupTimeout);
    popup.classList.remove('show');
    setTimeout(() => popup.remove(), 400);
    // Enregistre dismiss côté serveur
    const uid = await getUserId();
    if (uid && annonce && annonce.id) {
      fetch('/api/annonce-dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annonceId: annonce.id, userId: uid })
      });
    }
  }

  async function checkAnnonce() {
    try {
      const annonceRes = await fetch('/api/annonce-active');
      const uid = await getUserId();
      if (!annonceRes.ok || !uid) return;
      const annonce = await annonceRes.json();
      if (annonce && annonce.id && annonce.texte && annonce.auteur) {
        // Vérifie si déjà dismiss
        const dismissRes = await fetch(`/api/annonce-dismiss/${annonce.id}/${uid}`);
        if (!dismissRes.ok) return;
        const dismiss = await dismissRes.json();
        if (dismiss.dismissed) {
          // Si déjà dismiss, retire la popup
          const old = document.getElementById('annonce-popup-global');
          if (old) old.remove();
          lastAnnonceId = null;
          return;
        }
        // Empêche de réafficher la même annonce
        if (lastAnnonceId !== annonce.id) {
          lastAnnonceId = annonce.id;
          createAnnoncePopup(annonce);
        }
      } else {
        // Si aucune annonce, retire la popup
        const old = document.getElementById('annonce-popup-global');
        if (old) old.remove();
        lastAnnonceId = null;
      }
    } catch { }
  }

  // Premier check immédiat
  checkAnnonce();
  // Puis polling toutes les 10s
  setInterval(checkAnnonce, 10000);
})();
