# 🔥 Feux — Ce massif est-il fermé aujourd'hui ?

[![Node](https://img.shields.io/badge/node-%3E=18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Zéro dépendance](https://img.shields.io/badge/dépendances-0-brightgreen)](package.json)
[![Statut](https://img.shields.io/badge/statut-POC%20en%20ligne-orange)](https://feux.julienweb.fr)
[![Version](https://img.shields.io/badge/version-0.3.0-blue)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Données](https://img.shields.io/badge/données-ODbL%20%C2%B7%20Licence%20Ouverte-lightgrey)](LICENSE-DONNEES.md)
[![Made by](https://img.shields.io/badge/made%20by-JulienWeb.fr-5A4095)](https://julienweb.fr)

[![Carte des massifs fermés de Fontainebleau, Trois-Pignons et la Commanderie](https://github.com/molokoloco/feux.julienweb.fr/blob/main/archive/2026-07_fontainebleau/carte/apercu-2026-07-26.png?raw=true "Le cas fondateur : Fontainebleau, juillet 2026")](https://github.com/molokoloco/feux.julienweb.fr/blob/main/archive/2026-07_fontainebleau/carte/apercu-2026-07-26.png)

> **Les arrêtés préfectoraux de fermeture des forêts ne sont publiés nulle part sous forme de flux.**
> Ce projet les collecte, les vérifie et les cartographie — pour que la question
> « ai-je le droit d'aller marcher là, aujourd'hui ? » ait enfin une réponse lisible.

> 🌐 **En ligne** : [feux.julienweb.fr](https://feux.julienweb.fr) *(POC, volontairement en `noindex`)*
> 📝 **Article d'origine** : [Forêt de Fontainebleau fermée : j'ai refait la carte que la préfecture n'a pas su publier](https://julienweb.fr/blog/foret-fontainebleau-fermee-carte/11311/)
> 🌲 **Prédécesseur** : [molokoloco/feux-foret-carte](https://github.com/molokoloco/feux-foret-carte) — le cas Fontainebleau, figé

| | |
|---|---|
| 🔎 **Sources** | Météo des forêts (Météo-France) · NaviForest (IGN + FCBA) · sites préfectoraux · OpenStreetMap |
| 🗺️ **Couverture** | **96 départements** en danger feu · 27 arrêtés permanents · 6 zones d'interdiction qualifiées |
| 🧭 **Modèle** | « quoi, de quand à quand » — dates, dérogations, abrogations, **confiance des dates** |
| 🛡️ **Politesse** | disjoncteur anti-bannissement, cache disque, séquentiel, UA joignable |
| 🖥️ **Front** | page autonome — **double-clic, sans serveur, sans build** |
| ⚖️ **Doctrine** | l'automatisation détecte, **l'humain qualifie** |

**Stack** : Node.js 18+ · **zéro dépendance npm** · Leaflet + MapLibre (CDN) · SVG 2.5D

---

### ⚡ TL;DR

```bash
git clone https://github.com/molokoloco/feux.julienweb.fr.git
cd feux.julienweb.fr
npm run collect     # météo + naviforest + massifs + veille + build
```

Puis **double-clic sur `app/index.html`**. Aucun serveur, aucune dépendance à installer.

> ⚠️ Avant de lancer `npm run collect`, lisez [🚨 La plateforme préfectorale bannit vite](#-la-plateforme-préfectorale-bannit-vite--leçon-payée-le-26072026).
> Ce n'est pas une formule de style : l'IP de ce projet a été bannie en deux minutes.

---

### 🎯 Le problème

La question de départ était : *« existe-t-il un flux structuré qui recense les arrêtés
préfectoraux ? »*. Réponse, après vérification le 26/07/2026 : **non**, et ce n'est pas faute
d'avoir essayé.

| Piste | Verdict |
|---|---|
| API nationale des arrêtés préfectoraux | ❌ n'existe pas |
| **ReAcT** (beta.gouv.fr) — recherche d'actes administratifs, scraping + OCR des RAA, pilotes Aube / Oise / Sarthe / **Seine-et-Marne** | ❌ **arrêté le 26/08/2025**, code source non publié |
| API Légifrance / PISTE | ⚠️ national uniquement (JORF, codes, jurisprudence), aucun acte préfectoral |
| RSS / sitemap / robots.txt sur les sites préfectoraux | ❌ `404` sur les 4 sites testés (33, 40, 77, 83) |
| Jeux data.gouv « arrêtés préfectoraux » | ⚠️ uniquement protection de biotope, régionaux |

**La règle qui s'en dégage** : en France, un flux d'arrêtés préfectoraux existe *quand un ministère
porte la verticale*, jamais en transversal.

- Eau → **VigiEau** (`api.vigieau.gouv.fr`) : arrêtés sécheresse en JSON, avec dates de validité,
  zones et lien vers le PDF. Le modèle exact de ce qu'on voudrait pour la forêt.
  (⚠️ Propluvia est décommissionné, ne pas partir de vieux tutos.)
- Circulation → **DiaLog** (beta.gouv.fr).
- Forêt → **rien**. C'est le trou qu'on comble ici.

---

### 🗺️ Architecture — quatre étages

#### 1️⃣ Socle national, zéro scraping

| Collecteur | Source | Ce qu'on obtient | Vérifié |
|---|---|---|---|
| [`meteo-forets.js`](collectors/meteo-forets.js) | Météo-France via data.gouv | Danger feu J+1/J+2 par département, **96 départements**, Licence Ouverte 2.0, **sans clé API** | ✅ bulletin du jour |
| [`naviforest.js`](collectors/naviforest.js) | [NaviForest](https://naviforest.ign.fr/arretes-prefectoraux-acces-massifs-forestiers) (IGN + FCBA) | Arrêtés permanents (emploi du feu, brûlage) + date de fin de validité | ⚠️ **25/96 départements** |

**La bonne surprise** : l'archive annuelle de la Météo des forêts (`mdf_2026.csv.gz`) est présentée
comme un historique, mais elle est **rafraîchie quotidiennement** — dernière ligne = jour même,
14:50 UTC. C'est donc un vrai flux national quotidien, gratuit et sans inscription. L'API temps réel
du portail Météo-France (avec clé applicative) devient inutile.

**La mauvaise surprise** : NaviForest ne couvre que 25 départements sur 96, et **le 77 est vide** —
l'arrêté Fontainebleau qui a lancé ce projet n'y figure pas. C'est un index, pas une source de
vérité. L'IGN décline d'ailleurs explicitement toute responsabilité sur les omissions.

#### 2️⃣ Événementiel, là où ça compte

[`watch-prefectures.js`](collectors/watch-prefectures.js) — crawl borné de la branche
Actualités/Publications des sites préfectoraux, filtré par mots-clés (forêt/massif/incendie +
arrêté/interdiction/restriction), avec état persistant pour ne signaler que le neuf.

Ce qui rend l'exercice tenable : **les 101 sites tournent sur le même CMS**.

| Endpoint | Statut |
|---|---|
| `/Actualites` | ✅ 200 sur les 10 départements testés |
| `/content/view/sitemap/2` | ✅ 200 (plan du site — rubriques seulement) |
| `/contenu/telechargement/<node>/<id>/file/<nom>.pdf` | ✅ format des PDF |
| `/rss.xml`, `/rss`, `/feed`, `/sitemap.xml`, `/robots.txt` | ❌ 404 |

Un adaptateur + une table de domaines, pas 101 scrapers. Départements suivis :
33, 40, 77, 83, 13, 30, 34, 66, 2A, 2B (cf. [`data/prefectures.json`](data/prefectures.json)).

#### 3️⃣ Contours de massifs

[`massifs-osm.js`](collectors/massifs-osm.js) récupère les contours depuis OpenStreetMap, à partir
du registre curaté [`data/massifs.json`](data/massifs.json).

**Pourquoi curaté et pas automatique** : le nom d'un massif dans un arrêté ne correspond pas à un
objet OSM. Vérifié le 26/07/2026 — « massif de Bavella » et « massif d'Illarata » n'existent dans
OSM ni en relation ni en way (seulement un col, un village, des routes) ; les forêts voisines
s'appellent « Forêt Territoriale de Tova » et « Forêt de Valdu ». Une correspondance devinée par nom
produirait des contours faux sur un sujet où l'erreur vaut une amende. Un massif sans contour fiable
est donc **conservé sans géométrie** et affiché comme tel.

#### 4️⃣ Sous conditions — non consommé

`risque-prevention-incendie.fr` (Entente Valabre + préfectures méditerranéennes) publie le niveau
d'accès **quotidien par massif et ZAPEF** — la maille la plus fine qui existe. La page charge ses
données en asynchrone, donc un endpoint JSON existe. **On ne le tape pas sans autorisation** :
données à valeur réglementaire, interdiction pénalement sanctionnée. Demande écrite en attente.

---

### 🚨 La plateforme préfectorale bannit vite — leçon payée le 26/07/2026

Premier jet du watcher : 400 ms de pause, 30 pages × 10 départements. **IP bannie en ~2 minutes.**

Signature : connexion acceptée puis fermée sèchement — `curl` renvoie `000` en 0,1 s, Node renvoie
`fetch failed` / `UND_ERR_SOCKET`. Le blocage frappe **tous les sites préfectoraux d'un coup**
(plateforme mutualisée), pendant que `naviforest.ign.fr` continuait de répondre 200 : c'est bien un
anti-crawl côté plateforme, pas une panne locale. Le ban est tombé au bout de ~6 minutes.

Corrections appliquées dans [`collectors/_http.js`](collectors/_http.js) :

- défauts divisés : **8 pages, profondeur 2, 3 s de pause**, 20 s entre deux départements
- backoff exponentiel (3 s → 9 s → 27 s) au lieu de linéaire
- **disjoncteur** : à la 3ᵉ fermeture sèche sur un hôte, on abandonne ce département proprement avec
  un diagnostic, au lieu d'empiler 22 échecs identiques et d'allonger le bannissement
- `429` / `503` comptent aussi pour le disjoncteur
- User-Agent descriptif et **joignable**, cache disque, requêtes strictement séquentielles

**Règles d'usage, non négociables :**

| ✅ À faire | ❌ À ne pas faire |
|---|---|
| Un département à la fois (`--dep 33`) | Les dix d'affilée |
| Un passage par jour | Une boucle horaire |
| Attendre des dizaines de minutes après un `000` | Insister — ça allonge le ban |
| Garder les valeurs par défaut | Remonter les compteurs « pour tester plus vite » |

---

### 🧭 Doctrine — ce qui n'est pas négociable

**1. Météo des forêts ≠ autorisation d'accès.** Indicateur *indicatif* et *départemental*. Seul
l'**arrêté préfectoral zonal** est opposable. Des gens se font verbaliser chaque année à cause de
cette confusion.

**2. L'automatisation s'arrête à la détection, la qualification reste humaine.** Les dates ne sont
pas sur les pages, elles sont dans des PDF **scannés**. Extraire une date de fin par OCR sans
relecture, quand une amende en dépend, n'est pas acceptable.

**3. Ne jamais confondre ces deux cas :**

| Cas | Nature | Statut affiché |
|---|---|---|
| « l'arrêté ne fixe pas de terme » | **fait vérifié** | *INTERDIT sans terme* |
| « nous n'avons pas lu l'arrêté » | **doute** | *statut incertain* |

C'est le champ `confiance_dates`. Confondre les deux, c'est soit rassurer à tort, soit crier au loup.

**4. Une zone sans contour reste affichée.** Ne pas savoir dessiner un périmètre n'autorise pas à
taire l'interdiction.

**5. Jamais de correspondance devinée** entre un nom d'arrêté et un objet cartographique.

---

### 📁 Structure du projet

```
collectors/          — les collecteurs, un fichier par source
  _http.js           — lib HTTP : cache, backoff, disjoncteur anti-bannissement
  meteo-forets.js    — Météo des forêts, 96 départements, CSV data.gouv
  naviforest.js      — arrêtés permanents IGN + FCBA
  watch-prefectures.js — veille bornée des sites préfectoraux
  massifs-osm.js     — contours OSM via Overpass + polygons.openstreetmap.fr
data/                — registres curatés + sorties de collecte
  prefectures.json   — table des domaines préfectoraux
  massifs.json       — registre curaté nom d'arrêté → objet OSM (saisi à la main)
  zones-interdites.json — les interdictions qualifiées : quoi, de quand à quand
app/                 — le front, autonome
  index.html         — la page déployée
  index-collecteurs.html — l'app branchée sur data.js (repli)
  Feux - Vue principale.html — écran 1 du design, SVG 2.5D
  build-data.js      — embarque data/*.json dans app/data.js (CORS file://)
  feux-geo.js        — géométries projetées · feux-bulletin.js — niveaux (généré)
  robots.txt · .htaccess — déployés avec le POC
design/              — kit Claude Design : prompts, design system, données réelles
archive/             — le cas fondateur Fontainebleau, figé (arrêté, OCR, cartes)
skills/              — snapshots locaux des procédures (déploiement, wrap-up)
ops/scripts/         — helper de déploiement SFTP (aucun secret dedans)
```

---

### 🔄 Pipeline A → Z

```
┌──────────────────────────────────────────────────────────────┐
│  1. COLLECTE            npm run collect                      │
│                                                              │
│  meteo-forets.js   ──►  data/meteo-forets.json               │
│  naviforest.js     ──►  data/naviforest.json                 │
│  massifs-osm.js    ──►  app/massifs.geojson                  │
│  watch-prefectures ──►  data/veille-prefectures.json         │
│                              │                               │
│                              ▼                               │
│     ┌── QUALIFICATION HUMAINE ─────────────────────────┐    │
│     │  Le watcher signale une page « candidate ».      │    │
│     │  Un humain ouvre le PDF de l'arrêté :            │    │
│     │    · pdftotext → 32 octets (le PDF est scanné)   │    │
│     │    · Ghostscript 150 dpi → PNG → lecture vision  │    │
│     │    · relecture ligne à ligne contre le scan      │    │
│     │              ▼                                    │    │
│     │  data/zones-interdites.json  (saisi à la main)   │    │
│     │  + confiance_dates : verifiee | doute            │    │
│     └───────────────────────────────────────────────────┘    │
│                              │                               │
│  2. BUILD               node app/build-data.js               │
│                              │                               │
│         data/*.json  ──►  app/data.js  (window.POC)          │
│                              │                               │
│  3. AFFICHAGE           double-clic sur app/index.html       │
│                              ▼                               │
│     Statut recalculé à l'ouverture · péremption auto  ✅     │
└──────────────────────────────────────────────────────────────┘
```

> Le statut stocké dans le JSON est celui **constaté au relevé** : il vieillit. La page le recalcule
> à chaque ouverture, sinon elle afficherait une interdiction expirée comme si elle courait encore.

---

### 🧩 Le modèle « quoi, de quand à quand »

[`data/zones-interdites.json`](data/zones-interdites.json) répond à la seule question qui compte sur
le terrain. Le modèle est conçu pour la réalité des arrêtés, pas pour un cas idéal :

| Champ | Pourquoi il existe |
|---|---|
| `fin: null` + `fin_condition` | beaucoup d'arrêtés ne fixent **aucune date de fin** (ex. Trois Pignons : « jusqu'à la fin de la vigilance rouge canicule ») |
| `abroge_par` | une interdiction peut être levée en trois jours (Bavella : 17/07 → 20/07) |
| `derogations` | ce qui reste autorisé malgré l'interdiction — souvent l'info la plus utile |
| `confiance_dates` | distingue le **fait vérifié** du **doute** (cf. doctrine n°3) |
| `avertissement` | l'avertissement doctrinal, transporté dans la donnée elle-même |

---

### 🖥️ Le front — autonome par conception

**Pourquoi les données sont embarquées** : sur `file://`, CORS bloque la lecture des JSON locaux.
`node app/build-data.js` les injecte donc dans `app/data.js` (`window.POC`). La page marche en
double-clic, sans serveur, sans build, sans compte — comme [feux-foret-carte](https://github.com/molokoloco/feux-foret-carte).

Le sujet de la page, c'est **l'interdiction** — la météo n'est que le fond de carte :

- panneau **« Zones interdites »** en tête, trié par urgence : *INTERDIT* → *sans terme* →
  *statut incertain* → *levée* / *expirée*
- chaque zone affiche sa **période en clair**, son numéro d'arrêté, ses dérogations dépliables et un
  lien direct vers l'arrêté
- **contours de massifs** superposés en rouge, cliquables ; le fond départemental s'efface au zoom
- les zones **sans contour cartographiable** restent listées, avec la raison

#### Fonds de carte — IGN Géoplateforme, vectoriel, sans clé

L'**IGN sert les tuiles vectorielles PLAN.IGN en libre accès**, sans clé ni compte, avec
`Access-Control-Allow-Origin: *` — donc utilisable depuis `file://`. Quatre styles, tous vérifiés
en `200` le 26/07/2026 :

```
https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/{attenue|gris|classique|standard}.json
https://data.geopf.fr/tms/1.0.0/PLAN.IGN/{z}/{x}/{y}.pbf
```

**`attenue` est retenu par défaut** : désaturé, donc les massifs interdits en rouge ressortent, et
contrairement à un fond sombre on lit les **noms de forêts et les routes d'accès** — exactement
l'information dont a besoin quelqu'un qui vérifie s'il peut aller marcher. Il monte au **zoom 18**.

---

### 🕳️ Pièges déjà payés — ne pas les repayer

| Symptôme | Cause / remède |
|---|---|
| Overpass renvoie `406` | User-Agent générique type Mozilla → **UA descriptif obligatoire** |
| « Query timed out after 64 seconds » | regex de nom non bornée → borner par id ou bbox |
| Réponse XML au lieu de JSON | `overpass-api.de` saturé → bascule sur un miroir |
| Géométrie éclatée ou vide | **ne PAS recoller les anneaux soi-même** (81 anneaux incohérents pour Fontainebleau, zéro pour la Commanderie) → `polygons.openstreetmap.fr` assemble côté serveur |
| `pdftotext` rend 32 octets | le PDF est **scanné** → Ghostscript `-sDEVICE=png16m -r150` puis lecture visuelle |
| `fetch()` d'un JSON local échoue | CORS sur `file://` → données embarquées via `build-data.js` |
| `fitBounds` dézoome à ~4,5 au chargement | bug ouvert, contourné par un `setView` en dur — `fitBounds` déclenché par un clic fonctionne |

---

### 🏘️ Le voisin à connaître — feuxdeforet.fr

Site grand public de référence sur les feux **en cours**. Il ne fait **pas** le même métier, et il
vaut la peine de savoir où passe la frontière.

|  | feuxdeforet.fr | ce projet |
|---|---|---|
| Question traitée | **« où ça brûle maintenant »** | **« où je n'ai pas le droit d'aller aujourd'hui »** |
| Donnée | signalements citoyens modérés à la main | arrêtés préfectoraux + danger météo |
| Accès | API privée — `403` / `401` sans autorisation | ouvert |

Aucun recouvrement : le lien naturel est croisé, pas concurrent. Leur pipeline est d'ailleurs
**notre doctrine appliquée à un autre objet** — signalement citoyen, puis modération humaine, puis
publication. Audité le 26/07/2026, **non consommé** : scraper leur base reviendrait à siphonner un
travail communautaire. Si on veut ces données un jour, c'est par mail.

---

### ✅ État d'avancement — v0.3.0

- [x] Cartographie des sources (recherche documentée ci-dessus)
- [x] Collecteur Météo des forêts — **fonctionnel**, 96 départements, données du jour
- [x] Parseur NaviForest — **fonctionnel**, 27 arrêtés / 25 départements
- [x] Watcher préfectures — **fonctionnel** (28 trouvailles, 0 erreur), puis **durci** après bannissement
- [x] Disjoncteur anti-bannissement — testé sous blocage réel
- [x] **POC carto local** — Leaflet, 96 départements, données embarquées, double-clic
- [x] **Fond IGN Plan atténué** — vectoriel, sans clé, zoom 18
- [x] **Contours de massifs OSM** — Fontainebleau, Trois Pignons, Commanderie (204 / 16 / 34 polygones)
- [x] **Modèle « de quand à quand »** — périodes, dérogations, statut recalculé, abrogations
- [x] **Écran 1 en vanilla** — carte SVG 2.5D, 59 Ko, double-clic
- [x] **Mise en ligne** — [feux.julienweb.fr](https://feux.julienweb.fr), en `noindex`
- [ ] Fusion des sorties en un `arretes-forets-fr.json` unique et versionné
- [ ] Contours des massifs corses (Bavella, Illarata) — absents d'OSM, à tracer à la main
- [ ] Mini-API PHP + cron pour un rafraîchissement quotidien côté serveur
- [ ] Automatisation de la publication

---

### 📜 Sources & licences

**Code : [MIT](LICENSE).** Les **données** restent sous la licence de leur producteur — détail,
attribution et conséquences pratiques dans **[LICENSE-DONNEES.md](LICENSE-DONNEES.md)**.

| Donnée | Producteur | Licence |
|---|---|---|
| Contours de massifs | contributeurs OpenStreetMap | **ODbL** |
| Météo des forêts | Météo-France (data.gouv.fr) | **Licence Ouverte 2.0** |
| Fonds de carte PLAN.IGN | IGN / Géoplateforme | accès libre, attribution obligatoire |
| Arrêtés référencés | IGN + FCBA (NaviForest) | index non exhaustif |
| Textes des arrêtés | préfectures de département | documents administratifs publics |

---

### ⚠️ L'avertissement qui n'est pas négociable

> La **Météo des forêts** est un indicateur **indicatif et départemental**. Elle ne dit pas si un
> massif est ouvert ou fermé. Seul **l'arrêté préfectoral zonal** autorise ou interdit l'accès.

Des gens se font verbaliser chaque année à cause de cette confusion, et les amendes ne sont pas
symboliques. Tout affichage issu de ce projet doit porter l'avertissement de façon **aussi visible
que la donnée elle-même**. Les collecteurs le propagent déjà dans le JSON (champ `avertissement`) :
il n'est pas là pour décorer, et le retirer à l'affichage est un contresens.

---

### 🛡️ Disclaimer

> **Ce projet n'est pas officiel et ne remplace aucune publication préfectorale.**

En utilisant, copiant, forkant ou adaptant ce code, vous acceptez ce qui suit :

1. **Seul l'arrêté fait foi** — les données présentées ici sont une reconstruction à partir de
   sources publiques. En cas de divergence, de doute, ou tout simplement de zone limitrophe, c'est
   le texte de l'arrêté préfectoral publié qui s'applique, pas cette carte.

2. **Aucune garantie d'exhaustivité** — la couverture est partielle et le reste : NaviForest ne
   couvre que 25 départements sur 96, la veille ne suit que 10 départements, et une interdiction
   peut être publiée sans que ce projet la détecte. **L'absence d'arrêté affiché ne signifie pas
   que l'accès est autorisé.**

3. **Responsabilité personnelle** — vous êtes seul responsable de vos décisions d'accès à un massif
   forestier et de leurs conséquences, y compris pénales. L'auteur ne peut être tenu responsable
   d'une amende, d'un dommage ou d'un accident.

4. **Politesse de crawl** — si vous forkez les collecteurs, respectez les limites qui y sont
   codées. Elles ne sont pas prudentielles, elles sont **empiriques** : l'IP de ce projet a été
   bannie en deux minutes pour les avoir sous-estimées.

5. **Usage raisonnable** — ce dépôt est publié pour que d'autres puissent refaire l'exercice sur
   leur département, pas pour marteler les serveurs de l'État.

**TL;DR** — En cas de doute, lisez l'arrêté. Cette carte vous aide à le trouver, elle ne le remplace pas. 🌲

---

### 🤝 Contribuer & signaler

Une zone mal cartographiée, un arrêté manquant, une date fausse : ouvrez une
[issue](https://github.com/molokoloco/feux.julienweb.fr/issues). Sur ce sujet, une erreur de donnée
peut coûter une amende à quelqu'un — les corrections sont prioritaires.

Particulièrement bienvenus : les **contours de massifs corses** (Bavella, Illarata–Taglio Rosso),
absents d'OpenStreetMap et à tracer depuis les cartes annexées aux arrêtés.

> 🔐 Ce dépôt ne contient **aucun identifiant ni secret de déploiement**, par construction : la
> configuration de publication vit hors dépôt, et l'historique a été purgé le 28/07/2026 des détails
> d'infrastructure qui s'y étaient glissés.

---

### 👤 Auteur

**Julien Guézennec** — Développeur web freelance & consultant IA depuis 1998
🌐 [JulienWeb.fr](https://julienweb.fr) · 📍 Pantin (93), France · Activateur **France Num** certifié · référencé **Cyber.gouv.fr**

Studio web indépendant spécialisé en **développement WordPress**, **SEO/GEO local**,
**e-commerce**, **Google/Facebook Ads** et **formation numérique** pour artisans,
indépendants et TPE de **Seine-Saint-Denis** et du Grand Paris.

> 💡 Ce projet illustre une conviction de métier : **une information publique illisible est une
> information qui n'existe pas**. Les polygones des massifs sont publics depuis des années, les
> arrêtés sont des documents publics — il manquait juste que quelqu'un branche les deux.
> Besoin de rendre vos données exploitables ?
> 👉 [julienweb.fr/contacter-julienweb-fr](https://julienweb.fr/contacter-julienweb-fr/)

📬 Newsletter IA : **La Gueznet IA** — la veille hebdo sur l'IA appliquée au web et au commerce local.

---

<sub>Écrit à Pantin (93) avec ☕, Node.js et beaucoup de PDF scannés · © 2026 Julien Guézennec — JulienWeb.fr</sub>
