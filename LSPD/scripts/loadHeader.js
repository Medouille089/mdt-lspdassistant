fetch('./data/header.html')
    .then(response => {
        if (!response.ok) throw new Error('Erreur de chargement du header');
        return response.text();
    })
    .then(html => {
        document.getElementById('navBarHeader').innerHTML = html;
    })
    .catch(err => {
        console.error(err);
        document.getElementById('navBarHeader').innerHTML = '<p>Impossible de charger le header</p>';
    });