// Exemple de fonction avec notification
function saveData() {
    // Simuler une sauvegarde
    setTimeout(() => {
        showNotification('Données sauvegardées avec succès !', 'success');
    }, 500);
}

// Exemple de confirmation
function demoConfirm() {
    showConfirm('Voulez-vous vraiment effectuer cette action ?', function(confirmed) {
        if (confirmed) {
            showNotification('Action confirmée', 'success');
        } else {
            showNotification('Action annulée', 'info');
        }
    });
}

// Exemple de prompt
function demoPrompt() {
    showPrompt('Entrez votre nom', '', function(nom) {
        if (nom !== null && nom.trim() !== '') {
            showNotification('Bonjour ' + nom + ' !', 'success');
        } else if (nom === null) {
            showNotification('Saisie annulée', 'info');
        } else {
            showNotification('Le nom ne peut pas être vide', 'warning');
        }
    });
}

// Exemple de validation de formulaire
function validateForm() {
    const input = document.getElementById('myInput');
    
    if (!input || input.value.trim() === '') {
        showNotification('Veuillez remplir tous les champs obligatoires', 'warning');
        return false;
    }
    
    return true;
}

// Exemple de gestion d'erreur
async function loadData() {
    try {
        const response = await fetch('/api/data');
        
        if (!response.ok) {
            throw new Error('Erreur ' + response.status);
        }
        
        const data = await response.json();
        showNotification('Données chargées avec succès', 'success');
        return data;
        
    } catch (error) {
        showNotification('Erreur lors du chargement : ' + error.message, 'error');
        console.error(error);
    }
}

// Exemple de confirm avant suppression
function deleteItem(itemId) {
    showConfirm('Êtes-vous sûr de vouloir supprimer cet élément ?', function(confirmed) {
        if (confirmed) {
            // Effectuer la suppression
            performDelete(itemId);
        }
    }, {
        yesText: 'Supprimer',
        noText: 'Annuler'
    });
}

function performDelete(itemId) {
    // Simuler une suppression
    setTimeout(() => {
        showNotification('Élément supprimé avec succès', 'success');
    }, 300);
}

// Message de bienvenue au chargement
window.addEventListener('load', function() {
    setTimeout(() => {
        showNotification('Page chargée avec succès', 'info');
    }, 500);
});
