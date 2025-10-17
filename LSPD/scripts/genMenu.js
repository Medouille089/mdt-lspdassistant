document.addEventListener("DOMContentLoaded", async () => {
    try {
        const res = await fetch("/api/user");
        if (!res.ok) return;

        const user = await res.json();
        const ROOKIE_ROLE_ID = "1096965866303787094";

        if (!user.roles.includes(ROOKIE_ROLE_ID)) {
            const rapportRookieBtn = document.querySelector('a[href="/rapport-rookie"]');
            if (rapportRookieBtn) rapportRookieBtn.classList.remove("hidden");
        }
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