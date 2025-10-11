# 🔐 Système d'Authentification Hybride - LSPD Assistant

## Vue d'ensemble

Le système d'authentification du LSPD Assistant combine désormais **deux méthodes de connexion** :
1. **Authentification Discord OAuth** (méthode originale)
2. **Authentification locale** avec login/mot de passe

## Flux d'authentification

### Première connexion (Nouveau utilisateur)

```
1. Utilisateur clique sur "Se connecter avec Discord"
2. Authentification via Discord OAuth
3. Vérification des rôles Discord (LSPD requis)
4. ✅ Si rôles valides → Redirection vers page de création de compte
5. Utilisateur crée un compte local (username + password)
6. Compte lié au Discord ID
7. Accès au site
```

### Connexions suivantes

L'utilisateur peut choisir entre :

#### Option A : Connexion Discord
```
1. Clic sur "Se connecter avec Discord"
2. Authentification Discord
3. Accès immédiat (compte déjà créé)
```

#### Option B : Connexion Locale
```
1. Onglet "Compte Local"
2. Saisie username + password
3. Vérification des identifiants
4. Synchronisation des rôles Discord
5. Accès au site
```

## Fonctionnalités

### ✅ Déjà implémenté

- ✅ Double authentification (Discord + Local)
- ✅ Création de compte local lié à Discord
- ✅ Hashage sécurisé des mots de passe (bcrypt)
- ✅ Réinitialisation de mot de passe via Discord DM
- ✅ Synchronisation des rôles Discord à chaque connexion
- ✅ Logs des actions dans le channel Discord
- ✅ Validation des mots de passe (force, longueur)
- ✅ Interface utilisateur moderne et responsive

### 🔄 Synchronisation des permissions

Les **permissions (rôles Discord) sont synchronisées à chaque connexion** pour garantir :
- ✅ Les droits sont toujours à jour
- ✅ Pas de désynchronisation entre Discord et le site
- ✅ Révocation immédiate en cas de retrait de rôle

## Structure de la base de données

### Table `user_accounts`

```sql
CREATE TABLE user_accounts (
    id SERIAL PRIMARY KEY,
    discord_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);
```

## Nouvelles routes

| Route | Méthode | Description |
|-------|---------|-------------|
| `/register.html` | GET | Page de création de compte |
| `/register` | POST | Création du compte local |
| `/login-local` | POST | Connexion avec login/password |
| `/forgot-password.html` | GET | Page de récupération de mot de passe |
| `/forgot-password` | POST | Demande de réinitialisation |
| `/reset-password.html` | GET | Page de nouveau mot de passe |
| `/reset-password` | POST | Réinitialisation du mot de passe |
| `/api/user/discord-info` | GET | Infos Discord de l'utilisateur connecté |

## Sécurité

### Mots de passe
- ✅ Hash bcrypt (10 rounds)
- ✅ Validation côté client et serveur
- ✅ Force minimale : 8 caractères
- ✅ Indicateur de force en temps réel

### Tokens de réinitialisation
- ✅ Générés avec crypto.randomBytes (256 bits)
- ✅ Expiration après 1 heure
- ✅ Usage unique (supprimé après utilisation)
- ✅ Envoi sécurisé via Discord DM

### Protection des données
- ✅ Pas de stockage de mots de passe en clair
- ✅ Requêtes paramétrées (protection SQL injection)
- ✅ Validation des entrées utilisateur
- ✅ Messages d'erreur génériques (pas de fuite d'info)

## Récupération de mot de passe

Le système utilise **Discord DM** pour envoyer les liens de réinitialisation :

```
1. Utilisateur entre son username
2. Système génère un token unique
3. Lien envoyé en MP Discord
4. Utilisateur clique sur le lien
5. Définit un nouveau mot de passe
6. Token supprimé (usage unique)
```

### Avantages de Discord DM
- ✅ Pas besoin de configurer un serveur email
- ✅ Communication directe et sécurisée
- ✅ Utilisateur déjà authentifié sur Discord
- ✅ Intégration native avec le bot

## Migration des utilisateurs existants

Les utilisateurs existants devront :
1. Se connecter une première fois via Discord
2. Créer leur compte local
3. Pourront ensuite utiliser les deux méthodes

**Note** : L'accès reste possible avec Discord jusqu'à la création du compte local.

## Configuration

### Variables d'environnement (déjà configurées)

Les variables existantes sont utilisées :
- `CLIENT_ID` - Discord OAuth Client ID
- `CLIENT_SECRET` - Discord OAuth Client Secret
- `REDIRECT_URI` - URL de callback OAuth
- `TOKEN` - Token du bot Discord (pour DM)
- `GUILD_ID` - ID du serveur Discord

### Dépendances

```json
{
  "bcrypt": "^5.1.1",  // Nouveau
  "express": "^5.1.0",
  "passport": "^0.7.0",
  "passport-discord": "^0.1.4",
  "pg": "^8.16.3",
  "discord.js": "^14.21.0"
}
```

## Maintenance

### Nettoyer les tokens expirés

```sql
-- Supprimer les tokens de réinitialisation expirés (à exécuter périodiquement)
UPDATE user_accounts 
SET reset_token = NULL, reset_token_expires = NULL 
WHERE reset_token_expires < NOW();
```

### Désactiver un compte

```sql
UPDATE user_accounts 
SET is_active = false 
WHERE discord_id = 'DISCORD_ID';
```

### Voir les statistiques

```sql
-- Comptes créés récemment
SELECT COUNT(*) as new_accounts 
FROM user_accounts 
WHERE created_at > NOW() - INTERVAL '7 days';

-- Dernières connexions
SELECT username, last_login 
FROM user_accounts 
ORDER BY last_login DESC 
LIMIT 10;
```

## Logs Discord

Tous les événements importants sont loggés dans le channel configuré :

- ✅ Création de compte
- ✅ Connexion locale
- ✅ Réinitialisation de mot de passe
- ✅ Tentatives de connexion échouées (optionnel)

## Support

En cas de problème :
1. Vérifier que la table `user_accounts` existe
2. Vérifier les permissions du bot Discord (SEND_MESSAGES en DM)
3. Consulter les logs du serveur
4. Vérifier la configuration OAuth Discord

## Roadmap future (optionnel)

- [ ] 2FA (Two-Factor Authentication)
- [ ] Historique des connexions
- [ ] Gestion des sessions multiples
- [ ] Export des données utilisateur (RGPD)
- [ ] Blacklist d'adresses email
- [ ] Rate limiting sur les tentatives de connexion

## Auteur

- **Medouille** - Développement initial
- **Amélioration du système d'authentification** - Janvier 2025
