# HANDOFF — session fondatrice du 26/07/2026

> **Journal daté et figé.** Ne pas réécrire : si l'état du projet change, c'est
> [CLAUDE.md](CLAUDE.md) qu'on met à jour. Ce fichier raconte d'où vient le projet et
> pourquoi il est construit comme ça — un futur lecteur doit pouvoir comprendre les
> décisions sans avoir à refaire les recherches.

## La question de départ

> « Est-ce qu'il existe un flux structuré qui recense les arrêtés préfectoraux ? API, RSS,
> n'importe quoi de parsable. J'aimerais généraliser mon outil Fontainebleau, notamment
> pour la Gironde cet été, et la seule solution que je vois c'est de scraper les pages
> d'actualités des préfectures. »

## La réponse : non — et quelqu'un a déjà essayé

**ReAcT** (beta.gouv.fr) — « une interface de recherche des actes administratifs pour les usagers,
les associations et les agents publics ». Scraping + OCR des recueils, 4 départements pilotes :
Aube, Oise, Sarthe et **Seine-et-Marne**. Investigation 20/11/2023 → construction 01/03/2024 →
accélération 18/10/2024 → **arrêté le 26/08/2025**. Code source non publié, stats non publiées.
Contact resté en ligne : `jean-luc.girel@aube.gouv.fr`.

Sur le forum data.gouv.fr, la même question avait été posée mot pour mot. Réponse officielle :
pas d'API unique, hétérogénéité des producteurs, pas de cadre réglementaire unifié.

**La règle qui s'en dégage** : en France, un flux d'arrêtés préfectoraux existe *quand un ministère
porte la verticale*, jamais en transversal.

| Verticale | Produit | Statut |
|---|---|---|
| Eau / sécheresse | **VigiEau** (`api.vigieau.gouv.fr`) | ✅ JSON complet : niveau, zones, dates, lien PDF |
| Circulation | **DiaLog** (beta.gouv.fr) | ✅ |
| Forêt / feu | — | ❌ **le trou que ce projet comble** |

⚠️ Propluvia est décommissionné : ne pas partir de vieux tutos.

## Ce qu'on a trouvé d'exploitable

1. **Météo des forêts (Météo-France)** — l'archive `mdf_2026.csv.gz` sur data.gouv est présentée
   comme un historique mais elle est **rafraîchie quotidiennement** (dernière ligne = jour même,
   14:50 UTC). Flux national, 96 départements, J+1/J+2, Licence Ouverte 2.0, **sans clé API**.
   L'API à clé du portail Météo-France devient inutile. Schéma : `date;num_dep;niveau_j1;niveau_j2;nom_dep`.
2. **NaviForest (IGN + FCBA)** — une page nationale unique listant les arrêtés par département.
   Séduisant sur le papier, **décevant en pratique : 25/96 départements, et le 77 est vide** —
   l'arrêté Fontainebleau qui a lancé le projet n'y figure pas. C'est un index, pas une source de
   vérité. L'IGN décline explicitement toute responsabilité sur les omissions.
3. **risque-prevention-incendie.fr (Entente Valabre)** — la maille la plus fine qui existe : accès
   quotidien par massif et ZAPEF, pourtour méditerranéen. Endpoint JSON non documenté →
   **demande écrite envoyée en attente**, on ne tape pas sans autorisation.
4. **BDIFF** — historique des feux depuis 2006, pour la couche stats.

## Ce qu'on a construit, et ce que ça a prouvé

### Le watcher : 28 trouvailles, 0 erreur

Passage sur 10 départements (33, 40, 77, 83, 13, 30, 34, 66, 2A, 2B) :

| Dép. | Détecté |
|---|---|
| **2A** | fermeture des massifs **BAVELLA** et **ILLARATA** (17/07), puis abrogation et remplacement (20/07) |
| **2B** | fermetures de sentiers communaux (feux de Corte et Albertacce) |
| **13** | « Risque TRÈS SÉVÈRE — fermeture de **TOUS** les massifs » le 23/07 |
| **77** | fermeture des **Trois Pignons** |
| **83** | 18 points de situation (feux de Pontevès et Gros-Bessillon) |
| 33 · 40 | vigilance ORANGE feu de forêt en Gironde, etc. |
| 30 · 34 · 66 | rien — aucun arrêté récent en ligne |

**2A, 2B, 13 et 83 sont tous vides côté NaviForest.** C'est la démonstration : ces arrêtés
événementiels, qui changent tous les 3 jours, ne sont exposés par aucun flux national.

