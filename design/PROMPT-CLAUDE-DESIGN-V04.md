# Prompt Claude Design — V0.4

> **À coller dans la conversation Claude Design déjà ouverte** (celle qui a lu le projet et posé ses
> questions le 28/07/2026). Le prompt V1 qui a produit l'écran 1 vit dans
> [PROMPT-CLAUDE-DESIGN.md](PROMPT-CLAUDE-DESIGN.md) — il reste là comme archive, il n'est pas
> remplacé par celui-ci.
>
> **Changement de circuit acté le 28/07/2026** : Claude Design ne produit plus une maquette React
> qu'on réimplémente ensuite à la main. Il édite **directement le fichier vanilla**, et ce fichier
> est le livrable déployé. Motif : chaque modification faite dans le `.dc.html` devait être reportée
> à la main dans le vanilla — dérive garantie et travail payé deux fois. On perd les panneaux de
> réglages live de l'éditeur ; on gagne zéro réimplémentation et zéro bundle de 690 Ko.
>
> Fichiers à joindre à la conversation : `app/Feux - Vue principale.html`, `app/feux-geo.js`,
> `app/feux-bulletin.js`.

---

Réponses à tes questions, puis la liste de modifications pour la V0.4.

## Tes questions

1. OÙ VIT LE DESIGN : on adopte ta recommandation. Tu travailles directement dans
« Feux - Vue principale.html » (+ feux-geo.js, feux-bulletin.js). Ce que tu rends
est le livrable, déployé tel quel sur https://feux.julienweb.fr. Le .dc.html
devient archive de l'écran 1. Contraintes non négociables : zéro React, zéro
bundle, zéro dépendance réseau obligatoire — la page marche en double-clic sur
file://, et reste dans un ordre de grandeur de 60-80 Ko hors données.

2. ÉCHELLE : conçois pour 20 à 40 arrêtés en vigueur simultanément. Nos
collecteurs voient déjà 27 arrêtés sur 25 départements et la couverture s'étend.
Les 6 zones qualifiées actuelles sont l'état de départ, pas le dimensionnement.
Applique ta piste : « en vigueur » d'abord, « levées / historique » repliées,
carte-zone compacte à 2 niveaux (statut + période visibles, le reste au dépli).

3. MOBILE : cible primaire. Le cas d'usage n°1 : quelqu'un vérifie sur son
téléphone la veille d'une rando. Sur mobile, la réponse à LA question (carte +
statut) doit être visible sans scroll.

4. TES 4 FAIBLESSES : validées toutes les quatre. En particulier la n°4 : une
recherche sans résultat répond « Aucun arrêté détecté pour ce massif — ce qui ne
signifie pas que l'accès est autorisé. Vérifiez le site de votre préfecture »,
jamais du vide.

## Modifications V0.4, en vrac (classe-les comme tu l'as proposé)

CADRE ET IDENTITÉ
- Supprimer le cadre « fausse fenêtre Mac » : le contenu occupe la vraie page,
  sans chrome décoratif.
- Version affichée : « v0.4 » discret (footer), avec https://feux.julienweb.fr
  comme URL canonique.
- Bloc open source : lien https://github.com/molokoloco/feux.julienweb.fr,
  mention « Code MIT · Données ODbL (OpenStreetMap) », une ligne git clone.

HIÉRARCHIE
- Le focus actuel est le bon et devient le H1 : « Ce massif est-il fermé
  aujourd'hui ? », sous-titre : « Les arrêtés préfectoraux de fermeture ne sont
  publiés nulle part sous forme de flux. On les collecte, on les vérifie, on les
  cartographie. »
- Carte + réponse au-dessus de la ligne de flottaison (ton point 3). Titre/chapô
  compactés, recherche intégrée à la barre de carte.
- Colonne gauche fusionnée dans la barre de carte (ton point 2) : la légende
  devient survolable (voir interactivité) au lieu d'occuper un tiers d'écran.

INTERACTIVITÉ
- Info-bulles au survol partout où il y a un terme ou un code couleur : niveaux
  de danger, statuts d'arrêté, « confiance des dates », chips des zones. Une
  légende survolée explique, une donnée survolée se source.
- Clic sur un département → zoom animé sur lui avec un mouvement de plongée
  2.5D (la scène est déjà en SVG 2.5D : anime conjointement viewBox, tangage et
  extrusion pour un effet caméra — pas de WebGL, pas de lib 3D). Les zones
  interdites du département deviennent alors lisibles individuellement.
  Retour : bouton, clic hors département, touche Échap.
- États hover/focus visibles au clavier (accessibilité).

