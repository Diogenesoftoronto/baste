# Politique de confidentialité de Baste

Cet avis proposé explique le site public et la démonstration de Baste dans le navigateur, y compris les renseignements conservés dans votre navigateur et les requêtes vers des services externes. Il explique séparément ce qui change lorsque vous exploitez ou connectez un serveur. Préparé pour examen par le propriétaire le 2 octobre 2026; non publié et non en vigueur. Les éléments entre crochets doivent être réglés avant adoption.

## Responsabilité

Baste est exploité par Keith Abiola Noel, entrepreneur individuel au Québec, au Canada. Le propriétaire est responsable de la protection des renseignements personnels, sauf délégation écrite de cette responsabilité conformément à la loi. Pour ce projet, le responsable est Keith Abiola Noel, propriétaire; le contact professionnel commun publié pour les demandes de confidentialité et de soutien concernant Baste est support@notorganic.info. [Avant adoption : ajouter l’adresse postale publique de contact professionnel, confirmer le traitement fiable et privé des demandes reçues par cette boîte et consigner toute délégation écrite modifiant l’identité du responsable.] L’exploitant d’un serveur choisi indépendamment est responsable des pratiques de ce serveur. N’envoyez pas de renseignements privés dans un outil public de suivi des problèmes.

## Visites et requêtes techniques

Votre navigateur transmet à l’hébergeur les renseignements nécessaires à la livraison des pages et fichiers : adresse IP, URL demandée, moment de la requête et en-têtes du navigateur. Les URL peuvent contenir des paramètres de persona, d’onglet, de projet ou de langue; évitez les renseignements personnels dans les noms et URL. Ils peuvent aussi figurer dans l’historique et les liens partagés.

La configuration de déploiement du site public utilise l’hébergement Railway et nginx pour servir des fichiers statiques. Le service d’hébergement reçoit les requêtes de livraison; il est distinct de la passerelle Not Organic facultative. [Avant adoption : confirmer les journaux d’accès et d’erreurs réellement conservés, tout fournisseur de livraison supplémentaire, les fins, l’accès du personnel et des fournisseurs, les pays de stockage, les périodes de conservation et le traitement des sauvegardes.] Nous ne pouvons pas actuellement affirmer que les visites ne sont pas journalisées ou que toutes les données restent au Québec. HTTPS protège le transport vers le site public; il n’empêche pas les hébergeurs de recevoir les requêtes.

## Données saisies dans la démonstration

Studio peut traiter les noms et résumés de personas, références et préférences culturelles, URL de tableaux d’inspiration, notes et étiquettes, classements et commentaires, aperçus de prompts, documents de l’éditeur et détails des tâches simulées. Dans la démonstration actuelle, ces données restent en mémoire dans ce client; elles ne sont pas enregistrées dans un compte Baste ni envoyées à une API de génération par IA. Elles peuvent disparaître au rechargement ou à la fermeture de la page.

Un persona peut révéler des intérêts ou croyances sensibles s’il décrit une personne identifiable. Utilisez des exemples fictifs et omettez les renseignements inutiles. Le score esthétique de la démonstration n’est pas destiné à prendre une décision concernant une personne réelle. La saisie est facultative; vous pouvez consulter les exemples fournis.

Cela ne signifie pas que la page fonctionne hors ligne : elle charge les ressources et polices du site, et les images de référence externes ajoutées peuvent entraîner des requêtes distinctes.

Nous utilisons les renseignements pour les fonctionnalités que vous demandez, le soutien, la sécurité du service et les obligations légales applicables. Nous ne vendons pas vos contenus de travail dans Baste et ne les utilisons pas pour entraîner des modèles d’IA généralistes. La démonstration actuelle ne fournit à l’exploitant aucune copie de ces contenus conservée dans un compte. Des préférences enregistrées ou une rétroaction utilisée dans une évaluation sont distinctes d’un entraînement des poids d’un modèle. Tout futur service facultatif d’entraînement doit préciser séparément les données choisies, la fin, les destinataires, le public et les contrôles avant son activation. Cet engagement ne détermine pas les pratiques d’un exploitant de serveur indépendant et ne remplace pas les conditions propres à un fournisseur d’IA.