### L'arrêté Illarata, lu en entier

PDF scanné (`pdftotext` = 32 octets) → Ghostscript 150 dpi + lecture visuelle. Contenu réel :

- **Article 1** : l'arrêté R20-2026-07-17-00003 est abrogé **à compter du 21 juillet à 6h00**
- **Article 2** : accès, circulation, stationnement et présence **interdits** sur le massif
  d'Illarata–Taglio Rosso (commune de Zonza), périmètre défini par la carte n°1 annexée
- **Articles 3-4** : réouvertures partielles encadrées — véhicules entre PR7+750 et PR9 de la
  RD168A, parking limité à 260 places, site des « Trois Piscines » accessible **uniquement par
  navette communale**
- **Aucune date de fin**

C'est l'illustration parfaite de la thèse du projet : une information à valeur réglementaire, qui
change tous les trois jours, enfermée dans un PDF scanné qu'aucun flux n'expose.

Autre découverte au passage : la fermeture des **Trois Pignons** relève d'un arrêté **différent**
(AP 2026 CAB SIDPC 1009 du 24/06, interdépartemental 77+91, fin conditionnée à « la fin de la
vigilance rouge canicule ») de celui de Fontainebleau (2026/CAB/SIDPC/1223 du 24/07).

## Les décisions de conception, et pourquoi

**Registre de massifs curaté plutôt qu'automatique.** Le nom d'un massif dans un arrêté ne
correspond pas à un objet OSM : « massif de Bavella » et « massif d'Illarata » n'existent ni en
relation ni en way (recherche bbox Corse : un col, un village, des routes) ; les forêts voisines
s'appellent « Forêt Territoriale de Tova » et « Forêt de Valdu ». Une correspondance devinée par nom
produirait des **contours faux** sur un sujet où l'erreur vaut une amende.

**Massifs sans contour conservés quand même.** Bavella et Illarata sont listés sans géométrie, avec
la raison affichée. Ne pas savoir dessiner une zone n'autorise pas à la taire.

**Modèle de dates conçu pour la réalité, pas pour le cas idéal** : `fin: null` + `fin_condition`,
`abroge_par`, `derogations`, et surtout `confiance_dates` qui sépare le fait du doute.

**Qualification manuelle assumée.** Les dates sont dans des PDF scannés. L'automatisation s'arrête
à la détection.

## Ce qui a cassé pendant la session

| Incident | Résolution |
|---|---|
| **IP bannie en ~2 min** par la plateforme préfectorale (crawl 400 ms × 30 pages × 10 dép.) | disjoncteur + défauts timides ; ban retombé en ~6 min ; repassage ensuite en 0 erreur |
| Assemblage maison des anneaux OSM : 81 anneaux incohérents (Fontainebleau), 0 (Commanderie) | `polygons.openstreetmap.fr` |
| Overpass : 406, timeout 64 s, réponse XML | UA descriptif, requêtes bornées, bascule miroir |
| `pdftotext` rend 32 octets | PDF scanné → Ghostscript + vision (`pdftoppm` absent de la machine) |
| `launch.json` refuse toute cible hors racine projet | abandon du dev server → POC autonome en `file://`, données embarquées |
| `fitBounds` au chargement dézoome à ~4,5 | **non résolu**, contourné par `setView` ; bbox pourtant saine |

## Ce qui reste ouvert

- Fusionner les sorties en un `arretes-forets-fr.json` unique et versionné — c'est précisément le
  trou que ReAcT a laissé en mourant
- Tracer à la main les contours des massifs corses depuis les cartes annexées aux arrêtés
- Automatisation quotidienne + déploiement du sous-domaine
- **2 mails rédigés, non envoyés** : Valabre (conditions de réutilisation) et le référent ReAcT
  (code source et retour d'expérience)
- **31/07/2026** : l'arrêté 77 expire → article #11311 et repo `feux-foret-carte` à mettre à jour

## Commits de la session

```
2be6b36  refactor(app): 3 colonnes — contexte à gauche, carte au centre, interdictions à droite
558b352  feat: contours de massifs OSM + modèle d'interdiction (quoi, de quand à quand)
36c4314  data: veille 10 départements — 28 trouvailles, 0 erreur, aucun bannissement
6b9fa4f  feat(app): POC carto local — 96 départements, données embarquées, sans serveur
3913bd9  feat: collecteurs arrêtés forêt + danger feu (NaviForest, Météo des forêts, veille)
```
