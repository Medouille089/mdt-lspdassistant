(function () {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url');
    const frame = document.getElementById('annexFrame');
    const info = document.getElementById('annexeInfo');
    const openBtn = document.getElementById('openExternal');

    function decodeUrl(u) {
        try { return decodeURIComponent(u || ''); } catch (_) { return u || ''; }
    }

    const target = decodeUrl(url);
    if (!target) {
        if (info) info.textContent = "Aucun lien fourni.";
        return;
    }

    // Google Docs/Sheets/Slides se chargent souvent en iframe mais parfois refusent (X-Frame-Options)
    frame.src = target;
    if (info) info.textContent = target;
    openBtn.addEventListener('click', function () { window.open(target, '_blank'); });

    // Gestion d'erreurs de chargement (limité sur iframe): proposer l'ouverture externe
    frame.addEventListener('error', function () { if (info) info.textContent = "Impossible d'afficher l'aperçu. Ouvrez dans un nouvel onglet."; });
})();