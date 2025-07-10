// scripts/loadSidebar.js
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('sidebar-container');

    if (container) {
        fetch('sidebar.html')
            .then(res => res.text())
            .then(html => {
                container.innerHTML = html;

                // Charger les fonctionnalités JS du sidebar (ex: toggle)
                const script = document.createElement('script');
                script.src = 'scripts/sidebar.js';
                document.body.appendChild(script);
            })
            .catch(err => console.error("Erreur chargement sidebar :", err));
    }
});