## Témoins et stockage du navigateur

Le sélecteur de langue crée le témoin baste.language avec la valeur en ou fr pour une durée maximale de 365 jours, Path=/ et SameSite=Lax, ainsi que Secure sous HTTPS. Ce témoin de préférence est accessible aux scripts et accompagne les requêtes correspondantes au site; il n’authentifie pas un compte. Vous pouvez le supprimer ou le bloquer, ou choisir une langue avec ?lang=en ou ?lang=fr. Sans choix explicite, les préférences linguistiques du navigateur sont aussi utilisées.

Le site utilise localStorage pour baste_api_url (destination API), baste_sound (préférence sonore), baste:material:v1 (recette de matière) et baste:backdrop:v1 (fond choisi). Le code examiné ne prévoit aucune expiration automatique; ces entrées restent jusqu’à leur suppression par vous ou votre navigateur. Les scripts de cette origine y ont accès, mais elles ne sont pas automatiquement transmises comme des témoins. La destination API enregistrée sert aux requêtes au serveur.

Effacez les témoins et le stockage de ce site dans votre navigateur pour réinitialiser ces préférences. Cela ne supprime pas vos exportations, les fichiers d’un serveur local ni les données d’un autre service. Aucune intégration de publicité ou d’analyse d’audience n’a été identifiée dans le code du site examiné; les journaux de l’hébergeur restent à confirmer. Les réglages sonores et linguistiques ne sont pas des commandes de consentement à l’analyse d’audience.

## Polices images et médias de documentation

Les pages demandent les feuilles de style et fichiers de Google Fonts à fonts.googleapis.com et fonts.gstatic.com. Google reçoit des renseignements réseau, notamment votre adresse IP et les en-têtes des requêtes. Ses pratiques sont décrites à https://policies.google.com/privacy.

En mode démonstration, les images d’un tableau d’inspiration sont chargées directement depuis les URL fournies. La destination peut recevoir votre adresse IP, les en-têtes et les témoins que votre navigateur autorise pour elle. Le site public utilise strict-origin-when-cross-origin comme règle de référent; les requêtes externes peuvent révéler l’origine du site. Une URL de référence peut elle-même contenir des identifiants. N’utilisez pas d’URL privées ou signées sans comprendre leur divulgation.

Les captures, vidéos narrées et sous-titres du guide Studio sont des fichiers du site, sans lecteur vidéo tiers intégré dans le guide examiné. Leur chargement ou lecture transmet néanmoins des requêtes à l’hébergeur. Les liens externes mènent à des services ayant leurs propres pratiques.

## Connexion ou exploitation d’un serveur

Studio teste d’abord la santé de l’API configurée puis utilise la démonstration en cas d’échec. Modifier cette destination peut transmettre ensuite les personas, commentaires, documents ou autres opérations demandées au serveur choisi. Les requêtes incluent les identifiants de session lorsque le navigateur le permet; les opérations de compte facultatives utilisent un en-tête CSRF. Vérifiez que ce serveur est digne de confiance.

Une CLI ou un serveur local peut enregistrer les personas JSON personnalisés, la configuration, les tableaux d’inspiration, classements, historique de commentaires, ressources et métadonnées, kits de marque, documents d’éditeur, instantanés de projets et reçus de commandes, exports OpenPencil et versions de conception dans des fichiers ou SQLite. Le stockage dépend de la commande et de la version installée. Les commentaires peuvent être résumés et inclus dans des demandes ultérieures d’évaluation pour personnaliser les scores; cela diffère d’un entraînement des poids d’un modèle. L’exploitant du site public ne reçoit pas ces fichiers du seul fait que vous utilisez le logiciel.

