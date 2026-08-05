# CI6 Connect

CI6 Connect est le guide numérique de la 6ᵉ compagnie d’instruction de l’École de gendarmerie de Montluçon.

Il regroupe les consignes destinées aux élèves, les outils réservés aux cadres, l’administration des utilisateurs, l’édition des fiches, les médias, les notifications, le suivi des consultations et le suivi disciplinaire.

## Architecture actuelle

Le projet est publié avec Cloudflare Pages et utilise :

- des pages HTML statiques ;
- les fichiers CSS et JavaScript de `assets/` ;
- les fiches Markdown de `content/` ;
- les fonctions Cloudflare Pages de `functions/` ;
- une base Cloudflare D1 ;
- GitHub pour l’historique et la publication des fiches, photos et documents.

Le projet n’est donc plus uniquement statique.

## Principaux fichiers

- `index.html` : page principale ;
- `login.html` : connexion ;
- `administration.html` : administration générale ;
- `sanctions.html` : suivi disciplinaire ;
- `assets/js/config.js` : domaines, rubriques et chemins ;
- `assets/js/app.js` : moteur principal et éditeur ;
- `assets/css/style.css` : présentation générale ;
- `content/` : fiches Markdown ;
- `assets/photos/` : photos des fiches ;
- `assets/documents/` : documents à télécharger ;
- `functions/` : fonctions Cloudflare.

## Configuration Cloudflare

Le projet utilise notamment :

- la base D1 liée sous le nom `DB` ;
- `SITE_USERNAME` ;
- `SITE_PASSWORD` ;
- `SESSION_SECRET` ;
- `GITHUB_TOKEN`.

Ces valeurs doivent rester dans les secrets ou variables Cloudflare et ne doivent jamais être inscrites dans les fichiers.

## Modifier les domaines et rubriques

La navigation est décrite dans :

```text
assets/js/config.js
```

Pour déplacer un domaine ou une rubrique, déplacer son objet complet sans modifier ses accolades ni séparer ses enfants.

## Modifier une fiche

Les fiches se trouvent dans `content/`.

Elles peuvent être modifiées directement en Markdown ou depuis l’éditeur réservé aux cadres.

## Ajouter une photo

Depuis l’éditeur :

1. choisir une photo JPEG, PNG ou WebP ;
2. donner un nom court en 2 à 4 mots ;
3. ajouter éventuellement une légende ;
4. envoyer la photo.

Les fichiers HEIC et HEIF sont refusés. Ils doivent être convertis ou partagés en JPEG ou PNG.

La photo est redimensionnée si nécessaire, convertie en WebP et enregistrée dans `assets/photos/`.

## Ajouter un document

Depuis l’éditeur :

1. choisir le fichier ;
2. vérifier ou corriger le titre proposé ;
3. envoyer le document.

Le titre renseigné est celui qui sera affiché aux utilisateurs.

## Publication

Les modifications envoyées dans GitHub déclenchent le déploiement Cloudflare Pages.

Après chaque mise à jour importante :

1. vérifier le commit GitHub ;
2. attendre la fin du déploiement ;
3. tester les profils élève, cadre et administrateur ;
4. contrôler le rendu sur téléphone.

## Sauvegardes

Les fiches, photos et documents bénéficient de l’historique GitHub.

Les données dynamiques sont stockées dans Cloudflare D1, notamment les utilisateurs, consultations, sanctions, paramètres et réglages de visibilité.

Avant toute intervention importante sur la base, effectuer une sauvegarde ou un export D1 depuis Cloudflare.

## Journalisation

Le suivi disciplinaire conserve déjà un journal d’audit des créations, modifications et suppressions.

Les futures évolutions sensibles devront appliquer la même logique aux utilisateurs, rôles, publications et changements de visibilité.

## Vocabulaire recommandé

- **domaine** : grande tuile ;
- **rubrique** : niveau inférieur ;
- **fiche** : page de contenu ;
- **photo** : image ajoutée par un cadre ;
- **document à télécharger** : pièce jointe proposée aux utilisateurs.

## Contrôles avant mise en production

- vérifier la syntaxe JavaScript ;
- tester la connexion ;
- tester les trois rôles ;
- tester l’ouverture et le retour arrière ;
- modifier et publier une fiche ;
- envoyer une photo et un document ;
- vérifier les rubriques masquées ;
- tester le suivi disciplinaire ;
- contrôler le rendu mobile.

## Fichiers sensibles

Modifier avec prudence :

```text
assets/js/app.js
assets/js/config.js
assets/css/style.css
functions/
administration.html
sanctions.html
```

Toujours repartir de la dernière version complète du projet pour éviter toute régression.


## Export administratif de la base

La page `administration.html` comporte un bouton **Télécharger la sauvegarde**.

Il appelle la fonction :

```text
functions/admin/backup-export.js
```

L’export produit un fichier JSON horodaté contenant les tables dynamiques disponibles :

- `users` ;
- `settings` ;
- `homepage_tiles` ;
- `fiche_consultations` ;
- `discipline_students` ;
- `discipline_sanctions` ;
- `discipline_audit_log` ;
- `push_subscriptions`.

L’accès est réservé aux administrateurs.

Le fichier contient des données sensibles, notamment les comptes et les abonnements aux notifications. Il doit être conservé sur un support sécurisé et ne doit pas être transmis par messagerie ordinaire.

Cette première fonction assure l’export. Une restauration automatique ne doit être ajoutée qu’après validation d’une procédure contrôlée afin d’éviter l’écrasement accidentel de la base.

## Principe de maintenance

CI6 Connect doit rester simple, fiable et adapté au téléphone.

Toute évolution doit privilégier la clarté, la réduction des manipulations, la conservation de l’historique et la possibilité de revenir en arrière.
