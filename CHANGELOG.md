<!--
	CHANGELOG
	Format: Keep a Changelog (https://keepachangelog.com) + Semantic Versioning.
	Commits: Encourage Conventional Commits (feat:, fix:, refactor:, perf:, docs:, chore:, build:, ci:, test:)
-->

# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur "Keep a Changelog" et ce projet adhère (ou vise à adhérer) à Semantic Versioning.

## [Unreleased]
### Added
- (placeholder) Nouvelle fonctionnalité ou module.

### Changed
- (placeholder) Modification de comportement existant.

### Fixed
- (placeholder) Correction de bug.

### Security
- (placeholder) Patch de sécurité.

### Deprecated
- (placeholder) Fonctionnalités en voie de suppression.

### Removed
- (placeholder) Eléments retirés après période de dépréciation.

### Migration Notes
- (placeholder) Étapes nécessaires lors de la mise à jour.

---

## [1.1.0] - 2025-10-08
### Added
- Refonte du README détaillé (architecture, API, roadmap).
- Édition inline des armes & véhicules dans `infosagent.html`.
- Bouton d'édition stylé + verrouillage édition profil.

### Changed
- Normalisation API profil agent : parsing sécurisé JSON `armes` / `vehicules`.
- Lien profil depuis Trello rendu absolu (`/LSPD/infosagent.html`).

### Fixed
- Suppression et modification d'équipements qui ne persistaient pas.
- Problème de chemin relatif depuis `trello/index.html`.

### Technical
- Ajout parsing robuste dans `routes/agents.js`.
- Amélioration visibilité des actions en mode édition.

---

## [1.0.0] - 2025-??-??
### Added
- Version initiale : Auth Discord, profils agents, sanctions, convocations, Trello temps réel, présence, absences.

---

## Guide de mise à jour

1. Vérifier les notes de migration dans la section "Migration Notes" de la version cible.
2. Mettre à jour les variables d'environnement si de nouveaux champs sont introduits.
3. Exécuter les migrations SQL le cas échéant (schéma Trello ou tables LSPD).

## Règles de rédaction

- Grouper les entrées par type (Added / Changed / Fixed / Security / Deprecated / Removed / Migration Notes).
- Préférer la voix active et les phrases concises.
- Faire référence aux fichiers ou routes entre backticks (ex: `routes/agents.js`).
- Les changements internes non visibles (refactor sans impact utilisateur) vont sous "Technical" ou "Changed".

## Snippet de modèle pour une nouvelle version

```markdown
## [X.Y.Z] - YYYY-MM-DD
### Added
- 
### Changed
- 
### Fixed
- 
### Security
- 
### Deprecated
- 
### Removed
- 
### Migration Notes
- 
### Technical
- 
```

## Liens de comparaison (ajouter quand repo public)
<!--
[Unreleased]: https://github.com/OWNER/REPO/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/OWNER/REPO/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/OWNER/REPO/releases/tag/v1.0.0
-->

---

> Mettre à jour ce fichier à chaque PR significative avant fusion.
