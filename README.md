
# CI6 Connect — V2 Markdown

## Modifier les textes

Ouvrir le dossier `content/` puis modifier le fichier Markdown correspondant à la rubrique.

Exemple :

- `content/01-horaires.md`
- `content/12-mdl-eleves-jour.md`

Sur GitHub : ouvrir le fichier, cliquer sur le crayon, modifier, puis cliquer sur **Commit changes**.

## Modifier une illustration

Les icônes sont dans `assets/icons/`.

Pour remplacer l’icône de la rubrique 2, remplacer le fichier :

`assets/icons/02-tenue.svg`

Il faut garder exactement le même nom de fichier.

## Modifier le fond d’une tuile

Les fonds sont dans `assets/backgrounds/`.

Pour remplacer le fond de la rubrique 6, remplacer :

`assets/backgrounds/06-collectivite.svg`

Il faut garder exactement le même nom de fichier.

## Modifier le logo

Remplacer :

`assets/img/logo-ci6.png`

## Modifier l’ordre ou le nom des tuiles

Ouvrir :

`assets/js/config.js`

Chaque rubrique est décrite dans ce fichier.

## Publier sur GitHub Pages

1. Déposer tous les fichiers dans le dépôt GitHub.
2. Aller dans **Settings → Pages**.
3. Choisir **Deploy from a branch**.
4. Choisir **main** et **/ root**.
5. Enregistrer.
