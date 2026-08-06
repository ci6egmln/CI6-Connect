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
- `notations.html` : rédaction et validation des littéraux SimpliNote ;
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

Les données dynamiques sont stockées dans Cloudflare D1, notamment les utilisateurs, consultations, sanctions, notations, paramètres et réglages de visibilité.

## SimpliNote — notation des élèves

La tuile **Notation des élèves** de l’espace cadres ouvre `notations.html`.

- l’administrateur importe dans la page d’administration un CSV contenant `nom`, `prenom`, `grade`, `peloton`, `moyenne`, `classement` et, facultativement, `sexe` ;
- l’administrateur affecte chaque compte cadre à P1, P2 ou P3 ;
- un cadre ne peut consulter et modifier que les élèves de son peloton ;
- la validation par le commandant de peloton transmet la notation au CDU et retire l’élève de la liste active ;
- les administrateurs disposent de la vue CDU, peuvent modifier toutes les notations et les finaliser ;
- l’export CSV est disponible par peloton ou pour toute la compagnie après finalisation CDU ;
- chaque littéral est limité à 2 000 caractères et les opérations sensibles sont journalisées.

Les tables D1 sont créées automatiquement au premier accès. Le script `cloudflare/d1-notations.sql` permet aussi de les initialiser manuellement.

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
- `notation_students` ;
- `notation_records` ;
- `notation_access` ;
- `notation_audit_log` ;
- `push_subscriptions`.

L’accès est réservé aux administrateurs.

Le fichier contient des données sensibles, notamment les comptes et les abonnements aux notifications. Il doit être conservé sur un support sécurisé et ne doit pas être transmis par messagerie ordinaire.

Cette première fonction assure l’export. Une restauration automatique ne doit être ajoutée qu’après validation d’une procédure contrôlée afin d’éviter l’écrasement accidentel de la base.


## Restauration d’une sauvegarde

La page d’administration permet également de sélectionner une sauvegarde JSON et de la contrôler avant restauration.

Deux modes sont proposés :

- **Fusionner** : ajoute les lignes absentes et met à jour celles qui possèdent la même clé primaire, sans effacer les autres données ;
- **Remplacer** : vide les tables sélectionnées puis les reconstruit à partir de la sauvegarde.

Le mode **Remplacer** exige la saisie du mot `RESTAURER`.

Avant toute restauration, le serveur crée une sauvegarde complète de l’état actuel. Après réussite de l’opération, cette sauvegarde de sécurité est automatiquement téléchargée dans le navigateur.

Chaque restauration est inscrite dans la table :

```text
administration_audit_log
```

La fonction utilisée est :

```text
functions/admin/backup-restore.js
```

La restauration est réservée aux administrateurs et n’accepte que les tables explicitement autorisées par le code.


## Administration repliable

Les grandes rubriques de `administration.html` sont présentées sous forme de panneaux repliables.

Une seule rubrique reste ouverte à la fois. La rubrique utilisée est mémorisée pendant la session du navigateur. Toute la barre de titre est cliquable et utilisable au clavier.

## Journal administratif

La table `administration_audit_log` conserve les actions sensibles réalisées depuis les fonctions administratives.

Les entrées de plus de trois mois sont automatiquement purgées lors de la consultation ou de l’utilisation de la fonction de clôture de formation.

Aucun mot de passe n’est enregistré dans ce journal.

## Clôture de la formation

La rubrique **Clôture de la formation** permet :

- de compter les comptes élèves actifs et désactivés ;
- de contrôler les cadres et administrateurs présents ;
- de modifier leur rôle et leur état ;
- de désactiver tous les élèves ;
- de supprimer définitivement les comptes élèves et les données propres à la promotion.

La suppression définitive exige la saisie de `CLOTURER LA FORMATION`.

Avant cette opération, une sauvegarde JSON doit être téléchargée depuis l’administration.

Les comptes cadres, les fiches Markdown, les photos et les documents ne sont pas supprimés.

## Principe de maintenance

CI6 Connect doit rester simple, fiable et adapté au téléphone.

Toute évolution doit privilégier la clarté, la réduction des manipulations, la conservation de l’historique et la possibilité de revenir en arrière.


## Identifiants pseudonymes

Les nouveaux comptes utilisent un identifiant généré automatiquement au format `ABC123` : trois lettres majuscules suivies de trois chiffres. Pour les élèves et visiteurs, les trois lettres sont aléatoires et ne contiennent ni nom, ni prénom, ni NIGEND, ni peloton. Pour les cadres et administrateurs, elles reprennent les trois premières lettres normalisées du nom afin que le compte reste aisément reconnaissable (par exemple `PAN482`), sans utiliser le NIGEND.

Les noms, prénoms et pelotons restent réservés aux fonctions internes de recherche, de suivi des consultations et de suivi disciplinaire. Seuls les identifiants pseudonymes au format `ABC123` sont désormais acceptés pour les comptes individuels.

Lors du premier accès ou après une réinitialisation, le mot de passe personnel doit contenir au moins 12 caractères et différer d’au moins la moitié du mot de passe provisoire.
