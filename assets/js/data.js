const RUBRIQUES = [
  {id:'horaires', n:1, icon:'⏱️', title:'Respecter les horaires', short:'Être ponctuel, c’est respecter les autres et la mission.'},
  {id:'tenue', n:2, icon:'🎖️', title:'Tenue et présentation', short:'Soigner son apparence, refléter le professionnalisme.'},
  {id:'locaux', n:3, icon:'🧹', title:'Entretenir les locaux', short:'Des locaux propres pour un environnement sain.'},
  {id:'materiel', n:4, icon:'🎒', title:'Préparer et respecter le matériel', short:'Un matériel prêt et entretenu pour être opérationnel.'},
  {id:'collectivite', n:5, icon:'👥', title:'Vivre en collectivité', short:'Respect, entraide et cohésion au quotidien.'},
  {id:'telephone', n:6, icon:'📵', title:'Utiliser le téléphone à bon escient', short:'Un outil utile, pas une distraction.'},
  {id:'formation', n:7, icon:'📖', title:'S’investir dans sa formation', short:'Être acteur de sa formation pour devenir gendarme.'},
  {id:'securite', n:8, icon:'🛡️', title:'Respecter les consignes de sécurité', short:'La sécurité de tous passe avant tout.'},
  {id:'valeurs', n:9, icon:'🔥', title:'Défendre les valeurs du gendarme', short:'Honneur, courage, intégrité, respect, loyauté, solidarité.'},
  {id:'mdl', n:10, icon:'📋', title:'Consignes MDL et élèves de jour', short:'Rôles et missions pour garantir le bon fonctionnement.'},
  {id:'promotion', n:11, icon:'🐉', title:'Vie de la promotion', short:'Partage, traditions et esprit de promotion.'},
  {id:'responsabilites', n:12, icon:'⭐', title:'Exercice des responsabilités', short:'S’engager, assumer, donner l’exemple.'}
];

