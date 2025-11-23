# 🚀 Guide de Migration Rapide - Custom Notifications

## Étape 1 : Ajouter les fichiers dans votre HTML

### Dans le `<head>` :
```html
<link rel="stylesheet" href="styles/custom-notifications.css" />
```

### Avant la fermeture du `</body>` (AVANT vos scripts) :
```html
<script src="scripts/custom-notifications.js"></script>
<script src="scripts/votre-script.js"></script>
```

---

## Étape 2 : Remplacer les fonctions natives

### ⚠️ Avant (ne fonctionne PAS dans FiveM)

```javascript
// Alert
alert('Message');

// Confirm
if (confirm('Êtes-vous sûr ?')) {
    // action si oui
}

// Prompt
const nom = prompt('Votre nom', 'Défaut');
if (nom) {
    // utiliser nom
}
```

### ✅ Après (compatible FiveM)

```javascript
// Notification
showNotification('Message', 'info');

// Confirm
showConfirm('Êtes-vous sûr ?', function(result) {
    if (result) {
        // action si oui
    }
});

// Prompt
showPrompt('Votre nom', 'Défaut', function(nom) {
    if (nom !== null) {
        // utiliser nom
    }
});
```

---

## Étape 3 : Rechercher et remplacer dans votre fichier

### 🔍 Commandes de recherche/remplacement VS Code

1. **Ouvrir Rechercher/Remplacer** : `Ctrl+H`

2. **Pour alert()** :
   - Chercher : `alert\('([^']+)'\);`
   - Remplacer par : `showNotification('$1', 'warning');`
   - ⚠️ Ajustez le type selon le contexte

3. **Pour confirm() simple** :
   - Plus complexe, nécessite refactoring manuel (voir exemples ci-dessous)

---

## 📋 Exemples de Migration Courants

### Exemple 1 : Alert simple
```javascript
// AVANT
if (delitsAjoutes.length === 0) {
    alert('Aucun délit ajouté');
    return;
}

// APRÈS
if (delitsAjoutes.length === 0) {
    showNotification('Aucun délit ajouté', 'warning');
    return;
}
```

### Exemple 2 : Alert d'erreur
```javascript
// AVANT
try {
    // code
} catch (error) {
    alert('Erreur: ' + error.message);
}

// APRÈS
try {
    // code
} catch (error) {
    showNotification('Erreur: ' + error.message, 'error');
}
```

### Exemple 3 : Alert de succès
```javascript
// AVANT
alert('Candidature envoyée avec succès');

// APRÈS
showNotification('Candidature envoyée avec succès', 'success');
```

### Exemple 4 : Confirm simple
```javascript
// AVANT
if (confirm('Voulez-vous supprimer ?')) {
    deleteItem();
}

// APRÈS
showConfirm('Voulez-vous supprimer ?', function(confirmed) {
    if (confirmed) {
        deleteItem();
    }
});
```

### Exemple 5 : Confirm avec else
```javascript
// AVANT
if (confirm('Sauvegarder les modifications ?')) {
    save();
} else {
    cancel();
}

// APRÈS
showConfirm('Sauvegarder les modifications ?', function(result) {
    if (result) {
        save();
    } else {
        cancel();
    }
});
```

### Exemple 6 : Confirm avec variable
```javascript
// AVANT
const shouldDelete = confirm('Supprimer cet élément ?');
if (shouldDelete) {
    // code
}

// APRÈS
showConfirm('Supprimer cet élément ?', function(shouldDelete) {
    if (shouldDelete) {
        // code
    }
});
```

### Exemple 7 : Prompt simple
```javascript
// AVANT
const titre = prompt('Nouveau titre', currentTitle);
if (titre) {
    updateTitle(titre);
}

// APRÈS
showPrompt('Nouveau titre', currentTitle, function(titre) {
    if (titre !== null && titre.trim() !== '') {
        updateTitle(titre);
    }
});
```

### Exemple 8 : Prompt dans événement
```javascript
// AVANT
button.onclick = function() {
    const value = prompt('Entrez une valeur');
    if (value) processValue(value);
};

// APRÈS
button.onclick = function() {
    showPrompt('Entrez une valeur', '', function(value) {
        if (value !== null) processValue(value);
    });
};
```

---

## 🎨 Choisir le bon type de notification

| Contexte | Type à utiliser |
|----------|----------------|
| Champ manquant | `'warning'` |
| Action réussie | `'success'` |
| Erreur serveur | `'error'` |
| Information | `'info'` |
| Erreur réseau | `'error'` |
| Validation OK | `'success'` |

---

## ⚡ Migration Rapide d'un fichier complet

### Checklist :

- [ ] Ajouter le CSS dans le `<head>`
- [ ] Ajouter le JS avant vos scripts
- [ ] Rechercher tous les `alert(` → remplacer par `showNotification(` + type
- [ ] Rechercher tous les `confirm(` → refactorer avec callback
- [ ] Rechercher tous les `prompt(` → refactorer avec callback
- [ ] Tester chaque cas d'usage
- [ ] Vérifier la console pour les erreurs

---

## 🐛 Problèmes fréquents

### ❌ "showNotification is not defined"
**Solution** : Vérifiez que `custom-notifications.js` est chargé AVANT votre script

### ❌ Les notifications ne s'affichent pas
**Solution** : Vérifiez que le CSS est bien chargé et qu'il n'y a pas de conflit de z-index

### ❌ Confirm ne fonctionne pas comme attendu
**Solution** : N'oubliez pas la fonction callback. Confirm est maintenant asynchrone.

```javascript
// ❌ NE MARCHE PAS
const result = showConfirm('Message'); // result est undefined

// ✅ CORRECT
showConfirm('Message', function(result) {
    // utiliser result ici
});
```

---

## 📚 Ressources

- **Fichier démo** : `notification-example.html`
- **Documentation complète** : `CUSTOM_NOTIFICATIONS_README.md`
- **Fichiers source** :
  - CSS : `styles/custom-notifications.css`
  - JS : `scripts/custom-notifications.js`

---

## ✅ Fichiers déjà migrés dans ce projet

- ✅ `calculateur-peine.html` + `calculateur-peines.js`
- ✅ `documentation.html` + `faq.js`
- ✅ `recrutement.html` + `recrutement.js`

Vous pouvez les utiliser comme référence !
