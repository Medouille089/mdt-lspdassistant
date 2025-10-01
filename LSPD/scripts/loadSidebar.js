// scripts/loadSidebar.js
document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('sidebar-container');

    if (container) {
        try {
            // Récupérer les infos utilisateur pour déterminer le type de sidebar
            const userResponse = await fetch('/api/user');
            const userInfo = await userResponse.json();

            // Choisir la sidebar appropriée
            const sidebarFile = userInfo.isDOJ && !userInfo.isLSPD ? 'sidebar-doj.html' : 'sidebar.html';

            console.log(`🔧 Chargement sidebar: ${sidebarFile} pour ${userInfo.username} (${userInfo.isDOJ ? 'DOJ' : 'LSPD'})`);

            const sidebarResponse = await fetch(sidebarFile);
            const html = await sidebarResponse.text();

            container.innerHTML = html;

            // Charger les fonctionnalités JS du sidebar
            const script = document.createElement('script');
            script.src = 'scripts/sidebar.js';
            document.body.appendChild(script);

        } catch (err) {
            console.error("Erreur chargement sidebar :", err);
            // Fallback sur la sidebar par défaut
            const fallbackResponse = await fetch('sidebar.html');
            const fallbackHtml = await fallbackResponse.text();
            container.innerHTML = fallbackHtml;

            const script = document.createElement('script');
            script.src = 'scripts/sidebar.js';
            document.body.appendChild(script);
        }
    }
});