const DETAILS = {
  horaires: {
    objectif: 'Faire du respect des horaires un réflexe professionnel.',
    retenir: ['L’heure dite est l’heure faite.', 'Tout retard doit être anticipé et rendu compte.', 'La ponctualité protège le collectif.'],
    consignes: ['Consulter la programmation chaque soir.', 'Préparer tenue et matériel la veille.', 'Prévoir les déplacements internes avec marge.', 'Rendre compte immédiatement en cas de difficulté.'],
    vigilance: ['Retards répétés.', 'Mauvaise lecture de la programmation.', 'Préparation tardive du matériel.']
  },
  tenue: {
    objectif: 'Garantir une présentation conforme, sobre et professionnelle.',
    retenir: ['L’uniforme engage celui qui le porte.', 'La présentation reflète le sérieux.', 'Une tenue contrôlée évite les rappels.'],
    consignes: ['Tenue complète, propre et réglementaire.', 'Chaussures entretenues.', 'Effets préparés la veille.', 'Aspect général compatible avec l’exigence militaire.'],
    vigilance: ['Effets manquants.', 'Tenue non adaptée à l’activité.', 'Présentation négligée.']
  },
  locaux: {
    objectif: 'Maintenir les locaux propres, ordonnés et disponibles.',
    retenir: ['Une chambrée propre est le reflet d’un EG exemplaire.', 'Les espaces communs sont l’affaire de tous.', 'L’entretien est quotidien.'],
    consignes: ['Chambre rangée chaque jour.', 'Salle de bain entretenue.', 'TIG exécutés sérieusement.', 'Produits autorisés uniquement.'],
    vigilance: ['Accumulation de linge ou d’effets.', 'Sanitaires négligés.', 'Consignes TIG non respectées.']
  },
  materiel: {
    objectif: 'Préparer, préserver et contrôler le matériel confié.',
    retenir: ['Le matériel confié est une responsabilité.', 'Un matériel prêt évite l’improvisation.', 'Tout défaut doit être signalé.'],
    consignes: ['Vérifier son paquetage.', 'Entretenir les équipements.', 'Ne pas détériorer le matériel collectif.', 'Rendre compte des pertes ou anomalies.'],
    vigilance: ['Matériel absent au départ activité.', 'Dégradations non signalées.', 'Stockage inadapté.']
  },
  collectivite: {
    objectif: 'Développer une vie collective respectueuse et cohésive.',
    retenir: ['La cohésion commence par le respect.', 'La discrétion protège le collectif.', 'L’entraide n’exclut pas l’exigence.'],
    consignes: ['Respecter le silence et les autres.', 'Faire preuve de courtoisie.', 'Préserver les espaces communs.', 'Aider sans couvrir les manquements.'],
    vigilance: ['Bruit excessif.', 'Manque de discrétion.', 'Conflits non rendus compte.']
  },
  telephone: {
    objectif: 'Utiliser le téléphone sans nuire à la formation ni au collectif.',
    retenir: ['Le téléphone n’est pas une priorité.', 'La mission d’abord.', 'Les réseaux sociaux imposent de la prudence.'],
    consignes: ['Usage uniquement aux horaires et lieux autorisés.', 'Pas d’utilisation en cours ni en formation.', 'Respecter la discrétion professionnelle.', 'Ne pas diffuser de photos sans autorisation.'],
    vigilance: ['Consultation en formation.', 'Photos ou vidéos sensibles.', 'Usage perturbant le repos.']
  },
  formation: {
    objectif: 'Faire de chaque élève l’acteur principal de sa progression.',
    retenir: ['Aujourd’hui élève, demain gendarme.', 'La rigueur quotidienne construit la compétence.', 'La curiosité est une force.'],
    consignes: ['Préparer les cours.', 'S’investir dans les exercices.', 'Réviser régulièrement.', 'Demander de l’aide avant d’être en difficulté.'],
    vigilance: ['Passivité.', 'Retard dans les travaux.', 'Difficultés non signalées.']
  },
  securite: {
    objectif: 'Ancrer les réflexes de sécurité et de signalement.',
    retenir: ['La sécurité de tous dépend de chacun.', 'Un doute se signale.', 'Le SSI est contrôlé avec sérieux.'],
    consignes: ['Connaître les consignes incendie.', 'Contrôler les voyants selon les ordres.', 'Signaler toute anomalie.', 'Respecter les interdictions.'],
    vigilance: ['Contrôle SSI oublié.', 'Anomalie minimisée.', 'Objets interdits.']
  },
  valeurs: {
    objectif: 'Faire vivre les valeurs attendues d’un futur gendarme.',
    retenir: ['Plus qu’un statut : un engagement quotidien.', 'L’exemplarité se voit dans les détails.', 'Les valeurs se prouvent par les actes.'],
    consignes: ['Agir avec respect.', 'Faire preuve de loyauté.', 'Rester solidaire.', 'Assumer ses erreurs et rendre compte.'],
    vigilance: ['Manque de franchise.', 'Comportement individualiste.', 'Atteinte à l’image de l’institution.']
  },
  mdl: {
    objectif: 'Uniformiser les prises de service et les comptes rendus.',
    retenir: ['Le MDL structure le fonctionnement du peloton.', 'Les élèves de jour assurent la continuité.', 'La consigne claire évite l’erreur.'],
    consignes: ['Prise de service rigoureuse.', 'Contrôle des effectifs.', 'Contrôle SSI à 19 h selon consignes.', 'Préparation du service du lendemain.', 'Compte rendu aux cadres.'],
    vigilance: ['Consignes mal transmises.', 'Oubli SSI.', 'Service incomplet ou tardif.']
  },
  promotion: {
    objectif: 'Construire une identité de promotion forte et positive.',
    retenir: ['Une promotion se construit dans l’effort.', 'Les traditions donnent du sens.', 'La cohésion se travaille.'],
    consignes: ['Participer aux temps collectifs.', 'Respecter l’image de la promotion.', 'Connaître le parrain et les valeurs associées.', 'Entretenir l’esprit d’entraide.'],
    vigilance: ['Isolement.', 'Manque d’implication.', 'Esprit de groupe mal orienté.']
  },
  responsabilites: {
    objectif: 'Donner aux élèves des responsabilités utiles et formatrices.',
    retenir: ['Une responsabilité se prépare.', 'Celui qui est désigné rend compte.', 'L’exemple vaut consigne.'],
    consignes: ['Connaître sa mission.', 'Anticiper les tâches.', 'Rendre compte des difficultés.', 'Transmettre proprement au suivant.'],
    vigilance: ['Mission prise à la légère.', 'Absence de transmission.', 'Responsabilité non assumée.']
  }
};
