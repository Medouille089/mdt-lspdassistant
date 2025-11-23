# Custom Notifications System - Compatible FiveM

Système de notifications modulaire pour remplacer `alert()`, `confirm()` et `prompt()` qui ne fonctionnent pas dans les NUI FiveM.

## 🚀 Installation

### 1. Inclure les fichiers dans votre HTML

```html
<!DOCTYPE html>
<html>
<head>
    <!-- Votre CSS existant -->
    <link rel="stylesheet" href="styles/custom-notifications.css">
</head>
<body>
    <!-- Votre contenu -->
    
    <!-- Charger le script AVANT vos autres scripts -->
    <script src="scripts/custom-notifications.js"></script>
    <script src="scripts/votre-script.js"></script>
</body>
</html>
```

## 📖 Utilisation

### Notification simple (remplace `alert()`)

```javascript
// Avant (ne fonctionne pas dans FiveM)
alert('Message');

// Après (compatible FiveM)
showNotification('Message', 'info');
```

**Types de notifications disponibles :**
- `'info'` - Bleu (par défaut)
- `'success'` - Vert
- `'warning'` - Jaune/Orange
- `'error'` - Rouge

**Exemples :**

```javascript
// Notification d'information
showNotification('Délit ajouté avec succès', 'success');

// Notification d'avertissement
showNotification('Veuillez remplir tous les champs', 'warning');

// Notification d'erreur
showNotification('Erreur lors du chargement', 'error');

// Notification personnalisée avec durée
showNotification('Ce message reste 5 secondes', 'info', 5000);

// Notification permanente (ne se ferme pas automatiquement)
showNotification('Cliquez sur X pour fermer', 'info', 0);
```

### Confirmation (remplace `confirm()`)

```javascript
// Avant (ne fonctionne pas dans FiveM)
if (confirm('Êtes-vous sûr ?')) {
    // Action si oui
}

// Après (compatible FiveM)
showConfirm('Êtes-vous sûr ?', function(result) {
    if (result) {
        // Action si oui
    } else {
        // Action si non
    }
});
```

**Exemples avancés :**

```javascript
// Confirmation de suppression
showConfirm('Voulez-vous vraiment supprimer cet élément ?', function(confirmed) {
    if (confirmed) {
        // Supprimer l'élément
        showNotification('Élément supprimé', 'success');
    }
});

// Confirmation avec texte personnalisé
showConfirm('Réinitialiser tous les délits ?', function(result) {
    if (result) {
        delitsAjoutes = [];
        showNotification('Délits réinitialisés', 'info');
    }
}, {
    yesText: 'Réinitialiser',
    noText: 'Annuler'
});
```

### Prompt (remplace `prompt()`)

```javascript
// Avant (ne fonctionne pas dans FiveM)
const nom = prompt('Entrez votre nom', 'Valeur par défaut');

// Après (compatible FiveM)
showPrompt('Entrez votre nom', 'Valeur par défaut', function(result) {
    if (result !== null) {
        // L'utilisateur a validé, result contient la valeur
        console.log('Nom saisi:', result);
    } else {
        // L'utilisateur a annulé
    }
});
```

**Exemples avancés :**

```javascript
// Prompt avec placeholder
showPrompt('Entrez un commentaire', '', function(commentaire) {
    if (commentaire !== null && commentaire.trim() !== '') {
        // Traiter le commentaire
        showNotification('Commentaire enregistré', 'success');
    }
}, {
    okText: 'Valider',
    cancelText: 'Annuler',
    placeholder: 'Votre commentaire ici...'
});
```

## 🔧 Migration rapide d'un fichier existant

### Option 1 : Rechercher et remplacer (recommandé)

1. **Remplacer `alert()` :**
   ```javascript
   // Chercher: alert('
   // Remplacer par: showNotification('
   // Et ajouter le type: showNotification('message', 'warning');
   ```

2. **Remplacer `confirm()` :**
   ```javascript
   // Avant:
   if (confirm('Message')) {
       // action
   }
   
   // Après:
   showConfirm('Message', function(confirmed) {
       if (confirmed) {
           // action
       }
   });
   ```

3. **Remplacer `prompt()` :**
   ```javascript
   // Avant:
   const value = prompt('Message', 'default');
   
   // Après:
   showPrompt('Message', 'default', function(value) {
       if (value !== null) {
           // utiliser value
       }
   });
   ```

### Option 2 : Alias globaux (rapide mais moins flexible)

Pour une migration rapide, décommentez ces lignes dans votre code :

```javascript
// Remplace globalement alert() (PAS RECOMMANDÉ pour la production)
// window.alert = function(msg) { showNotification(msg, 'info'); };
```

## 📝 Exemple complet de migration

### Avant (faq.js - original)

```javascript
if (faqEditLock && faqEditLock.locked) {
    alert('Le mode modification est déjà activé par ' + faqEditLock.ownerName);
    return;
}

// Plus tard dans le code
if (!confirm('Voulez-vous sauvegarder ?')) {
    return;
}

const newTitle = prompt('Nouveau titre:', currentTitle);
if (newTitle) {
    // traiter
}
```

### Après (faq.js - migré)

```javascript
if (faqEditLock && faqEditLock.locked) {
    showNotification('Le mode modification est déjà activé par ' + faqEditLock.ownerName, 'warning');
    return;
}

// Plus tard dans le code
showConfirm('Voulez-vous sauvegarder ?', function(result) {
    if (!result) return;
    
    showPrompt('Nouveau titre:', currentTitle, function(newTitle) {
        if (newTitle) {
            // traiter
            showNotification('Titre modifié avec succès', 'success');
        }
    });
});
```

## 🎨 Personnalisation

### Modifier les couleurs

Éditez `custom-notifications.css` :

```css
/* Changer la couleur info (bleu par défaut) */
.custom-notification.notification-info {
    border-left-color: #votre-couleur;
}
```

### Modifier la position des notifications

```css
.notification-container {
    top: 20px;      /* Changez selon vos besoins */
    right: 20px;    /* ou left: 20px; pour gauche */
}
```

### Modifier la durée par défaut

Dans `custom-notifications.js` :

```javascript
window.showNotification = function(message, type = 'info', duration = 5000) {
    // Changez 5000 pour 5 secondes au lieu de 3
```

## ✅ Avantages

- ✅ **Compatible FiveM** - Fonctionne parfaitement dans les NUI
- ✅ **Modulaire** - Facile à intégrer dans n'importe quel projet
- ✅ **Esthétique** - Design moderne et professionnel
- ✅ **Flexible** - Personnalisable via CSS
- ✅ **Léger** - Pas de dépendances externes
- ✅ **Responsive** - S'adapte aux mobiles

## 🐛 Dépannage

### Les notifications n'apparaissent pas

1. Vérifiez que le CSS est bien chargé
2. Vérifiez que le JS est chargé AVANT vos autres scripts
3. Ouvrez la console (F12) pour voir les erreurs

### Conflit avec du code existant

Si vous avez déjà du code qui utilise `showNotification`, utilisez les alias :

```javascript
notify('Message', 'info');        // Au lieu de showNotification
confirmDialog('Message', callback); // Au lieu de showConfirm
promptDialog('Message', '', callback); // Au lieu de showPrompt
```

## 📄 Support

Pour tout problème ou suggestion, créez une issue sur le dépôt.