Selon la version installée, le logiciel local prévoit QuiverAI pour les SVG, OpenAI ou Google pour les images, Google ou des points d’accès Seedance configurés pour les vidéos et OpenAI, TypeSafe ou Not Organic pour l’évaluation. Ces chemins peuvent transmettre les prompts, le contexte du persona, les descriptions de candidats, métadonnées, préférences tirées des commentaires et, lorsqu’il est fourni pour l’évaluation, le code SVG. Vérifiez la version installée et les paramètres et modalités du compte réel pour la disponibilité, l’entraînement, la conservation, les pays et la suppression. Aucune promesse générale d’absence de conservation ou d’entraînement n’est faite.

Sur un serveur compatible, la décomposition récupère l’URL demandée et les feuilles de style liées, et peut utiliser un navigateur pour rendre la page; une copie facultative conserve les ressources. Un relais d’images récupère les images demandées depuis ce serveur. Les destinations reçoivent les requêtes du serveur; le rendu approfondi peut charger des ressources de tiers. Utilisez seulement les URL auxquelles vous avez le droit d’accéder. Le remix combine des personas dans un nouveau persona enregistré lorsque le serveur le permet. Ces fonctions relèvent du serveur, pas de la démonstration publique.

## Comptes paiements et hébergement futur

Le déploiement public actuel ne fournit pas de points d’accès de connexion, de paiement ou de génération payante. Le code d’interface d’une passerelle Not Organic ne prouve pas que la connexion est enregistrée, autorisée ou fonctionnelle. Cette politique ne décrit pas une collecte active de cartes de paiement par Baste ni un service hébergé de suppression de compte.

Une passerelle locale de compte compatible, si elle est activée et autorisée par le fournisseur, conserve un témoin opaque baste_session pendant un maximum de huit heures, avec HttpOnly, SameSite=Lax et Secure sous HTTPS. Les sessions, états d’autorisation, valeurs CSRF, jetons fournisseurs et clés de signature restent en mémoire sur le serveur; son redémarrage met fin aux sessions. Le navigateur voit un DID ou identifiant public et des renseignements de compte, de modèles et de solde. Les fichiers propres au compte peuvent être séparés dans des répertoires selon une empreinte du DID; cette empreinte ne rend pas les renseignements anonymes. La déconnexion ne supprime pas ces fichiers. Il s’agit de mécanismes du code, pas d’un comportement vérifié du service public.

Avant d’activer un service hébergé, nous devons expliquer les rôles réels des exploitants et destinataires, les identifiants de compte, sessions, données de projet et prompts conservés, registres d’usage et de facturation, fournisseur de paiement, fins, durées, traitements transfrontaliers et choix pertinents. Connecter un compte ne doit pas valoir consentement à un entraînement sans rapport, au marketing ou à la publication de personas privés.

Si vous utilisez séparément une connexion Not Organic autorisée, sa couche commune traite les renseignements de compte et d’autorisation, les contenus d’IA demandés ainsi que les données d’utilisation et de facturation nécessaires à cette fonctionnalité. Son avis publié actuel mentionne Railway pour l’hébergement et Convex pour les dossiers applicatifs, les fournisseurs configurés de routage et de modèles pour l’IA, Paddle pour les achats et PostHog pour les analyses opérationnelles de la passerelle lorsque cette fonction est configurée. La télémétrie inspectée de la passerelle utilise un identifiant pseudonyme et des métadonnées d’utilisation, de coût et de résultat plutôt que le corps des invites ou les DID directs. Ce sont des pratiques de la couche commune; elles ne prouvent pas que la démonstration actuelle de Baste envoie des contenus à Convex, recueille des données de carte ou utilise PostHog. Consultez https://notorganic.info/privacy et https://notorganic.info/terms pour les avis actuels de cette couche, encore présentés comme des projets non en vigueur.

## Conservation exportations et suppression

