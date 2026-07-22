window.CI6_RUBRIQUES = [ 
/* Les commentaires s'écrivent entre slash étoile et étoile slash. Ils sont ignorés par le navigateur. */

/* Pour désactiver temporairement une règle ou un bloc de code ( compris entre { et } )
   (sans le supprimer), il suffit de l'entourer d'un commentaire. */

	/*****************************************************************************************/
	/********************************** LIVRET D'ACCUEIL *************************************/
	/*****************************************************************************************/

	{
    id: "accueil",
    title: "Livret d'accueil",
    description: "Toutes informations utiles avant l'incorporation.",
    slug: "livret-accueil",
    card: "assets/cards/accueil.png",
    children: [ 
		/* MOT DU CDU */
		{
        id: "cdu",
        title: "Mot du CDU",
        slug: "accueil-cdu",
        description: "Mot du commandant de la 6ème compagnie",
        content: "content/accueil-cdu.md",
        card: "assets/cards/accueil_cdu.png"
    }, 
		/* PRÉSENTATION DE LA VILLE DE MONTLUCON */
	    {
        id: "montlucon",
        title: "Montluçon, la ville",
        slug: "accueil-montlucon",
        description: "Vivre sa scolarité dans la ville de Montluçon",
        content: "content/accueil-montlucon.md",
        card: "assets/cards/accueil_montlucon.png"
    }, 
		/* PRÉSENTATION DE L'ÉCOLE ET SES SERVICES SANS LES DÉTAILLER */
		{
      id: "ecole",
        title: "L'école de gendarmerie",
        slug: "accueil-ecole-gendarmerie-montlucon",
        description: "L'école de gendarmerie de Montluçon",
        content: "content/accueil-ecole.md",
        card: "assets/cards/accueil_ecole.png"
    }, 
		/* PRÉSENTATION DE LA COMPAGNIE AU SEIN DE L'ÉCOLE */
		{
      id: "compagnie",
        title: "La 6ème compagnie",
        slug: "accueil-compagnie",
        description: "La 6ème compagnie d'instruction",
        content: "content/accueil-compagnie.md",
        card: "assets/cards/accueil_compagnie.png"
    }, 
		/* LISTE DU MATÉRIEL OBLIGATOIRE ET CONSEILLÉ */
		{
      id: "fournitures",
        title: "Que doit-on apporter ?",
        slug: "accueil-fournitures",
        description: "Liste des fournitures utiles, optionnelles ou nécessaires à emporter",
        content: "content/accueil-fournitures.md",
        card: "assets/cards/accueil_fournitures.png"
    }, 
		/* COMMENT SE RENDRE À L'ÉCOLE, TRAIN, COVOITURAGE */
		{
      id: "transport",
        title: "Comment se rendre à Montluçon ?",
        slug: "accueil-transports",
        description: "Comment se rendre à Montluçon",
        content: "content/accueil-transport.md",
        card: "assets/cards/accueil_transport.png"
    }, 
		/* PRÉSENTATION RAPIDE DES ROLES, FONCTIONS ET RESPONSABILITÉS POUR LESQUELLES LES EG DEVRONT SE PORTER VOLONTAIRES */
		{
      id: "roles",
        title: "Les fonctions et responsabilités",
        slug: "accueil-fournitures",
        description: "Les responsabilités ne se subissent pas, elles se prennent. Être volontaire, c'est choisir de servir avant de se servir.",
        content: "content/accueil-roles.md",
        card: "assets/cards/accueil_roles.png"
    } ]
}, 
    /*****************************************************************************************/
	/************************** RÈGLEMENT INTÉRIEUR DE LA COMPAGNE ***************************/
	/*****************************************************************************************/

	{ 
    id: "reglement",
    title: "Règlement intérieur",
    description: "Les règles essentielles de vie, de discipline et d'organisation de la compagnie.",
    slug: "reglement",
    card: "assets/cards/reglement.png",
    children: [ 

		/* LES DÉPLACEMENTS */
		{
   	 id: "deplacement",
  	 title: "1 - Les déplacements",
  	  description: "Les déplacement doivent refléter la discipline militaire par un ordre serré, une attitude exemplaire et une parfaite cohésion.",
 	  slug: "reglement-deplacement",
 	  content: "content/reglement-deplacement.md",
  	  card: "assets/cards/reglement-deplacement.png"
  	  },
  	  /* LES HORAIRES D'UNE JOURNÉE TYPE + VENDREDIS */
		{
   	  id: "horaires",
  	  title: "2 - Les horaires",
  	  description: "La ponctualité est la première marque de respect.",
 	  slug: "reglement-horaires",
 	  content: "content/reglement-horaires.md",
  	  card: "assets/cards/reglement-horaires.png"
  	  },
		/* DESCRIPTION ET PORT DES TENUES */
		{
          id: "tenue",
          title: "3 - Port de la tenue",
          slug: "reglement-tenue",
          description: "Porter la tenue réglementaire",
          content: "content/reglement-tenue.md",
          card: "assets/cards/reglement-tenue.png"
    	  },
    	/* RÈGLES DE SALUT ET DE PRÉSENTATION - EN ET HORS CASERNE */  
		{
          id: "presentation",
          title: "4 - Saluer, se présenter",
          slug: "reglement-presentation",
          description: "Le salut militaire est une marque de respect, de discipline et de courtoisie. La présentation est le reflet de votre discipline et de votre professionnalisme.",
          content: "content/reglement-presentation.md",
          card: "assets/cards/reglement-presentation.png"
    	  },
		/* RÈGLES DE COMPORTEMENT À ADOPTER EN ET HORS CASERNE */
    	  {
          id: "comportement",
          title: "5 - Comportement individuel",
          slug: "reglement-comportement",
          description: "Le comportement doit être exemplaire en toutes circonstances, en service comme hors service, en caserne comme à l'extérieur.",
          content: "content/reglement-comportement.md",
          card: "assets/cards/reglement-comportement.png"
    	  },
		/* RÈGLES RELATIVES À LA MIXITÉ */
    	  {
          id: "mixité",
          title: "6 - La mixité",
          slug: "reglement-comportement",
          description: "La mixité s'inscrit dans les exigences de la vie collective. Elle nécessite une attitude exemplaire, des propos respectueux et le respect strict des espaces réservés à chacun.",
          content: "content/reglement-mixite.md",
          card: "assets/cards/reglement-mixite.png"
    	  },
    	/* USAGE DU TÉLÉPHONE, SEMAINE BLANCHE, REMISE ET PERCEPTION */ 
		{
  	 	 id: "telephone",
  		  title: "7 - Utilisation du téléphone",
 		  description: "Un outil utile, jamais une distraction.",
 		  slug: "reglement-telephone",
		  content: "content/reglement-telephone.md",
 		  card: "assets/cards/reglement-telephone.png"
		  }, 
    	/* RÈGLES D'USAGE DE LA CIGARETTE */ 
		{
  		  id: "cigarette",
  		  title: "8 - Usage de la cigarette",
 		  description: "Fumer ou vapoter implique le respect des règles de la compagnie, des autres élèves et des zones spécialement aménagées.",
 		  slug: "reglement-cigarette",
		  content: "content/reglement-cigarette.md",
 		  card: "assets/cards/reglement-cigarette.png"
		  } ] 
},
   /*****************************************************************************************/
	/****************** PRÉSENTATION DES LOCAUX DE LA 6 ME COMPAGNE ET TIG ******************/
	/*****************************************************************************************/
	{
    id: "locaux",
    title: "Les locaux de la compagnie",
    description: "L'état des locaux est le miroir de ceux qui les occupent.",
    slug: "utilisation-entretien-locaux",
    card: "assets/cards/index-locaux.png",
    children: [ 
		/* ACCÈS AUTORISÉS ET INTERDITS */
		{
        id: "circulation",
        title: "Usage des locaux, circulation",
        slug: "locaux-usage-circulation",
        description: "Usage des locaux et circulation",
        content: "content/locaux-circulation.md",
        card: "assets/cards/locaux-circulation.png"
    }, 
		/* CONSIGNES TIG ET TOURS DE ROTATION */
		{
        id: "tig",
        title: "Travaux d'intérêt général",
        slug: "locaux-tig",
        description: "Entretenir son lieu de vie.",
        content: "content/locaux-tig.md",
        card: "assets/cards/locaux-tig.png"
    } ]
}, 
   /*****************************************************************************************/
	/***************** PRÉSENTATION DU CERCLE MIXTE ET DE SES SERVICES **********************/
	/*****************************************************************************************/
	{
    id: "cercle",
    title: "Le cercle mixte",
    description: "Restauration, détente et convivialité.",
    slug: "cercle-mixte",
    card: "assets/cards/index-cercle-mixte.png",
    children: [ 
		/* il manque le comptoire des ventes *************************************************/
		
		/* LE MESS - PASS MESS - COMPORTEMENT - CARTE MESS */
		{
        id: "mess",
        title: "Service du mess",
        slug: "cercle-mixte-mess",
        description: "La restauration au quotidien.",
        content: "content/cercle-mess.md",
        card: "assets/cards/cercle-mess.png"
    }, 
		/* PRÉSENTATION DE L'ESPACE DÉTENTE ET CONDITIONS D'ACCÈS */
		{
        id: "bar",
        title: "Espace détente",
        slug: "cercle-mixte-bar-detente",
        description: "Lieu de détente et de cohésion.",
        content: "content/cercle-detente.md",
        card: "assets/cards/cercle-detente.png"
    },
		/* SALON DE COIFFURE DE L'ÉCOLE */
		{
        id: "coiffeuse",
        title: "Salon de coiffure",
        slug: "cercle-mixte-coiffure",
        description: "Un service de coiffure adapté aux exigences de l'école.",
        content: "content/cercle-coiffeuse.md",
        card: "assets/cards/cercle-coiffeuse.png"
    },
		/* COMPTOIR DES VENTES */
		{
        id: "comptoir",
        title: "Comptoir des ventes",
        slug: "cercle-comptoir-vente",
        description: "La boutique de l'école, tenues, nécessaires, cadeaux.",
        content: "content/cercle-comptoir.md",
        card: "assets/cards/cercle-comptoir.png"
    },
		/* HOTEL COUTELOT - RÉSERATION PAR LES ÉLÈVES */
		{
        id: "cercle-hotel",
        title: "Hôtel Couletot",
        slug: "cercle-hotel",
        description: "Un hébergement pratique pour vos familles et visiteurs.",
        content: "content/cercle-hotel.md",
        card: "assets/cards/cercle-hotel.png"
    } ]
}, 
	/*****************************************************************************************/
	/****************************** LA VIE EN COLLECTIVITÉ ***********************************/
	/*****************************************************************************************/
	{
    id: "collectivite",
    title: "Vivre en collectivité",
    description: "Camaraderie, cohésion et respect mutuel.",
    slug: "vivre-collectivite",
    card: "assets/cards/collectivite.png",
    children: [ 
		/* HYGIÈNE */
		{
        id: "hyg",
        title: "Hygiène",
        slug: "collectivite-hygiene",
        description: "L'hygiène est essentielle en collectivité",
        content: "content/collectivite-hygiene.md",
        card: "assets/cards/collectivite-hygiene.png"
    }, 
		/* RESPECT D'AUTRUI - EXPRESSION - COMPORTEMENT */
		{
        id: "res",
        title: "Respect d'autrui",
        slug: "collectivite-respect",
        description: "Favoriser une cohabitation harmonieuse entre camarades.",
        content: "content/collectivite-respect.md",
        card: "assets/cards/collectivite-respect.png"
    },
		/* HORAIRES EXTINCTION DES FEUX - SILENCE ÉTUDES */
		{
        id: "sil",
        title: "Silence",
        slug: "collectivite-silence-extinction-feux",
        description: "Le silence est une marque de considération envers tous.",
        content: "content/collectivite-silence.md",
        card: "assets/cards/collectivite-silence.png"
    } ]
}, 
	/*****************************************************************************************/
	/********** PRÉPARATION ET ENTRETIEN DU MATÉRIEL INDIVIDUEL OU COLLECTIF *****************/
	/*****************************************************************************************/
	{
    id: "materiel",
    title: "Préparer et respecter le matériel",
    description: "Un matériel prêt, contrôlé et entretenu est le gage d'une mission réussie.",
    slug: "materiel",
    card: "assets/cards/materiel.png",
    children: [ 
		/* MATÉRIEL INDIVIDUEL PERCU À LA COMPAGNIE */
		{
        id: "individuel",
        title: "Individuel",
        slug: "materiel-individuel",
        description: "Perception et entretien du matériel individuel fourni par la compagnie",
        content: "content/materiel-individuel.md",
        card: "assets/cards/materiel-individuel.png"
    }, 
		/* ARMEMENT INDIVIDUEL - PACK ARMEMENT - ARMEMENT COLLECTIF */
		{
        id: "armement",
        title: "matériel et armement compagnie",
        slug: "materiel-armement",
        description: "Perception et entretien de l'armement individuel ou collectif de la compagnie.",
        content: "content/materiel-armement.md",
        card: "assets/cards/materiel-armement.png"
    },
		/* PERCEPTION ET ENTRETIEN DU MATÉRIEL PRÊTÉ (MO, IT ...) */
		{
        id: "pret",
        title: "matériel en prêt pour l'instruction",
        slug: "materiel-pret",
        description: "Perception et entretien de l'armement individuel ou collectif prêté par les services.",
        content: "content/materiel-pret.md",
        card: "assets/cards/materiel-pret.png"
    },
		/* LISTE DU MATÉRIEL, ÉQUIPEMENT, TENUE PRÉCONISÉS PAR LES SECTIONS */
		{
        id: "section",
        title: "matériel demandé par les sections",
        slug: "materiel-section",
        description: "Connaître le matériel à emporter pour les cours donnés par les sections",
        content: "content/materiel-section.md",
        card: "assets/cards/materiel-section.png"
    } ]
}, 
	/*****************************************************************************************/
	/********************************** LA FORMATION *****************************************/
	/*****************************************************************************************/
	{
    id: "formation",
    title: "S’investir dans sa formation",
    description: "Apprendre, progresser, réussir.",
    slug: "formation",
    card: "assets/cards/formation.png",
    children: [ 
		/* ÉTUDE OBLIGATOIRE ET PRATIQUE DU SPORT */
		{
        id: "etude",
        title: "Etude et révision au quotidien.",
        slug: "formation-etude",
        description: "Organiser son temps de révision",
        content: "content/formation-etude.md",
        card: "assets/cards/formation-etude.png"
    }, 
		/* RÉUSSIR SA FORMATION - PRÉPARER LES COURS - ETRE VOLONTAIRE */
		{
        id: "reussir",
        title: "Réussir sa formation",
        slug: "formation-reussir",
        description: "Que faire pour réussir au mieux sa formation",
        content: "content/formation-reussir.md",
        card: "assets/cards/formation-reussir.png"
    },
		/* ENTRAINEMENT SPORTIF INDIVIDUEL - CSLG - ÉQUIPEMENTS À DISPOSITION */
		{
        id: "sport",
        title: "Entraînement physique",
        slug: "formation-entrainement-physique",
        description: "S'entraîner pour ne pas subir",
        content: "content/formation-sport.md",
        card: "assets/cards/formation-sport.png"
    },  
		/* PROGRAMME DE LA FORMATION - BARÊME ET CALCUL DES MOYENNES - PRÉSENTATION NA ? */
		{
        id: "examen",
        title: "Programme et examens.",
        slug: "formation-reussir",
        description: "Que faire pour réussir au mieux sa formation",
        content: "content/formation-examen.md",
        card: "assets/cards/formation-examen.png"
    } ]
}, 
	/*****************************************************************************************/
	/********************** VOIE HIÉRARCHIQUE ET COMPTE RENDU ********************************/
	/*****************************************************************************************/
	{
    id: "vh",
    title: "VH et compte rendu",
    description: "Savoir à qui s'adresser, rendre compte utilement.",
    slug: "vh-compte-rendu",
    card: "assets/cards/vh.png",
    children: [ 
		/* PRÉSENTATION DES CADRES */
		{
        id: "cadres",
        title: "Les cadres de la compagnie",
        slug: "vh-cadres",
        description: "Connaître le rôle des cadres",
        content: "content/vh-cadres.md",
        card: "assets/cards/vh-cadres.png"
    }, 
		/* HIÉRARCHIE COMPAGNIE ET AU SEIN DE L'ÉCOLE */
		{
        id: "hierarchie",
        title: "Voie hiérarchique",
        slug: "vh-voie-hierarchique",
        description: "Connaître l'organisation hiérarchique de la compagnie",
        content: "content/vh-vh.md",
        card: "assets/cards/vh-vh.png"
    },
		/* LE COMPTE RENDU */
		{
        id: "compte-rendu",
        title: "Compte rendu",
        slug: "vh-compte-rendu-cr",
        description: "Savoir rendre compte",
        content: "content/vh-cr.md",
        card: "assets/cards/vh-cr.png"
    } ]
}, 
	/*****************************************************************************************/
	/************************************ SÉCURITÉ *******************************************/
	/*****************************************************************************************/
	{
    id: "securite",
    title: "Sécurité",
    description: "La sécurité de tous passe par la vigilance de chacun.",
    slug: "securite",
    card: "assets/cards/securite.png",
    children: [ 
		/* SÉCURITÉ DE L'ARMEMENT - USAGE ET STOCKAGE - RÉINTÉGRATION WEEK END */
		{
        id: "armement",
        title: "Armement et matériel sensible",
        slug: "securite-armement",
        description: "Les règles de sécurité des l'armement",
        content: "content/securite-armement.md",
        card: "assets/cards/securite-armement.png"
    },
		/* SÉCURITÉ DES MOYENS INFORMATIQUES ET NEO */
		{
        id: "ssi",
        title: "Systèmes d'information",
        slug: "securite-ssi",
        description: "Les règles de sécurité des systèmes d'information",
        content: "content/securite-ssi.md",
        card: "assets/cards/securite-ssi.png"
    },
		/* MATÉRIELS ÉLECTRIQUES AUTORISÉS OU INTEDITS ET BRANCHEMENT DANS LES MODULES */
		{
        id: "appareils",
        title: "Branchements électriques",
        slug: "securite-appareils",
        description: "Connaître les règles de sécurité électrique",
        content: "content/securite-appareils.md",
        card: "assets/cards/securite-appareils.png"
    }, 
		/* SÉCURITÉ INCENDIE */
		{
        id: "incendie",
        title: "Sécurité incendie",
        slug: "securite-incendie",
        description: "Savoir utiliser le SSI de la compagnie",
        content: "content/securite-incendie.md",
        card: "assets/cards/securite-incendie.png"
    },
		/* ÉVACUATION COMPAGNIE */
		{
        id: "evacuation",
        title: "Évacuation incendie",
        slug: "securite-evacuation",
        description: "Consignes de sécurité et d'évacuation en cas d'incendie",
        content: "content/securite-evacuation.md",
        card: "assets/cards/securite-evacuation.png"
    } ]
}, 
	
	/*****************************************************************************************/
	/************************ DERNIÈRES INFOS ET DOCUMENTS UTILES ****************************/
	/*****************************************************************************************/
	{
    id: "news",
    title: "Dernières infos et documents utiles",
    description: "Retrouver rapidement les informations et supports utiles.",
    slug: "documents-utiles",
    content: "content/news.md",
    card: "assets/cards/news.png"
}, 
	/*****************************************************************************************/
	/*********************** PRÉSENTATION DES SERVICES DE L'ÉCOLE ****************************/
	/*****************************************************************************************/
	{
    id: "services",
    title: "Services de l’école",
    description: "Identifier les ressources utiles au quotidien.",
    slug: "services-ecole",
    card: "assets/cards/services.png",
    children: [ 
	/**********************IL MANQUE SPPE ********************/
		{
        /* BUREAU DE GESTION DES PERSONNELS - ÉLÈVES EN FORMATION */
			id: "service-bgp",
        title: "BGP",
        slug: "service-bgp",
        description: "Bureau de gestion du personnel",
        content: "content/service-bgp.md",
        card: "assets/cards/service-bgp.png"
    }, 
		{
        /* SECTION PLANIFICATION PROGRAMMATION EXAMEN */
		id: "service-sppe",
        title: "SPPE",
        slug: "service-sppe",
        description: "SECTION PLANIFICATION PROGRAMMATION EXAMEN",
        content: "content/service-sppe.md",
        card: "assets/cards/service-sppe.png"
    }, 
		/* CELLULE DIFFUSION */
		{
        id: "diffusion",
        title: "Cellule Diffusion",
        slug: "service-diffusion",
        description: "Reproduction d'affiches, documents, photographies et graphismes",
        content: "content/service-diffusion.md",
        card: "assets/cards/service-diffusion.png"
    }, 
		/* DÉTACHEMENT DU SERVICE OPÉRATIONNEL DE LUTTE CONTRE LA CYBERCRIMINALITÉ */
		{
        id: "service-dsolc",
        title: "DSOLC",
        slug: "service-dsolc",
        description: "Dépannage informatique, radio et Néogend",
        content: "content/service-dsolc.md",
        card: "assets/cards/service-dsolc.png"
    }, 
		/* HOTEL COUTELOT, SUCCINCT, RENVOYER VERS CERCLE MIXTE VOIRE LE SUPPRIMER D'ICI */
		{
        id: "service-hotel",
        title: "Hôtel Coutelot",
        slug: "service-hotel",
        description: "Réservation de chambre, hôtel Coutelot",
        content: "content/service-hotel.md",
        card: "assets/cards/service-hotel.png"
    }, 
		/* VAGUEMESTRE */
		{
        id: "service-vaguemestre",
        title: "Vaguemestre",
        slug: "service-vaguemestre",
        description: "Courrier et réception de colis",
        content: "content/service-vaguemestre.md",
        card: "assets/cards/service-vaguemestre.png"
    }, 
		/* ANTENNE MÉDICALE - RDV - CR - IRC */
		{
        id: "service-amg",
        title: "Antenne médicale",
        slug: "service-amg",
        description: "Visite périodique et consultation médicale",
        content: "content/service-amg.md",
        card: "assets/cards/service-amg.png"
    },
		/* SERVICE HABILLEMENT */
		{
        id: "habillement",
        title: "Service Habillement",
        slug: "service-habillement",
        description: "Essayage, commande et livraison d'effets militaires",
        content: "content/service-habillement.md",
        card: "assets/cards/service-habillement.png"
    } ]
}, 
	/*****************************************************************************************/
	/**************************************** LA PROMOTION ***********************************/
	/*****************************************************************************************/
	{
    id: "promotion",
    title: "Vie de la promotion",
    description: "Traditions, cohésion et esprit de promotion.",
    slug: "promotion",
    card: "assets/cards/promotion.png",
    children: [ 
		/* BUREAU PROMO */
		{
        id: "bureau",
        title: "Bureau promotion",
        slug: "promotion-bureau",
        description: "Constitution du bureau promotion et rôles",
        content: "content/promotion-bureau.md",
        card: "assets/cards/promotion_bureau.png"
    }, 
		/* LA TRADITION AU SEIN DE L'ÉCOLE */
		{
        id: "tradition",
        title: "Tradition militaire en école",
        slug: "promotion-tradition",
        description: "La tradition au sein de l'école",
        content: "content/promotion-tradition.md",
        card: "assets/cards/promotion-tradition.png"
    }, 
		/* LES COMMISSIONS */
		{
        id: "commission",
        title: "Les commissions",
        slug: "promotion-commission",
        description: "Constitution des commissions et attendus",
        card: "assets/cards/promotion_commissions.png",
        children: [ 
		/* COMMISSION PARRAIN */
			{
        id: "parrain",
        title: "parrain",
        slug: "commission-parrain",
        description: "Recherches sur la vie, la carrière, la famille du parrain et organisation de l'hommage.",
        content: "content/commission-parrain.md",
        card: "assets/cards/commission-parrain.png"
 	   }, 
		/* COMMISSION GALA - TRAITEUR - DECO - ANIMATION */	
			{
        id: "gala",
        title: "Gala",
        slug: "commission-gala",
        description: "Organisation de la soirée de gala, choix de salle, de traiteur, des animations",
        content: "content/commission-gala.md",
        card: "assets/cards/commission-gala.png"
 	   }, 
			/* COMMISSION RENDEZ-VOUS TRADITION */
			{
        id: "rdv",
        title: "rendez-vous tradition",
        slug: "commission-rdv",
        description: "Organiser les sorties tradition",
        content: "content/commission-rdv.md",
        card: "assets/cards/commission-rdv.png"
 		}, 
			/* COMMISSION DÉFI SOCIAL */
			{
        id: "defi",
        title: "défi social",
        slug: "commission-defi",
        description: "Choisir une association à soutenir et organiser le défi social",
        content: "content/commission-defi.md",
        card: "assets/cards/commission-defi.png"
	    }, 
			/* COMMISSION COMMUNICATION */
			{
        id: "communication",
        title: "communication",
        slug: "commission-communication",
        description: "Développer les outils de communication et promouvoir les activités de la promotion.",
        content: "content/commission-communication.md",
        card: "assets/cards/commission-communication.png"
	    }, 
			/* COMMISSION CHANT PARRAIN */
			{
        id: "chant",
        title: "Chant parrain",
        slug: "commission-chant",
        description: "Créer parole et musique pour un chant parrain",
        content: "content/commission-chant.md",
        card: "assets/cards/commission-chant.png"
	    }, 
			/* COMMISSION STE GENEVIEVE - CONSTITUTION DES ÉQUIPES - ANIMATION */
			{
        id: "genevieve",
        title: "Sainte Geneviève",
        slug: "commission-genevieve",
        description: "Organiser la participation de la promotion aux compétitions de la Sainte-Geneviève : constitution des équipes, coordination logistique et animation des groupes de supporters.",
        content: "content/commission-genevieve.md",
        card: "assets/cards/commission-genevieve.png"
	    }, 
			/* COMMISSION CÉRÉMONIE RELIGIEUSE */
			{
        id: "messe",
        title: "Cérémonie religieuse",
        slug: "commission-messe",
        description: "Préparation de la cérémonie religieuse de fin de promotion",
        content: "content/commission-messe.md",
        card: "assets/cards/commission-messe.png"
	    }, 
			/* COMMISSION PARTENARIAT AVEC LES COMMUNES */
			{
        id: "communes",
        title: "Partenariat communes",
        slug: "commission-communes",
        description: "Proposer des actions avec les municipalités partenaires",
        content: "content/commission-communes.md",
        card: "assets/cards/commission-communes.png"
	    }, 
			/* COMMISSION CLASSE DÉFENSE PAUL CONSTANS */
			{
        id: "defense",
        title: "Partenariat classe défense",
        slug: "commission-defense",
        description: "Proposer des actions avec les lycées de la classe défense",
        content: "content/commission-defense.md",
        card: "assets/cards/commission-defense.png"
	    }, 
			/* COMMISSION DESIGN ET CRÉATION ARTISTIQUE */
			{
        id: "design",
        title: "design",
        slug: "commission-design",
        description: "Créer les symboles et les supports graphiques de la promotion.",
        content: "content/commission-design.md",
        card: "assets/cards/commission-design.png"
	    }, 
			/* COMMISSION GOODIES */
			{
        id: "goodies",
        title: "goodies",
        slug: "commission-goodies",
        description: "Conception, achat et vente des goodies de la promotion et de l'association.",
        content: "content/commission-goodies.md",
        card: "assets/cards/commission-goodies.png"
	    } ]
	}, 
		/* ÉCHÉANCIER POUR NE RIEN LOUPER */
		{
        id: "echeancier",
        title: "Échéances à tenir",
        slug: "promotion-echeances",
        description: "Anticiper chaque échéance afin de ne rien manquer.",
        content: "content/promotion-echeancier.md",
        card: "assets/cards/promotion_echeancier.png"
 		}
    ]
}, 
	/*****************************************************************************************/
	/********************* RESPONSABILITÉS - PRÉSENTATION ET CONSIGNES ***********************/
	/*****************************************************************************************/
	{
    id: "responsabilite",
    title: "Consignes pour l'exercice des responsabilités.",
    description: "S’engager, assumer, montrer l’exemple.",
    slug: "responsabilites",
    card: "assets/cards/responsabilite.png",
     children: [ 
		 /* MAGASINIER */
		 {
        id: "magasinier",
        title: "Magasinier",
        slug: "responsabilite-magasinier",
        description: "Organiser, distribuer, contrôler",
        content: "content/responsabilite-magasinier.md",
        card: "assets/cards/responsabilite-magasinier.png"
    }, 
		 /* POPOTIER */
		 {
        id: "popotier",
        title: "Popotier",
        slug: "responsabilite-popotier",
        description: "Contribuer au moral et à la cohésion du peloton.",
        content: "content/responsabilite-popotier.md",
        card: "assets/cards/responsabilite-popotier.png"
    }, 
		 /* SECOURISTES */
		 {
        id: "secouriste",
        title: "Secouriste",
        slug: "responsabilite-secouriste",
        description: "Apporter les premiers soins avant la prise en charge médicale.",
        content: "content/responsabilite-secouriste.md",
        card: "assets/cards/responsabilite-secouriste.png"
    }, 
		 /* TAM */
		 {
        id: "tam",
        title: "Tir Armement Munition",
        slug: "responsabilite-tam",
        description: "Une mission exigeante qui requiert rigueur, organisation et sens des responsabilités pour assurer la gestion complète de l'armement d'instruction.",
        content: "content/responsabilite-tam.md",
        card: "assets/cards/responsabilite-tam.png"
    }, 
		 /* VAGUEMESTRE */
		 {
        id: "responsabiite-vaguemestre",
        title: "Vaguemestre compagnie",
        slug: "responsabilite-vaguemestre",
        description: "Assurer la réception et la distribution du courrier et des colis.",
        content: "content/responsabilite-vaguemestre.md",
        card: "assets/cards/responsabilite-vaguemestre.png"
    }, 
		 /* TRI DES ORDURES */
		 {
        id: "tri",
        title: "Tri sélectif",
        slug: "responsabilite-tri",
        description: "Sensibiliser et veiller au bon tri des déchets par l'ensemble des élèves.",
        content: "content/responsabilite-tri.md",
        card: "assets/cards/responsabilite-tri.png"
    } ]
}, 
    /*****************************************************************************************/
	/***************************** CONSIGNES ÉLÈVES DE JOUR **********************************/
	/*****************************************************************************************/
	{
    id: "consignes",
    title: "Consignes élèves de jour",
    description: "Organisation, rigueur et transmission des consignes.",
    slug: "consignes",
    card: "assets/cards/consignes.png",
    children: [ 
		/* CONSIGNES MDR ET BRI */
		{
        id: "mdl",
        title: "Élèves de jour compagnie : MDL et BRI",
        slug: "consignes-mdl",
        description: "Assurer la continuité du commandement et le bon ordre de la compagnie.",
        content: "content/consignes-mdl.md",
        card: "assets/cards/consignes-mdl.png"
    }, 
		/* CONSIGNES ÉLÈVES DE JOUR PELOTON */
		{
        id: "peloton",
        title: "Élèves de jour peloton",
        slug: "consignes-peloton",
        description: "Veiller à la ponctualité, à la présentation et au bon ordre du peloton.",
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
        id: "faq-formation",
        title: "Déroulé de la formation",
        slug: "faq-formation",
        description: "Cours, entraînement physique, matériel pédagogique",
        content: "content/faq-formation.md",
        card: "assets/cards/faq-formation.png"
    }, {
        id: "faq-materiel",
        title: "Matériel et tenue",
        slug: "faq-materiel",
        description: "Question relative au matériel et à la tenue",
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
}, 
	/*****************************************************************************************/
	/******************************** CONSIGNES SIF *****************************************/
	/*****************************************************************************************/
	{
    id: "sif",
    title: "SIF",
    description: "Participer au fonctionnement quotidien de l'école avec rigueur et esprit de service.",
    slug: "sif",
    card: "assets/cards/S-sif.png",
    children: [ 
		/* POSTE DE SÉCURITÉ */
		{
        id: "poste",
        title: "Poste sécurité",
        description: "Accueil, surveillance et transmissions.",
        slug: "sif-poste",
        content: "content/sif-poste.md",
        card: "assets/cards/sif_poste.png"
    }, 
		/* MESS */
		{
        id: "sif-mess",
        title: "Mess",
        description: "Service au mess.",
        slug: "sif-mess",
        content: "content/sif-mess.md",
        card: "assets/cards/sif_mess.png"
    }, 
		/* NETTOYAGE BATIMENT, SALLES D'INSTRUCTIONS, AMPHI */
		{
        id: "Nettoyage",
        title: "Nettoyage",
        description: "Nettoyage des salles de cours, amphithéâtre et gymnase.",
        slug: "sif-nettoyage",
        content: "content/sif-nettoyage.md",
        card: "assets/cards/sif_nettoyage.png"
    }, 
		/* CONSIGNES PLASTRONS */
		{
        id: "Plastrons",
        title: "Plastrons",
        description: "Missions des plastrons et règles de sécurité.",
        slug: "sif-plastrons",
        content: "content/sif-plastrons.md",
        card: "assets/cards/sif_plastrons.png"
    }, 
		/* CHAUFFEURS DE PERMANENCE */
		{
        id: "Chauffeurs",
        title: "Chauffeurs",
        description: "Consignes des chauffeurs de permanence.",
        slug: "sif-chauffeurs",
        content: "content/sif-chauffeurs.md",
        card: "assets/cards/sif_chauffeurs.png"
    }, 
		/* RAMASSAGE DES POUBELLES DE L'ÉCOLE */
		{
        id: "Poubelles",
        title: "Poubelles",
        description: "Collecte, tri et acheminement des déchets.",
        slug: "sif-poubelles",
        content: "content/sif-poubelles.md",
        card: "assets/cards/sif_poubelles.png"
    } ]
} ];
