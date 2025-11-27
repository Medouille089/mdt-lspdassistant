function demoConfirm() {
    showConfirm('Voulez-vous vraiment effectuer cette action ?', function(result) {
        if (result) {
            showNotification('Vous avez cliqué sur Oui', 'success');
        } else {
            showNotification('Vous avez cliqué sur Non', 'info');
        }
    });
}

function demoPrompt() {
    showPrompt('Quel est votre nom ?', 'Jean Dupont', function(value) {
        if (value !== null) {
            showNotification('Bonjour ' + value + ' !', 'success');
        } else {
            showNotification('Vous avez annulé', 'info');
        }
    });
}

function demoCustomConfirm() {
    showConfirm('Voulez-vous supprimer cet élément ?', function(result) {
        if (result) {
            showNotification('Élément supprimé', 'success');
        } else {
            showNotification('Suppression annulée', 'info');
        }
    }, {
        yesText: 'Supprimer',
        noText: 'Annuler'
    });
}

function demoCustomPrompt() {
    showPrompt('Entrez un commentaire', '', function(value) {
        if (value !== null && value.trim() !== '') {
            showNotification('Commentaire enregistré: ' + value, 'success');
        } else if (value === null) {
            showNotification('Commentaire annulé', 'info');
        } else {
            showNotification('Le commentaire ne peut pas être vide', 'warning');
        }
    }, {
        okText: 'Enregistrer',
        cancelText: 'Annuler',
        placeholder: 'Tapez votre commentaire ici...'
    });
}

// Message de bienvenue
window.addEventListener('load', function() {
    setTimeout(function() {
        showNotification('Bienvenue ! Testez les boutons ci-dessus', 'info');
    }, 500);
});