Le contenu de démonstration reste en mémoire pour cette instance de page ou de client. Les préférences sont conservées comme indiqué ci-dessus. La durée des journaux et sauvegardes du site reste à déterminer avant adoption; aucune durée fixe n’est inventée ici.

Les exportations de jetons et de l’éditeur créent des copies sous votre contrôle. Supprimer un persona personnalisé retire ce persona de démonstration et son document d’éditeur enregistré, mais ne démontre pas l’effacement de tous les tableaux, commentaires ou exports. Le rechargement réinitialise la mémoire. Dans le code local, supprimer un persona retire son fichier JSON personnalisé, pas toutes les données associées, ressources, bases, sauvegardes ou données des fournisseurs. Les exploitants locaux doivent les gérer séparément. Aucune fonction hébergée « tout supprimer » n’est vérifiée.

L’implémentation commune de Not Organic chiffre les réponses enregistrées de la passerelle et leur attribue une expiration de 30 jours, y compris un résultat de jugement enregistré lorsque ce traitement se termine avec des données d’utilisation. Une requête prise en charge par l’API Responses avec store: false évite cet enregistrement de réponse; la passerelle de compte Baste inspectée n’expose pas ce point d’accès comme contrôle général offert à l’utilisateur. Cette expiration de 30 jours ne s’applique pas aux fichiers locaux de Baste, à la rétroaction, à l’historique des projets, aux dossiers de facturation ou de sécurité, aux sauvegardes ou aux copies de fournisseurs indépendants. Ce n’est pas un délai vérifié de suppression de tous les dossiers après une requête Baste.

## Demandes et choix

Selon la loi applicable, vous pouvez demander l’accès, la rectification, le retrait du consentement ainsi que la suppression ou la portabilité lorsque la loi le prévoit. Adressez une demande concernant Baste à Keith Abiola Noel, propriétaire responsable de la confidentialité, par support@notorganic.info; indiquez Baste et les données ou le compte concernés. [Avant adoption : confirmer que cette boîte reçoit de façon fiable les demandes privées et mettre en place le processus de vérification d’identité, de réponse et d’escalade.] Nous répondrons dans les délais légaux applicables, vérifierons l’identité de façon proportionnée et expliquerons tout refus ou maintien de conservation autorisé par la loi. N’envoyez pas de mots de passe, de clés API ou de numéros complets de carte de paiement.

Pour les fichiers locaux, adressez-vous à l’exploitant du serveur; les procédures des destinataires externes peuvent aussi être nécessaires. Le retrait peut affecter une fonction qui exige ces données. Vous pouvez saisir la Commission d’accès à l’information du Québec à https://www.cai.gouv.qc.ca ou, lorsque cela s’applique, le Commissariat à la protection de la vie privée du Canada à https://www.priv.gc.ca.

## Protection transferts et enfants

La démonstration publique ne conserve pas votre travail dans un compte, mais votre navigateur, vos fichiers exportés et votre serveur choisi nécessitent une protection. [Avant adoption : confirmer les contrôles d’accès de l’hébergeur, la réponse aux incidents, les notifications et les mesures pour les traitements hors Québec.] Les requêtes externes peuvent entraîner un traitement hors Québec ou hors Canada; ce projet ne prétend pas qu’une évaluation des facteurs relatifs à la vie privée ou un contrat fournisseur a été réalisé.

[Avant adoption : déterminer les âges visés et le traitement des renseignements d’un enfant ou du consentement parental requis.] Aucun compte enfant ni processus de consentement parental n’a été vérifié. Ne fournissez pas de renseignements personnels d’enfants dans la démonstration. Cette instruction ne remplace pas les obligations légales si de tels renseignements sont reçus.

## Modifications et consentement

La politique adoptée devra indiquer une date d’entrée en vigueur et rester accessible en anglais et en français. Les modifications importantes seront communiquées de manière appropriée. Lorsqu’une nouvelle fin ou communication exige un consentement, nous devons l’obtenir avant le traitement; modifier cette politique ou continuer à naviguer ne constitue pas un consentement général.
