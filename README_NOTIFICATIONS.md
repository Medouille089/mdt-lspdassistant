# 🔔 Custom Notifications System - LSPD Assistant

**Système de notifications modulaire compatible FiveM NUI**

Remplace les fonctions natives `alert()`, `confirm()` et `prompt()` qui ne fonctionnent pas dans les iframes/NUI de FiveM.

---

## 📦 Fichiers du système

```
LSPD/
├── styles/
│   ├── custom-notifications.css          # ⭐ Styles des notifications
│   └── CUSTOM_NOTIFICATIONS_README.md    # Documentation détaillée
├── scripts/
│   └── custom-notifications.js           # ⭐ Logique des notifications
├── notification-example.html             # 🎨 Page de démo interactive
├── MIGRATION_GUIDE.md                   # 🚀 Guide de migration rapide
└── README_NOTIFICATIONS.md              # 📖 Ce fichier
```

---

## 🚀 Installation en 30 secondes

### 1. Dans votre fichier HTML

```html
<!DOCTYPE html>
<html>
<head>
    <!-- Vos autres CSS -->
    <link rel="stylesheet" href="styles/custom-notifications.css">
</head>
<body>
    <!-- Votre contenu -->
    
    <!-- Charger AVANT vos scripts -->
    <script src="scripts/custom-notifications.js"></script>
    <script src="scripts/votre-script.js"></script>
</body>
</html>
```

### 2. Dans votre fichier JavaScript

```javascript
// Au lieu de alert()
showNotification('Message', 'info');

// Au lieu de confirm()
showConfirm('Êtes-vous sûr ?', function(result) {
    if (result) { /* action */ }
});

// Au lieu de prompt()
showPrompt('Votre nom', 'Défaut', function(value) {
    if (value !== null) { /* utiliser value */ }
});
```

**C'est tout ! ✅**

---

## 📖 Documentation

| Fichier | Description |
|---------|-------------|
| **CUSTOM_NOTIFICATIONS_README.md** | Documentation complète avec tous les exemples |
| **MIGRATION_GUIDE.md** | Guide pratique pour migrer un fichier existant |
| **notification-example.html** | Démo interactive à ouvrir dans le navigateur |

---

## 🎯 Exemples rapides

### Notifications (4 types)

```javascript
showNotification('Information', 'info');      // Bleu
showNotification('Succès !', 'success');      // Vert
showNotification('Attention !', 'warning');   // Orange
showNotification('Erreur !', 'error');        // Rouge
```

### Confirmation

```javascript
showConfirm('Supprimer cet élément ?', function(confirmed) {
    if (confirmed) {
        deleteElement();
        showNotification('Élément supprimé', 'success');
    }
});
```

### Prompt

```javascript
showPrompt('Entrez votre nom', '', function(nom) {
    if (nom !== null && nom.trim() !== '') {
        showNotification('Bonjour ' + nom, 'success');
    }
});
```

### Options personnalisées

```javascript
// Confirm avec texte personnalisé
showConfirm('Message', callback, {
    yesText: 'Valider',
    noText: 'Annuler'
});

// Prompt avec placeholder
showPrompt('Message', '', callback, {
    okText: 'Enregistrer',
    cancelText: 'Annuler',
    placeholder: 'Tapez ici...'
});
```

---

## ✅ Avantages

- ✅ **Compatible FiveM** - Fonctionne dans les NUI
- ✅ **Modulaire** - 2 fichiers à inclure, c'est tout
- ✅ **Sans dépendances** - Vanilla JS/CSS uniquement
- ✅ **Léger** - ~15KB au total
- ✅ **Responsive** - Adapté mobile/desktop
- ✅ **Personnalisable** - CSS modifiable facilement
- ✅ **Élégant** - Design moderne et professionnel

---

## 🔄 Fichiers déjà migrés

Les fichiers suivants utilisent déjà ce système :

- ✅ `calculateur-peine.html` + `calculateur-peines.js`
- ✅ `documentation.html` + `faq.js`
- ✅ `recrutement.html` + `recrutement.js`

Vous pouvez les consulter comme exemples de migration réussie.

---

## 🎨 Démo

Ouvrez **`notification-example.html`** dans votre navigateur pour voir une démo interactive complète avec :

- Tous les types de notifications
- Exemples de confirm
- Exemples de prompt
- Options personnalisées
- Code source visible

---

## 📝 Migration d'un fichier existant

### Étapes rapides :

1. **Ajouter les fichiers** (CSS + JS) dans le HTML
2. **Remplacer `alert()`** par `showNotification()`
3. **Remplacer `confirm()`** par `showConfirm()` avec callback
4. **Remplacer `prompt()`** par `showPrompt()` avec callback
5. **Tester** dans FiveM

### Détails complets :

👉 Voir **MIGRATION_GUIDE.md** pour le guide pas à pas

---

## 🎨 Personnalisation

### Changer les couleurs

Éditez `styles/custom-notifications.css` :

```css
/* Notification info (bleu par défaut) */
.custom-notification.notification-info {
    border-left-color: #votre-couleur;
}
```

### Changer la position

```css
.notification-container {
    top: 20px;    /* Haut de l'écran */
    right: 20px;  /* Droite (ou left: 20px; pour gauche) */
}
```

### Changer la durée

Dans `scripts/custom-notifications.js` :

```javascript
window.showNotification = function(message, type = 'info', duration = 5000) {
    // 5000 = 5 secondes au lieu de 3 par défaut
```

---

## 🐛 Support

### Problèmes courants

| Problème | Solution |
|----------|----------|
| "showNotification is not defined" | Vérifier que le JS est chargé avant votre script |
| Notifications invisibles | Vérifier que le CSS est chargé |
| Confirm ne marche pas | Utiliser une fonction callback, ne pas retourner de valeur |

### Besoin d'aide ?

1. Consultez **CUSTOM_NOTIFICATIONS_README.md** (doc complète)
2. Consultez **MIGRATION_GUIDE.md** (exemples pratiques)
3. Ouvrez **notification-example.html** (démo visuelle)

---

## 📊 API Rapide

### showNotification(message, type, duration)

```javascript
showNotification(
    'Message',    // string - Message à afficher
    'info',       // string - 'info'|'success'|'warning'|'error'
    3000          // number - Durée en ms (0 = permanent)
);
```

### showConfirm(message, callback, options)

```javascript
showConfirm(
    'Message',    // string - Question à poser
    function(result) {
        // result = true (Oui) ou false (Non)
    },
    {
        yesText: 'Oui',    // Texte bouton Oui
        noText: 'Non'      // Texte bouton Non
    }
);
```

### showPrompt(message, defaultValue, callback, options)

```javascript
showPrompt(
    'Message',         // string - Question
    'Valeur défaut',   // string - Valeur par défaut
    function(value) {
        // value = string saisie ou null si annulé
    },
    {
        okText: 'OK',
        cancelText: 'Annuler',
        placeholder: 'Texte...'
    }
);
```

---

## 🏆 Créé par

**Medouille** - LSPD Assistant Project

Compatible avec FiveM NUI et tous les navigateurs modernes.

---

## 📄 Licence

MIT License - Libre d'utilisation et de modification

---

**Bon développement ! 🚀**
