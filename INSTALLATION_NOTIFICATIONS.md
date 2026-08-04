# Notifications CI6 Connect

## 1. Base D1

Dans Cloudflare > D1 > ci6-connexion-utilisateurs > Console, exécuter le contenu de :

`cloudflare/d1-notifications.sql`

Le binding D1 doit rester nommé `DB`.

## 2. Variables et secrets Pages

Dans le projet Pages > Settings > Variables and Secrets :

- `VAPID_PUBLIC_KEY` : variable texte ;
- `VAPID_PRIVATE_KEY` : secret ;
- `VAPID_SUBJECT` : variable texte, par exemple `mailto:ci6egmln@gmail.com`.

Appliquer ces valeurs à l’environnement Production. Un nouveau déploiement est nécessaire.

## 3. Utilisation

Chaque utilisateur ouvre CI6 Connect et clique sur `Activer les notifications`.

Lorsqu’un cadre modifie une fiche, l’éditeur propose :

- envoyer ou non une notification ;
- tous les utilisateurs, élèves uniquement ou cadres uniquement ;
- titre et message ;
- niveau important.

La case est cochée par défaut pour `content/news.md` et les fichiers `content/faq-*.md`.

## 4. Remarque iPhone/iPad

Sur iPhone/iPad, le site doit généralement être ajouté à l’écran d’accueil avant de pouvoir autoriser les notifications Web.
