window.CI6_RUBRIQUES = [ 
/* Les commentaires s'écrivent entre slash étoile et étoile slash. Ils sont ignorés par le navigateur. */

/* Pour désactiver temporairement une règle ou un bloc de code ( compris entre { et } )
   (sans le supprimer), il suffit de l'entourer d'un commentaire. */
{
    id: "accueil",
    title: "Livret d'accueil",
    description: "Toutes informations utiles avant l'incorporation.",
    slug: "livret-d'accueil",
    card: "assets/cards/accueil.png",
    children: [ {
        id: "cdu",
        title: "Mot du CDU",
        slug: "accueil-cdu",
        description: "Mot du commandant de la 6ème compagnie",
        content: "content/accueil/cdu.md",
        card: "assets/cards/accueil_cdu.png"
    }, {
        id: "montlucon",
        title: "Montluçon, la ville",
        slug: "accueil-montlucon",
        description: "Vivre sa scolarité dans la ville de Montluçon",
        content: "content/accueil/montlucon.md",
        card: "assets/cards/accueil_montlucon.png"
    }, {
      id: "ecole",
        title: "L'école de gendarmerie",
        slug: "accueil-ecole-gendarmerie-montlucon",
        description: "L'école de gendarmerie de Montluçon",
        content: "content/accueil/ecole.md",
        card: "assets/cards/accueil_ecole.png"
    }, {
      id: "compagnie",
        title: "La 6ème compagnie",
        slug: "accueil-compagnie",
        description: "La 6ème compagnie d'instruction",
        content: "content/accueil/compagnie.md",
        card: "assets/cards/accueil_compagnie.png"
    }, {
      id: "fournitures",
        title: "Que doit-on apporter ?",
        slug: "accueil-fournitures",
        description: "Liste des fournitures utiles, optionnelles ou nécessaires à emporter",
        content: "content/accueil/fournitures.md",
        card: "assets/cards/accueil_fournitures.png"
    }, {
      id: "transport",
        title: "Comment se rendre à Montluçon ?",
        slug: "accueil-transports",
        description: "Comment se rendre à Montluçon",
        content: "content/accueil/transport.md",
        card: "assets/cards/accueil_transport.png"
        /* ajouter vie de la compagnie et de la promotion pour annoncer les responsabilités à tenir */
    } ]
}, 
    {
    id: "horaires",
    title: "Les horaires",
    description: "La ponctualité est la première marque de respect.",
    slug: "respecter-les-horaires",
    content: "content/horaires.md",
    card: "assets/cards/index-horaires.png"
}, 
    {
    id: "tenues",
    title: "Tenue",
    description: "Une tenue militaire soignée, reflet de l’exemplarité.",
    slug: "tenue-presentation",
    card: "assets/cards/index-tenue.png",
   children: [ {
        id: "port",
        title: "Port de la tenue",
        slug: "tenue-port-reglementaire",
        description: "Porter la tenue réglementaire",
        content: "content/tenue-tenue.md",
        card: "assets/cards/tenue_tenue.png"
    }, {
        id: "presentation",
        title: "Savoir se présenter",
        slug: "presentation",
        description: "Savoir se présentare à un cadre à l'extérieur, au bureau, au téléphone",
        content: "content/tenue-presentation.md",
        card: "assets/cards/tenue_presentation.png"
    }, {
      id: "comportement",
        title: "Savoir se comporter",
        slug: "tenue-comportement",
        description: "Se comporter comme un sous-officier, en et hors service",
        content: "content/tenue-comportement.md",
        card: "assets/cards/tenue_comportement.png"
    } ]    
}, 
    {
    id: "locaux",
    title: "Utilisation et entretien des locaux",
    description: "Des locaux propres, utilisés avec respect.",
    slug: "utilisation-entretien-locaux",
    card: "assets/cards/index-locaux.png",
    children: [ {
        id: "circulation",
        title: "Usage des locaux, circulation",
        slug: "locaux-usage-circulation",
        description: "Usage des locaux et circulation",
        content: "content/locaux-circulation.md",
        card: "assets/cards/locaux-circulation.png"
    }, {
        id: "tig",
        title: "Travaux d'intérêt général",
        slug: "locaux-tig",
        description: "Entretenir son lieu de vie.",
        content: "content/locaux-tig.md",
        card: "assets/cards/locaux-tig.png"
    } ]
}, 
    {
    id: "cercle",
    title: "Le cercle mixte",
    description: "Respecter les horaires, les lieux et les règles de vie.",
    slug: "cercle-mixte",
    card: "assets/cards/index-cercle-mixte.png",
    children: [ {
        id: "mess",
        title: "Service du mess",
        slug: "cercle-mixte-mess",
        description: "Règle d'usage du mess",
        content: "content/cercle-mess.md",
        card: "assets/cards/cercle-mess.png"
    }, {
        id: "bar",
        title: "Espace détente",
        slug: "cercle-mixte-bar-detente",
        description: "Règle d'usage et d'accès à l'espace détente",
        content: "content/cercle-detente.md",
        card: "assets/cards/cercle-detente.png"
    },{
        id: "coiffeuse",
        title: "Salon de coiffure",
        slug: "cercle-mixte-coiffure",
        description: "Règle d'usage du salon de coiffure",
        content: "content/cercle-coiffeuse.md",
        card: "assets/cards/cercle-coiffeuse.png"
    },{
        id: "hotel",
        title: "Hotel Couletot",
        slug: "cercle-hotel",
        description: "Réservation de l'hôtel Coutelot.",
        content: "content/cercle-hotel.md",
        card: "assets/cards/cercle-hotel.png"
    } ]
}, {
    id: "collectivite",
    title: "Vivre en collectivité",
    description: "Camaraderie, cohésion et respect mutuel.",
    slug: "vivre-collectivite",
    card: "assets/cards/collectivite.png",
    children: [ {
        id: "hyg",
        title: "Hygiène",
        slug: "collectivie-hygiene",
        description: "Règle de vie en collectivité",
        content: "content/collectivite-hygiene.md",
        card: "assets/cards/collectivite-hygiene.png"
    }, {
        id: "res",
        title: "Respect d'autrui",
        slug: "collectivite-respect",
        description: "Règle de vie en bonne entente avec ces camarades",
        content: "content/collectivite-respect.md",
        card: "assets/cards/collectivite-respect.png"
    },{
        id: "sil",
        title: "Silence",
        slug: "collectivite-silence-extinction-feux",
        description: "Extinction des feux",
        content: "content/collectivite-silence.md",
        card: "assets/cards/collectivite-silence.png"
    } ]
}, {
    id: "materiel",
    title: "Préparer et respecter le matériel",
    description: "Un matériel prêt, contrôlé et entretenu.",
    slug: "materiel",
    card: "assets/cards/materiel.png",
    children: [ {
        id: "individuel",
        title: "Individuel",
        slug: "materiel-individuel",
        description: "Fourniture du matériel individuel par la compagnie",
        content: "content/materiel-individuel.md",
        card: "assets/cards/materiel-individuel.png"
    }, {
        id: "armement",
        title: "matériel armement",
        slug: "materiel-armement",
        description: "Règle de perception de l'armement individuel ou collectif",
        content: "content/materiel-armement.md",
        card: "assets/cards/materiel-armement.png"
    },{
        id: "section",
        title: "matériel demandé par les sections",
        slug: "materiel-section",
        description: "Connaître le matériel à emporter pour les cours donnés par les sections",
        content: "content/materiel-section.md",
        card: "assets/cards/materiel-section.png"
    } ]
}, {
    id: "telephone",
    title: "Utiliser le téléphone à bon escient",
    description: "Un outil utile, jamais une distraction.",
    slug: "telephone",
    content: "content/telephone.md",
    card: "assets/cards/telephone.png"
}, {
    id: "formation",
    title: "S’investir dans sa formation",
    description: "Apprendre, progresser, réussir.",
    slug: "formation",
    card: "assets/cards/formation.png",
    children: [ {
        id: "etude",
        title: "Etude",
        slug: "formation-etude",
        description: "Organiser son temps de révision",
        content: "content/formation-etude.md",
        card: "assets/cards/formation-etude.png"
    }, {
        id: "reussir",
        title: "Réussir sa formation",
        slug: "formation-reussir-etudier-entrainer-participer",
        description: "Que faire pour réussir au mieux sa formation",
        content: "content/formation-reussir.md",
        card: "assets/cards/formation-reussir.png"
    },{
        id: "sport",
        title: "Entraînement physique",
        slug: "formation-entrainement-physique",
        description: "S'entraîner pour ne pas subir",
        content: "content/formation-sport.md",
        card: "assets/cards/formation-sport.png"
    } ]
}, {
    id: "VH",
    title: "VH et compte rendu",
    description: "Savoir à qui s'adresser, rendre compte utilement.",
    slug: "vh-compte-rendu",
    card: "assets/cards/vh.png",
    children: [ {
        id: "cadres",
        title: "Les cadres de la compagnie",
        slug: "vh-cadres",
        description: "Conaître le rôle des cadres",
        content: "content/vh-cadres.md",
        card: "assets/cards/vh-cadres.png"
    }, {
        id: "hierarchie",
        title: "Voie hiérarchique",
        slug: "vh-voie-hierarchique",
        description: "Conaître l'organisation hiérarhique de la compagnie",
        content: "content/vh-vh.md",
        card: "assets/cards/vh-vh.png"
    },{
        id: "compte-rendu",
        title: "Compte rendu",
        slug: "vh-compte-rendu-cr",
        description: "Savoir rendre compte",
        content: "content/vh-cr.md",
        card: "assets/cards/vh-cr.png"
    } ]
}, {
    id: "securite",
    title: "Sécurité incendie",
    description: "La sécurité de tous passe par la vigilance de chacun.",
    slug: "securite-incendie",
    card: "assets/cards/securite.png",
    children: [ {
        id: "appareils",
        title: "Les branchements électriques",
        slug: "securite-appareil-electique",
        description: "Conaître les règles de sécurité électrique",
        content: "content/securite-appareils.md",
        card: "assets/cards/securite-appareils.png"
    }, {
        id: "ssi",
        title: "Système de sécurité incendie",
        slug: "securite-ssi-incendie",
        description: "Savoir utiliser le SSI de la compagnie",
        content: "content/securite-ssi.md",
        card: "assets/cards/securite-ssi.png"
    },{
        id: "evacuation",
        title: "Évacuation indendie",
        slug: "securite-evacuation-incendie",
        description: "Consignes de sécurité et d'évacuation en cas d'incendie",
        content: "content/securite-evacuation.md",
        card: "assets/cards/securite-evacuation.png"
    } ]
}, {
    id: "news",
    title: "Dernières infos et documents utiles",
    description: "Retrouver rapidement les informations et supports utiles.",
    slug: "documents-utiles",
    content: "content/news.md",
    card: "assets/cards/news.png"
}, {
    id: "services",
    title: "Services de l’école",
    description: "Identifier les ressources utiles au quotidien.",
    slug: "services-ecole",
    card: "assets/cards/services.png",
    children: [ {
        id: "BGP",
        title: "BGP",
        slug: "service-bgp",
        description: "Bureau de gestion du personnel",
        content: "content/service-bgp.md",
        card: "assets/cards/service-bgp.png"
    }, {
        id: "diffusion",
        title: "Cellule Diffusion",
        slug: "service-diffusion",
        description: "Reproduction d'affiches, documents, photographies et graphismes",
        content: "content/service-diffusion.md",
        card: "assets/cards/service-diffusion.png"
    }, {
        id: "DSOLC",
        title: "DSOLC",
        slug: "service-dsolc",
        description: "Dépannage informatique, radio et Néogend",
        content: "content/service-dsolc.md",
        card: "assets/cards/service-dsolc.png"
    }, {
        id: "hotel",
        title: "Hôtel Coutelot",
        slug: "service-hotel",
        description: "Réservation de chambre, hôtel Coutelot",
        content: "content/service-hotel.md",
        card: "assets/cards/service-hotel.png"
    }, {
        id: "vaguemestre",
        title: "Vaguemestre",
        slug: "service-vaguemestre",
        description: "Courrier et réception de colis",
        content: "content/service-vaguemestre.md",
        card: "assets/cards/service-vaguemestre.png"
    }, {
        id: "habillement",
        title: "Service Habillement",
        slug: "service-habillement",
        description: "Essayage, commande et livraison d'effets militaires",
        content: "content/service-habillement.md",
        card: "assets/cards/service-habillement.png"
    } ]
}, {
    id: "promotion",
    title: "Vie de la promotion",
    description: "Traditions, cohésion et esprit de promotion.",
    slug: "vie-promotion",
    card: "assets/cards/promotion.png",
    children: [ {
        id: "bureau",
        title: "Bureau promotion",
        slug: "promotion-bureau",
        description: "Constitution du bureau promotion et rôles",
        content: "content/promotion-bureau.md",
        card: "assets/cards/promotion_bureau.png"
    }, {
        id: "commission",
        title: "Commissions promotion",
        slug: "promotion-commission",
        description: "Constitution des commissions et attendus",
        card: "assets/cards/securite-ssi.png",
        /* children par commission */
        children: [ {
        id: "parrain",
        title: "Commission parrain",
        slug: "commission-parrain",
        description: "Recherches sur la vie, la carrière, la famille du parrain et organisation de l'hommage.",
        content: "content/commission-parrain.md",
        card: "assets/cards/commission-parrain.png"
    }, {
        id: "gala",
        title: "Commission Gala",
        slug: "commission-gala",
        description: "Organisation de la soirée de gale, choix de salle, de traiteur, des animations",
        content: "content/commission-gala.md",
        card: "assets/cards/commission-gala.png"
    }, {
        id: "tradition",
        title: "Commission rendez-vous tradition",
        slug: "commission-tradition",
        description: "Organiser les sorties tradition",
        content: "content/commission-tradition.md",
        card: "assets/cards/commission-tradition.png"
    }, {
        id: "defi",
        title: "Commission défi social",
        slug: "commission-defi",
        description: "Choisir une association à soutenir et organiser le défi social",
        content: "content/commission-defi.md",
        card: "assets/cards/commission-defi.png"
    },{
        id: "communication",
        title: "Commission communication",
        slug: "commission-communication",
        description: "Développer les outils de communication et promouvoir les activités de la promotion.",
        content: "content/commission-communication.md",
        card: "assets/cards/commission-communication.png"
    },{
        id: "chant",
        title: "Chant parrain",
        slug: "commission-chant",
        description: "Créer parole et musique pour un chant parrain",
        content: "content/commission-chant.md",
        card: "assets/cards/commission-chant.png"
    },{
        id: "genevieve",
        title: "Sainte Geneviève",
        slug: "commission-genevieve",
        description: "Organiser la participation de la promotion aux compétitions de la Sainte-Geneviève : constitution des équipes, coordination logistique et animation des groupes de supporters.",
        content: "content/commission-genevieve.md",
        card: "assets/cards/commission-genevieve.png"
    },{
        id: "messe",
        title: "Cérémonie religieuse",
        slug: "commission-messe",
        description: "Préparation de la cérémonie religieuse de fin de promotion",
        content: "content/commission-messe.md",
        card: "assets/cards/commission-messe.png"
    },{
        id: "communes",
        title: "Partenariat communes",
        slug: "commission-communes",
        description: "Proposer des actions avec les municipalités partenaires",
        content: "content/commission-communes.md",
        card: "assets/cards/commission-communes.png"
    },{
        id: "defense",
        title: "Partenariat classe défense",
        slug: "commission-defense",
        description: "Proposer des actions avec les lycées de la classe défense",
        content: "content/commission-defense.md",
        card: "assets/cards/commission-defense.png"
    },{
        id: "design",
        title: "Commission design",
        slug: "commission-design",
        description: "Courrier et réception de colis",
        content: "content/commission-design.md",
        card: "assets/cards/commission-design.png"
    },{
        id: "goodies",
        title: "Commission goodies",
        slug: "commission-goodies",
        description: "Création, achat, vente de goodies promotion ou association",
        content: "content/commission-goodies.md",
        card: "assets/cards/commission-goodies.png"
    },{
        id: "echeancier",
        title: "Échéance à tenir",
        slug: "promotion-echeances",
        description: "Tenir les échéances, ne pas se laisser dépasser",
        content: "content/commission-echeancier.md",
        card: "assets/cards/commission-echeancier.png"
   }
        ]
    }
]
}, {
    id: "responsabilite",
    title: "Exercice des responsabilités",
    description: "S’engager, assumer, montrer l’exemple.",
    slug: "responsabilites",
    content: "content/responsabilites.md",
    card: "assets/cards/responsabilite.png",
    /* créer children par responsabilité */  
     children: [ {
        id: "magasinier",
        title: "Magasinier",
        slug: "responsabilite-magasinier",
        description: "Organiser, distribuer, contrôler",
        content: "content/responsabilite-magasinier.md",
        card: "assets/cards/responsabilite-magasinier.png"
    }, {
        id: "popotier",
        title: "Popotier",
        slug: "responsabilite-popotier",
        description: "Achat, distribution, cohésion",
        content: "content/responsabilite-popotier.md",
        card: "assets/cards/responsabilite-popotier.png"
    }, {
        id: "secouriste",
        title: "Secouriste",
        slug: "responsabilite-secouriste",
        description: "Assurer les premiers secours, traiter les blessures superficielles",
        content: "content/responsabilite-secouriste.md",
        card: "assets/cards/responsabilite-secouriste.png"
    }, {
        id: "tam",
        title: "Tir Armement Munition",
        slug: "responsabilite-tam",
        description: "Gestion de l'intendance des séances de tir",
        content: "content/responsabilite-tam.md",
        card: "assets/cards/responsabilite-tam.png"
    }, {
        id: "vaguemestre",
        title: "Vaguemestre",
        slug: "responsabilite-vaguemestre",
        description: "Courrier et réception de colis",
        content: "content/responsabilite-vaguemestre.md",
        card: "assets/cards/responsabilite-vaguemestre.png"
    }, {
        id: "tri",
        title: "Tri sélectif",
        slug: "responsabilite-tri",
        description: "Faire assurer le tri des déchets et contrôler",
        content: "content/responsabilite-tri.md",
        card: "assets/cards/responsabilite-tri.png"
    } ]
}, 
    {
    id: "consignes",
    title: "Consignes élèves de jour",
    description: "Organisation, rigueur et transmission des consignes.",
    slug: "consignes",
    card: "assets/cards/consignes.png",
    /* children par elves de jour, MDL BRI Peloton */
    children: [ {
        id: "mdl",
        title: "Elèves de jour compagnie : MDL et BRI",
        slug: "consignes-mdl",
        description: "Responsabilité, organisation, discipline de la compagnie",
        content: "content/consignes-mdl.md",
        card: "assets/cards/consignes-mdl.png"
    }, {
        id: "peloton",
        title: "Élèves de jour peloton",
        slug: "consignes-peloton",
        description: "Responsabilité, discipline du peloton",
        content: "content/consignes-eleve-peloton.md",
        card: "assets/cards/consignes-eleve-peloton.png"
    } ]      
}, {
    id: "faq",
    title: "FAQ",
    description: "Réponses aux questions fréquentes.",
    slug: "faq",
    card: "assets/cards/faq.png",
    /* créer children par thème : formation, fin de promotion, vie de l'unité */      
    children: [ {
        id: "formation",
        title: "Déroulé de la formation",
        slug: "faq-formation",
        description: "Cours, entraînement physique, matériel pédagogique",
        content: "content/faq-formation.md",
        card: "assets/cards/faq-formation.png"
    }, {
        id: "matériel",
        title: "Matériel et tenue",
        slug: "faq-materiel",
        description: "Question relative au matériel et au tenue",
        content: "content/faq-materiel.md",
        card: "assets/cards/faq-materiel.png"
    },{
        id: "compagnie",
        title: "Conditions de vie dans la compagnie",
        slug: "faq-compagnie",
        description: "Entretien, rangement, conditions de vie",
        content: "content/faq-compagnie.md",
        card: "assets/cards/faq-compagnie.png"
    },{
        id: "sortie",
        title: "Le grand départ",
        slug: "faq-sortie",
        description: "Cérémonies, gala, départ, mutation",
        content: "content/faq-sortie.md",
        card: "assets/cards/faq-sortie.png"
    } ]     
}, {
    id: "SIF",
    title: "SIF",
    description: "Participer au fonctionnement quotidien de l'école avec rigueur et esprit de service.",
    slug: "sif",
    card: "assets/cards/S-sif.png",
    children: [ {
        id: "Poste",
        title: "Poste sécurité",
        description: "Accueil, surveillance et transmissions.",
        slug: "sif-poste",
        content: "content/sif/poste.md",
        card: "assets/cards/sif_poste.png"
    }, {
        id: "MESS",
        title: "Mess",
        description: "Service au mess.",
        slug: "sif-mess",
        content: "content/sif/mess.md",
        card: "assets/cards/sif_mess.png"
    }, {
        id: "Nettoyage",
        title: "Nettoyage",
        description: "Nettoyage des salles de cours, amphithéâtre et gymnase.",
        slug: "sif-nettoyage",
        content: "content/sif/nettoyage.md",
        card: "assets/cards/sif_nettoyage.png"
    }, {
        id: "Plastrons",
        title: "Plastrons",
        description: "Missions des plastrons et règles de sécurité.",
        slug: "sif-plastrons",
        content: "content/sif/plastrons.md",
        card: "assets/cards/sif_plastrons.png"
    }, {
        id: "Chauffeurs",
        title: "Chauffeurs",
        description: "Consignes des chauffeurs de permanence.",
        slug: "sif-chauffeurs",
        content: "content/sif/chauffeurs.md",
        card: "assets/cards/sif_chauffeurs.png"
    }, {
        id: "Poubelles",
        title: "Poubelles",
        description: "Collecte, tri et acheminement des déchets.",
        slug: "sif-poubelles",
        content: "content/sif/poubelles.md",
        card: "assets/cards/sif_poubelles.png"
    } ]
} ];
