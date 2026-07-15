CI6 CONNECT
Bienvenue

Bonjour à toi, administrateur de CI6 Connect.

Si tu lis ce document, c'est probablement que tu es amené à maintenir ou faire évoluer ce site.

Avant toute chose, rassure-toi : CI6 Connect n'est pas un site complexe.

Il a été conçu avec un objectif simple :

Permettre à n'importe quel cadre de mettre à jour les informations sans avoir de connaissances en programmation.

La majorité des modifications consiste simplement à éditer quelques fichiers texte au format Markdown (.md) ou à déplacer quelques blocs dans un fichier de configuration.

Si tu respectes les quelques règles décrites dans ce document, tu ne risques pas de casser le site.

*****************************
*** Philosophie du projet ***
*****************************

CI6 Connect a été développé pour répondre à plusieurs objectifs :

centraliser les informations utiles aux élèves ;
faciliter la diffusion des consignes ;
éviter les impressions papier inutiles ;
permettre une mise à jour rapide des informations.

L'application est volontairement statique.

Il n'y a :
aucune base de données ;
aucun serveur ;
aucune installation particulière.

Tout fonctionne uniquement avec quelques fichiers.

C'est ce qui rend le projet très robuste.

******************************
*** Architecture du projet ***
******************************

À la racine se trouvent :

index.html
    C'est le point d'entrée du site. Ne pas modifier son nom.

content/
    Contient toutes les fiches consultées par les élèves.
    Chaque fiche est un simple document texte au format Markdown (.md).
    C'est dans ce dossier que tu passeras la majorité de ton temps.

assets/
    Contient tout ce qui est utilisé par le site :

images
icônes
illustrations
JavaScript
CSS
cartes des rubriques
Une règle très importante

L'architecture du projet ne doit jamais être modifiée.

Ne pas :

renommer les dossiers ;
déplacer les dossiers ;
renommer les fichiers JavaScript ;
renommer les fichiers CSS.

Tous les chemins sont déjà configurés.

***********************************
*** Modifier l'ordre des tuiles ***
***********************************

Le menu du site est entièrement décrit dans : assets/js/config.js

Chaque tuile est représentée par un bloc.
Exemple :
{
    id: "01",
    title: "Respecter les horaires",
    ...
}

Pour modifier l'ordre : Il suffit de déplacer le bloc complet.
    Un bloc commence par : {
    et se termine par }
    (suivi éventuellement d'une virgule).

Pour une rubrique possédant des sous-rubriques, déplacer l'ensemble du bloc, sans supprimer les éléments contenus à l'intérieur.

Aucune autre modification n'est nécessaire.

**************************
*** Modifier une fiche ***
**************************

Toutes les fiches se trouvent dans : content/

Une fiche est un simple document texte.
Exemple : 01-horaires.md

Pour modifier une information :
    ouvrir le fichier ;    
    modifier le texte ;
    enregistrer.

Aucune connaissance en HTML n'est nécessaire.

*****************************
*** Les blocs disponibles ***
*****************************

Les fiches utilisent un langage très simple.

Exemple :
:::directives
texte
:::

Chaque bloc crée automatiquement une carte colorée.

Les principaux blocs disponibles sont :
    :::directives
    :::autorise
    :::interdit
    :::conseil
    :::attention
    :::telechargements

Il est également possible de donner un titre personnalisé :
    :::directives Horaires du vendredi
    ... texte de la fiche
    :::
    Le style restera identique. Seul le titre affiché changera.

**********************************
*** Ajouter une nouvelle fiche ***
**********************************
    Copier une fiche existante.
    Modifier son contenu.
    Enregistrer sous un nouveau nom.
    Penser à ajouter la nouvelle rubrique dans : assets/js/config.js
    Il n'y a rien d'autre à faire.

*************************
*** Ajouter une image ***
*************************

Les images utilisées dans les fiches sont placées dans : assets/photos/

Il suffit ensuite de les appeler dans la fiche.

Exemple :

    :::image Parking visiteurs
    assets/photos/parking.webp
    :::

*****************************
*** Mettre le site à jour ***
*****************************

Une fois les modifications terminées :

enregistrer les fichiers ;
envoyer les modifications sur GitHub ;
attendre quelques instants que GitHub Pages republie automatiquement le site.

Aucune compilation n'est nécessaire.

En cas de problème

Si le site ne s'affiche plus correctement :

vérifier les dernières modifications ;
vérifier qu'un bloc ::: est bien fermé ;
vérifier qu'une accolade {} n'a pas été supprimée dans config.js ;
vérifier que le chemin d'une image ou d'un document est correct.

Dans la grande majorité des cas, l'erreur provient d'une faute de frappe.

Avant de modifier le code

Les fichiers suivants ne doivent être modifiés que de manière exceptionnelle :

assets/js/app.js
assets/css/style.css

Ils contiennent le fonctionnement général de CI6 Connect.

La plupart des évolutions du site peuvent être réalisées sans jamais toucher à ces fichiers.

************************
*** Esprit du projet ***
************************

CI6 Connect a été pensé pour durer.

Si tu souhaites le faire évoluer :

    privilégie toujours la simplicité ;
    évite les solutions complexes ;
    conserve une architecture claire ;
    préfère créer une nouvelle fiche plutôt que modifier le fonctionnement du moteur.

L'objectif est que n'importe quel cadre puisse maintenir ce site, aujourd'hui comme dans plusieurs années, sans connaissances particulières en développement.

Je terminerais par une phrase qui résume bien la philosophie du projet :

"Le meilleur développement est celui qui se fait oublier. Si la mise à jour d'une information te prend moins de cinq minutes sans écrire une ligne de code, alors CI6 Connect remplit parfaitement sa mission."
