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

        // Si l'utilisateur N'A PAS le rôle rookie, on affiche le bouton
        if (rookieRoleId && !user.roles.includes(rookieRoleId)) {
            const rapportRookieBtn = document.querySelector('a[href="/rapport-rookie"]');
            if (rapportRookieBtn) rapportRookieBtn.classList.remove("hidden");
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