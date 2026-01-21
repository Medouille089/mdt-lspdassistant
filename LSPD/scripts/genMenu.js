// Appliquer immédiatement depuis le cache pour éviter le flash
(function applyMenuPermissionsFromCache() {
    try {
        const cached = localStorage.getItem('menuPermissions');
        if (!cached) return;
        const perms = JSON.parse(cached);
        const MAX_AGE = 24 * 60 * 60 * 1000; // 24h
        if (!perms.timestamp || (Date.now() - perms.timestamp) >= MAX_AGE) return;

        if (perms.canSeeRookieBtn) {
            const rapportRookieBtn = document.querySelector('a[href="/rapport-rookie"]');
            if (rapportRookieBtn) rapportRookieBtn.classList.remove("hidden");
        }
        if (perms.isDivisionEnquete) {
            document.querySelectorAll(".division-enquete-only").forEach(btn => {
                btn.classList.remove("hidden");
            });
        }
    } catch (e) {
        console.warn('Erreur application cache menu:', e);
    }
})();

document.addEventListener("DOMContentLoaded", async () => {
    try {
        // Fetch user info
        const userRes = await fetch("/api/user");
        if (!userRes.ok) return;
        const user = await userRes.json();

        // Fetch grades config to get rookie_role_id
        const gradesRes = await fetch("/api/grades");
        if (!gradesRes.ok) return;
        const grades = await gradesRes.json();
        const rookieRoleId = grades.rookie_role_id?.trim();

        const canSeeRookieBtn = rookieRoleId && !user.roles.includes(rookieRoleId);
        const divisionEnqueteRoleId = grades.division_enquete_role_id?.trim();
        const isDivisionEnquete = divisionEnqueteRoleId && user.roles.includes(divisionEnqueteRoleId);

        // Sauvegarder dans le cache
        try {
            localStorage.setItem('menuPermissions', JSON.stringify({
                canSeeRookieBtn: canSeeRookieBtn,
                isDivisionEnquete: isDivisionEnquete,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Erreur sauvegarde cache menu:', e);
        }

        // Si l'utilisateur N'A PAS le rôle rookie, on affiche le bouton
        if (canSeeRookieBtn) {
            const rapportRookieBtn = document.querySelector('a[href="/rapport-rookie"]');
            if (rapportRookieBtn) rapportRookieBtn.classList.remove("hidden");
        }

        if (isDivisionEnquete) {
            document.querySelectorAll(".division-enquete-only").forEach(btn => {
                btn.classList.remove("hidden");
            });
        }
        // Sinon, il reste caché (hidden)
    } catch (err) {
        console.error("Impossible de vérifier les rôles de l'utilisateur :", err);
    }
});

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('.send-button').forEach(btn => {
        if (btn.getAttribute('href') === '#') {
            btn.remove();
        }
    });
});