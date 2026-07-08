# CI6 Connect V3

## Principe

Cette version simplifie le site : chaque tuile utilise une image unique dans `assets/cards/`.

Le site superpose automatiquement :
- le numéro ;
- le titre ;
- la description.

## À modifier au quotidien

### Modifier les textes des fiches
Dossier : `content/`

Exemple :
`content/01-horaires.md`

Cliquez sur le fichier dans GitHub, puis sur le crayon, modifiez le texte et validez avec **Commit changes**.

### Remplacer une carte visuelle
Dossier : `assets/cards/`

Chaque carte doit garder le même nom.

Exemple :
`assets/cards/01-horaires.jpg`

Pour changer la tuile horaires, remplacez ce fichier par une nouvelle image portant exactement le même nom.

### Changer l’ordre ou les titres des tuiles
Fichier :
`assets/js/config.js`

## Mise en ligne GitHub Pages

Le site est publié depuis :
- branche : `main`
- dossier : `/ (root)`

Adresse attendue :
`https://ci6egmln.github.io/CI6-Connect/`
