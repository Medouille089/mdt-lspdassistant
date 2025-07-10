
# Fiche de Présence Bot

## Description
Ce bot Discord est conçu pour gérer une fiche de présence quotidienne dans un serveur Discord. Il envoie un message chaque jour à 12h00 dans un channel spécifique, demandant aux membres de signaler leur disponibilité pour la soirée. Le bot gère également la modification du message précédent, pour éviter de poster des messages redondants.

Le bot utilise la bibliothèque [discord.js](https://discord.js.org/) pour l'interaction avec l'API de Discord, ainsi que [node-schedule](https://www.npmjs.com/package/node-schedule) pour la planification des tâches.

## Fonctionnalités
- **Présence et activité du bot** : Le bot affiche une activité "Fiche de présence" dans Discord et un statut "en ligne".
- **Planification des messages** : Le bot envoie un message chaque jour à 12h00 dans un channel spécifique pour demander aux membres leur disponibilité.
- **Réactions au message** : Le bot ajoute des réactions (✅, ☑️, ❌, ⌛) au message pour permettre aux utilisateurs d'indiquer leur disponibilité.
- **Modification de message** : Si le message précédent contient déjà une fiche de présence, il est mis à jour avec la nouvelle date, sinon un nouveau message est envoyé.

## Prérequis
Avant d'exécuter ce bot, assurez-vous d'avoir les éléments suivants :

- [Node.js](https://nodejs.org/) (version >= 16)
- Un serveur Discord et un bot Discord enregistré avec [Discord Developer Portal](https://discord.com/developers/applications)
- Un fichier `.env` contenant les informations suivantes :
  - `TOKEN`: Le token du bot.
  - `CLIENT_ID`: L'ID du client (bot).
  - `GUILD_ID`: L'ID du serveur Discord.
  
## Installation

1. Clonez ce repository sur votre machine locale :
   ```bash
   git clone https://github.com/votre-utilisateur/fichepresence-bot.git
   ```

2. Accédez au dossier du projet :
   ```bash
   cd fichepresence-bot
   ```

3. Installez les dépendances :
   ```bash
   npm install
   ```

4. Créez un fichier `.env` à la racine du projet et ajoutez les informations suivantes :
   ```
   TOKEN=Votre_Token_Bot
   CLIENT_ID=Votre_Client_ID
   GUILD_ID=Votre_Guild_ID
   ```

5. Lancez le bot :
   ```bash
   node index.js
   ```

## Fonctionnement du bot

Le bot effectue plusieurs tâches dès qu'il est prêt :

1. **Présence du bot** : À la connexion, il définit son activité à "Fiche de présence" et son statut sur "en ligne".
2. **Message quotidien** : Chaque jour à 12h00, il envoie un message dans le channel spécifié (utilise l'ID du channel) pour demander aux membres de signaler leur disponibilité pour la soirée. Les membres peuvent réagir au message en utilisant les emojis suivants :
   - ✅ : Disponible en début de soirée (avant 23h)
   - ☑️ : Disponible en fin de soirée (après 23h)
   - ❌ : Absent
   - ⌛ : Ne sait pas encore

3. **Modification des messages** : Si un message de "fiche de présence" a déjà été envoyé le jour précédent, le bot le met à jour avec la date du jour, sinon il envoie un nouveau message.

## Structure du projet

Le projet est structuré comme suit :

```
/fichepresence-bot
│
├── index.js                  # Fichier principal qui lance le bot
├── .env                      # Fichier de configuration avec les variables d'environnement
├── commands.json             # Contient les permissions et les commandes du bot
├── scripts/
│   └── terminal.js           # Script pour gérer le terminal et les commandes
└── package.json              # Fichier de configuration NPM avec les dépendances
```

## Dépannage

### Erreurs fréquentes

- **"Le channel spécifié est introuvable ou non textuel"** : Vérifiez que l'ID du channel est correct et que ce channel est bien textuel.
- **"Erreur lors de la définition de la présence, de l'activité ou du statut"** : Assurez-vous que toutes les variables d'environnement sont correctement définies dans le fichier `.env`.

### Support
Pour toute question ou problème, vous pouvez ouvrir une issue sur le dépôt GitHub ou contacter l'auteur du bot.

## Licence
Ce projet est sous licence MIT. Consultez le fichier `LICENSE` pour plus d'informations.

---

## Auteurs
- **Développé par** : `Zyrkof`