DONNÉES TEMPS RÉEL (préparer le branchement, pas le backend)
- Au chargement, la page tente fetch('data/arretes.json') ; en cas d'échec
  (file:// ou endpoint absent), fallback silencieux sur les données embarquées.
- Afficher l'horodatage : « Données du JJ/MM à HHh — source live / embarquée ».
- Ne rien inventer côté données : structures existantes de feux-bulletin.js et
  des zones (avec confiance_dates et avertissement). L'avertissement doctrinal
  — « la météo des forêts est un indicateur, pas une autorisation ; seul
  l'arrêté préfectoral fait foi » — reste aussi visible que la donnée, sur
  desktop comme mobile.

BLOC EXPLICATIF EN BAS DE PAGE (nouveau — matière ci-dessous)
- Section « Pourquoi ce site existe » : juillet 2026, trois massifs de
  Fontainebleau fermés après les incendies, et pour seule information officielle
  un PDF scanné à la carte illisible. Une carte publique illisible est une
  information qui n'existe pas. La carte a été reconstruite en une soirée : OCR
  par IA relu à la main, contours OpenStreetMap, affichage libre. Ce site
  généralise la démarche à la France entière, parce que le problème est
  national : les polygones des massifs sont publics depuis des années, les
  arrêtés sont des documents publics — il manquait que quelqu'un branche les
  deux.
- Section « Comment ça marche » : trois sources croisées (Météo des forêts,
  carte IGN des massifs réglementés, pages actualités des préfectures) ; la
  détection est automatisée, la qualification reste humaine — aucune date de
  fin n'entre dans les données sans lecture du PDF de l'arrêté par un humain,
  parce qu'une amende peut en dépendre.
- FAQ (4 questions, balisage propre pour un futur FAQPage JSON-LD) :
  1. « Où trouver les arrêtés préfectoraux de fermeture des forêts ? » — Sur
     les sites des préfectures, souvent en PDF scanné, sans flux ni alerte.
     C'est le manque que ce site comble.
  2. « La météo des forêts suffit-elle pour savoir si je peux y aller ? » —
     Non : indicateur départemental, indicatif. Seul l'arrêté préfectoral,
     zonal, est opposable. Des promeneurs sont verbalisés chaque été à cause
     de cette confusion.
  3. « Que risque-t-on dans un massif fermé ? » — Une amende (135 €), et un
     danger réel : sols chauds, arbres fragilisés, secours mobilisés.
  4. « Ce site est-il officiel ? » — Non. En cas de doute, l'arrêté fait foi ;
     chaque zone lie sa source officielle.
- Signature courte : « Un projet open source de Julien, webmaster à Pantin —
  julienweb.fr », lien vers l'article d'origine
  https://julienweb.fr/blog/foret-fontainebleau-fermee-carte/11311/

SEO ON-PAGE
- <title> : « Ce massif est-il fermé aujourd'hui ? Carte des forêts interdites
  par arrêté préfectoral »
- meta description : « Carte de France des massifs forestiers fermés par arrêté
  préfectoral (risque incendie). Arrêtés collectés et vérifiés, mise à jour
  quotidienne, sources officielles liées. »
- lang="fr", HTML sémantique (header/main/section/footer, un seul H1, Hn
  hiérarchisés), JSON-LD WebSite + FAQPage, canonical https://feux.julienweb.fr/
- Conserver tel quel dans le <head> : la meta robots noindex actuelle (on la
  retirera nous-mêmes au moment de la publication réelle).

MONÉTISATION
- Un emplacement publicitaire en placeholder neutre (gris, mention « annonce »),
  728×90 desktop / 300×250 mobile, placé sous la carte ou au début du bloc
  explicatif — jamais entre la question et la réponse.

## Rappels doctrine (non négociables, déjà dans le code actuel — ne pas régresser)
- Une zone sans contour reste affichée : ne pas savoir dessiner un périmètre
  n'autorise pas à taire l'interdiction.
- Distinguer « l'arrêté ne fixe pas de terme » (fait vérifié → INTERDIT sans
  terme) de « nous n'avons pas lu l'arrêté » (doute → statut incertain) : c'est
  le champ confiance_dates, il doit rester lisible dans l'UI.
- Les dates se calculent (péremption automatique), jamais figées en dur.
- La reconstruction des flancs d'extrusion depuis les « d » compense un champ
  pts absent de feux-geo.js : ne pas « nettoyer » ce code.

Livrable : le fichier vanilla modifié (+ feux-geo.js/feux-bulletin.js si besoin),
qui marche en double-clic. Un écran, cette page — pas d'écran 2 dans cette passe.

---

## Matière source du bloc explicatif

Le contenu du bloc de bas de page n'est pas inventé : il est distillé de deux textes déjà écrits et
déjà éprouvés, qui vivent dans le projet voisin `Julienweb.fr/`.

| Source | Ce qu'on en tire |
|---|---|
| Article #11311 `content/articles-publies/2026-07-26_foret-fontainebleau-fermee-carte.md` | le récit d'origine, la formule « une carte publique illisible, c'est une information qui n'existe pas », la méthode en 3 étapes, la FAQ pratique |
| Brouillon Reddit `content/articles-drafts/reddit_foret-fontainebleau-psa.md` | le ton direct, l'argument « la donnée existait DÉJÀ, il manquait que quelqu'un branche les deux », les objections déjà anticipées (hallucination OCR, légalité de la republication) |

L'article porte le SEO grand public sur `julienweb.fr` ; ce site porte l'outil. Les deux se citent —
le bloc de bas de page lie l'article, l'article liera le site. Ne pas dupliquer l'article ici :
en reprendre l'argument, pas les paragraphes, sous peine de contenu dupliqué entre deux domaines.

## Après le retour de Claude Design

1. Récupérer le fichier, vérifier qu'il s'ouvre en **double-clic** (`file://`) avant tout le reste.
2. Vérifier que le `fetch('data/arretes.json')` échoue **silencieusement** sur `file://` et que la
   page affiche bien les données embarquées — c'est le mode nominal tant que l'API n'existe pas.
3. Bumper `package.json` en `0.4.0`, `node app/build-data.js` (la version se propage toute seule),
   entrée `CHANGELOG.md`, tag `v0.4.0`.
4. `cp` vers `app/index.html`, puis déployer (`skills/deploy-ftp-feux/SKILL.md`).
5. Ne retirer le `noindex` que quand le contenu est jugé publiable — **trois pièces à la fois** :
   `<meta robots>`, `X-Robots-Tag` du `.htaccess`, et surtout **pas** le `robots.txt`, qui doit
   continuer d'autoriser le crawl.
