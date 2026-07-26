# feux.julienweb.fr — arrêtés forêt & risque feu, en données exploitables

Généralisation nationale de [feux-foret-carte](https://github.com/molokoloco/feux-foret-carte)
(carte des massifs fermés autour de Fontainebleau, arrêté 77 n°2026/CAB/SIDPC/1223 du 24/07/2026).

**Objectif** : produire un flux JSON normalisé « où est-ce fermé, où est-ce dangereux », mis à jour
tout seul, et l'afficher sur une carte statique. Cible de déploiement : sous-domaine statique de
julienweb.fr (nom `feux.julienweb.fr` retenu par défaut, non déployé à ce jour — trivial à renommer).

---

## Le constat qui justifie ce projet

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

## Architecture — deux étages

### Étage 1 : socle national, zéro scraping

| Collecteur | Source | Ce qu'on obtient | Vérifié |
|---|---|---|---|
| `meteo-forets.js` | Météo-France via data.gouv | Danger feu J+1/J+2 par département, **96 départements**, Licence Ouverte 2.0, **sans clé API** | ✅ bulletin du jour |
| `naviforest.js` | [NaviForest](https://naviforest.ign.fr/arretes-prefectoraux-acces-massifs-forestiers) (IGN + FCBA) | Arrêtés permanents (emploi du feu, brûlage) + date de fin de validité | ⚠️ **25/96 départements** |

**La bonne surprise** : l'archive annuelle de la Météo des forêts
(`mdf_2026.csv.gz`) est présentée comme un historique, mais elle est **rafraîchie
quotidiennement** — dernière ligne = jour même, 14:50 UTC. C'est donc un vrai flux national
quotidien, gratuit et sans inscription. L'API temps réel du portail Météo-France (avec clé
applicative) devient inutile.

**La mauvaise surprise** : NaviForest ne couvre que 25 départements sur 96, et **le 77 est vide** —
l'arrêté Fontainebleau qui a lancé ce projet n'y figure pas. C'est un index, pas une source de
vérité. L'IGN décline d'ailleurs explicitement toute responsabilité sur les omissions.

### Étage 2 : événementiel, là où ça compte

`watch-prefectures.js` — crawl borné de la branche Actualités/Publications des sites préfectoraux,
filtré par mots-clés (forêt/massif/incendie + arrêté/interdiction/restriction), avec état persistant
pour ne signaler que le neuf.

Ce qui rend l'exercice tenable : **les 101 sites tournent sur le même CMS**.

| Endpoint | Statut |
|---|---|
| `/Actualites` | ✅ 200 sur les 10 départements testés |
| `/content/view/sitemap/2` | ✅ 200 (plan du site — rubriques seulement) |
| `/contenu/telechargement/<node>/<id>/file/<nom>.pdf` | ✅ format des PDF |
| `/rss.xml`, `/rss`, `/feed`, `/sitemap.xml`, `/robots.txt` | ❌ 404 |

Un adaptateur + une table de domaines, pas 101 scrapers. Départements suivis :
33, 40, 77, 83, 13, 30, 34, 66, 2A, 2B (cf. `data/prefectures.json`).

#### ⚠️ La plateforme préfectorale bannit vite — leçon payée le 26/07/2026

Premier jet du watcher : 400 ms de pause, 30 pages × 10 départements. **IP bannie en ~2 minutes.**
Signature : connexion acceptée puis fermée sèchement — `curl` renvoie `000` en 0,1 s, Node renvoie
`fetch failed` / `UND_ERR_SOCKET`. Le blocage frappe **tous les sites préfectoraux d'un coup**
(plateforme mutualisée), pendant que `naviforest.ign.fr` continuait de répondre 200 : c'est bien un
anti-crawl côté plateforme, pas une panne locale.

Corrections appliquées :

- défauts divisés : **8 pages, profondeur 2, 3 s de pause**, 20 s entre deux départements
- backoff exponentiel (3 s → 9 s → 27 s) au lieu de linéaire
- **disjoncteur** dans `_http.js` : à la 3ᵉ fermeture sèche sur un hôte, on abandonne ce département
  proprement avec un diagnostic, au lieu d'empiler 22 échecs identiques et d'allonger le bannissement
- `429` / `503` comptent aussi pour le disjoncteur

**Règle d'usage** : un département à la fois (`--dep 33`), pas les dix d'affilée. La veille se pense
en passages espacés (une fois par jour suffit largement pour un arrêté), pas en balayage.

### Voisin à connaître : feuxdeforet.fr (audité le 26/07/2026)

C'est le site grand public de référence sur les feux en cours. Il ne fait **pas** le même métier que
ce projet, et il vaut la peine de savoir précisément où passe la frontière.

**Architecture** — WordPress vitrine + plugin maison `fdf-bridge`, qui ne détient aucune donnée :
il **proxifie** une API Laravel privée hébergée ailleurs.

| Élément | Valeur |
|---|---|
| Backend réel | `https://fdfdata.fr/api/v1` (+ WebSockets Reverb pour le temps réel) |
| Proxy same-origin | `https://feuxdeforet.fr/fdf/<endpoint>` — *« évite CORS vers fdfdata.fr »* (leur commentaire) |
| Feux sur la carte | `GET /fdf/cartographie/geojson?scope=web` |
| Rendu | **MapLibre GL** |

Le GeoJSON : chaque feu est un `Point`, ou une `GeometryCollection` (point **+ polygone de
contour**). Propriétés `statut` (`douteux` · `probable` · `valide_publie` · `cloture`),
`etat` (`attaque` · `fixe` · `maitrise` · `eteint`), `contour_updated_at`, et `url`/`titre`
**seulement si le feu est validé** — un feu non confirmé n'expose que son id et ses coordonnées.
Bon réflexe éditorial, à reprendre.

**D'où vient leur donnée : de chez eux, à la main.** Aucune trace de FIRMS, EFFIS, Copernicus ou
VIIRS dans le JS chargé. Le pipeline est : signalement citoyen géolocalisé depuis l'app mobile
(`com.montardy.feuxdeforet`) → modération humaine (`moderation/schema`, `signalements/{id}/moderation`)
→ publication, avec une « main courante » horodatée par feu. Les `contour_updated_at` tombent sur
`07:30:00` / `20:30:00` : saisie humaine, pas cadence machine. **C'est notre doctrine appliquée à un
autre objet** — l'automatisation détecte, l'humain qualifie.

**Fermé, vérifié le 26/07/2026** — et donc hors de portée sans accord écrit :

```
/fdf/cartographie/geojson  → 403 {"code":"fdf_proxy_forbidden"}   (nonce WP lié à la session)
fdfdata.fr/api/v1/…        → 401 {"code":"unauthorized_client"}   (Bearer requis)
```

Scraper ça reviendrait à siphonner une base construite signalement par signalement par une
communauté. Si on veut ces données un jour, c'est par mail — même démarche que Valabre.

**Ouverts (200 sans auth)** : `/api/regions` (arbre régions → départements avec slugs) et
`/fdf-bridge/data/pelicandromes.json` (GeoJSON des pélicandromes).

**Ce qu'ils ne font pas** : les arrêtés, les fermetures de massifs, les périmètres réglementaires.
Leur propre page « Météo des forêts » énonce mot pour mot notre avertissement — Météo-France + ONF,
publication ~17 h pour J+1/J+2, *« ce n'est pas un arrêté d'interdiction, ce sont les préfectures qui
réglementent ou ferment »*. Ils font **« où ça brûle maintenant »**, on fait **« où je n'ai pas le
droit d'aller aujourd'hui »**. Aucun recouvrement : le lien naturel est croisé, pas concurrent.

### Étage 3 : sous conditions

`risque-prevention-incendie.fr` (Entente Valabre + préfectures méditerranéennes) publie le niveau
d'accès **quotidien par massif et ZAPEF** — la maille la plus fine qui existe. La page charge ses
données en asynchrone, donc un endpoint JSON existe. **On ne le tape pas sans autorisation** :
données à valeur réglementaire, interdiction pénalement sanctionnée. Demande écrite en attente
(cf. `mails/01-valabre-acces-massifs.md`).

---

## Commandes

```bash
node collectors/meteo-forets.js --fresh        # bulletin national du jour + 14 j d'historique
```

```bash
node collectors/naviforest.js --fresh          # arrêtés permanents par département
```

```bash
node collectors/watch-prefectures.js --dep 33  # veille sur UN département (recommandé)
```

Options communes : `--fresh` force le réseau (sinon cache disque 2-6 h).
Watcher : `--pages 8 --depth 2 --pause 3000 --pause-dep 20000` (défauts).
Ne pas remonter ces valeurs sans avoir lu l'encadré « bannissement » ci-dessous.

Sorties dans `data/` : `meteo-forets.json`, `naviforest.json`, `veille-prefectures.json`.

### Étage 4 : les contours de massifs, et ce qu'ils révèlent

`massifs-osm.js` récupère les contours depuis OpenStreetMap, à partir du registre curaté
`data/massifs.json`.

**Pourquoi curaté et pas automatique** : le nom d'un massif dans un arrêté ne correspond pas à un
objet OSM. Vérifié le 26/07/2026 — « massif de Bavella » et « massif d'Illarata » n'existent dans
OSM ni en relation ni en way (seulement un col, un village, des routes) ; les forêts voisines
s'appellent « Forêt Territoriale de Tova » et « Forêt de Valdu ». Une correspondance devinée par nom
produirait des contours faux sur un sujet où l'erreur vaut une amende. Un massif sans contour fiable
est donc **conservé sans géométrie** et affiché comme tel : ne pas savoir dessiner une zone
n'autorise pas à la taire.

Pièges Overpass, tous rencontrés :

| Symptôme | Cause / remède |
|---|---|
| `406` | User-Agent générique type Mozilla → UA descriptif obligatoire |
| « Query timed out after 64 seconds » | regex de nom non bornée géographiquement → borner par id ou bbox |
| Réponse XML au lieu de JSON | `overpass-api.de` saturé → bascule automatique sur miroir |
| Géométrie éclatée ou vide | ne PAS recoller les anneaux soi-même (81 anneaux incohérents pour Fontainebleau, zéro pour la Commanderie) → `polygons.openstreetmap.fr` assemble côté serveur |

### Interdictions : quoi, de quand à quand

`data/zones-interdites.json` répond à la seule question qui compte sur le terrain. Le modèle est
conçu pour la réalité des arrêtés, pas pour un cas idéal :

- `fin: null` + `fin_condition` — beaucoup d'arrêtés ne fixent **aucune date de fin**
  (ex. Trois Pignons : « jusqu'à la fin de la vigilance rouge canicule »)
- `abroge_par` — une interdiction peut être levée en trois jours (Bavella : 17/07 → 20/07)
- `derogations` — ce qui reste autorisé malgré l'interdiction, souvent l'info la plus utile
- `confiance_dates` — distingue **« l'arrêté ne fixe pas de terme »** (fait vérifié → *INTERDIT sans
  terme*) de **« nous n'avons pas lu l'arrêté »** (→ *statut incertain*). Ne jamais confondre les deux.

Le statut est **recalculé à l'ouverture de la page** : le champ `statut` du JSON est celui constaté
au relevé, il vieillit.

**Pourquoi le remplissage est manuel** : les dates ne sont pas sur la page d'actualité, elles sont
dans le PDF, et ces PDF sont scannés — `pdftotext` a rendu **32 octets** sur l'arrêté Illarata.
Lecture faite par rendu Ghostscript 150 dpi + vision, comme sur feux-foret-carte. Extraire une date
de fin d'un PDF scanné sans relecture humaine, quand une amende en dépend, n'est pas acceptable :
**l'automatisation s'arrête à la détection, la qualification reste humaine.**

### POC local

```bash
node app/build-data.js
```

Puis **double-clic sur `app/index.html`**. Aucun serveur, aucune dépendance à installer.

Le sujet de la page, c'est **l'interdiction** — la météo n'est que le fond de carte :

- panneau **« Zones interdites »** en tête, trié par urgence : *INTERDIT* → *sans terme* →
  *statut incertain* → *levée* / *expirée*
- chaque zone affiche sa **période en clair** (« du 24 au 31 juillet 2026 inclus · encore 5 jours »,
  « depuis le 17 juillet 2026 — aucune date de fin dans l'arrêté »), son numéro d'arrêté, ses
  dérogations dépliables, et un lien direct vers l'arrêté
- **contours de massifs** superposés en rouge, cliquables ; bouton *Zoomer sur les zones interdites*
- le fond départemental **s'efface au zoom** pour ne pas masquer les massifs
- les zones **sans contour cartographiable** restent listées, avec la raison

Sous le panneau : détail départemental au survol (niveaux J+1/J+2, arrêtés NaviForest, trouvailles
de veille) et indicateurs de couverture des sources.

#### Fonds de carte — IGN Géoplateforme, vecteur, sans clé

Piste rapportée de l'audit de feuxdeforet.fr : l'**IGN sert les tuiles vectorielles PLAN.IGN en
libre accès**, sans clé ni compte ni inscription, avec `Access-Control-Allow-Origin: *` — donc
utilisable depuis `file://`. Quatre styles prêts à l'emploi, tous vérifiés en `200` le 26/07/2026 :

```
https://data.geopf.fr/annexes/ressources/vectorTiles/styles/PLAN.IGN/{attenue|gris|classique|standard}.json
https://data.geopf.fr/tms/1.0.0/PLAN.IGN/{z}/{x}/{y}.pbf
```

Le style est autoporté (glyphes et sprites également sur `data.geopf.fr`), 425 couches.
**`attenue` est retenu par défaut** : désaturé, donc les massifs interdits en rouge ressortent, et
contrairement au fond CARTO sombre on lit les **noms de forêts et les routes d'accès** — exactement
l'information dont a besoin quelqu'un qui vérifie s'il peut aller marcher. Il monte au **zoom 18**
là où CARTO plafonnait à 12, ce qui rend enfin lisible un périmètre de massif.

Rendu dans Leaflet via `maplibre-gl` + `@maplibre/maplibre-gl-leaflet` (deux CDN, chargés de façon
non bloquante : si l'un tombe, la page retombe seule sur CARTO). Un sélecteur de fond en haut à
droite laisse basculer entre les deux.

⚠️ **On tape data.geopf.fr en direct, jamais `tiles.fdfdata.fr`.** feuxdeforet.fr réécrit toutes les
URL IGN vers son propre cache — c'est leur bande passante, pas un CDN public. Le style « transparent »
qu'ils exposent n'est d'ailleurs rien d'autre que PLAN.IGN avec la couche de fond retirée, pour le
superposer à l'ortho-photo : reproductible en trois lignes à partir de la source IGN.

Même parti pris que `feux-foret-carte` : les données sont **embarquées** dans `app/data.js`
(`window.POC`) plutôt que chargées en `fetch()` — sur `file://`, CORS bloque la lecture des JSON
locaux. Régénérer `data.js` après chaque collecte.

---

## L'avertissement qui n'est pas négociable

La **Météo des forêts** est un indicateur **indicatif et départemental**. Elle ne dit pas si un
massif est ouvert ou fermé. Seul **l'arrêté préfectoral zonal** autorise ou interdit l'accès.

Des gens se font verbaliser chaque année à cause de cette confusion, et les amendes ne sont pas
symboliques. Tout affichage issu de ce projet doit porter l'avertissement de façon aussi visible que
la donnée elle-même. Les collecteurs le propagent déjà dans le JSON (champ `avertissement`) :
il n'est pas là pour décorer.

---

## État d'avancement

- [x] Cartographie des sources (recherche documentée ci-dessus)
- [x] Collecteur Météo des forêts — **fonctionnel, données du jour**
- [x] Parseur NaviForest — **fonctionnel**, 27 arrêtés / 25 départements
- [x] Watcher préfectures — **fonctionnel** (a trouvé « Vigilance ORANGE feu de forêt reconduite en
      Gironde » du 16/07/2026), puis **durci** après bannissement de l'IP. Le passage sur les 10
      départements reste à rejouer une fois le blocage retombé
- [x] Disjoncteur anti-bannissement (`_http.js`) — testé sous blocage réel
- [x] Brouillons de demande : Valabre + référent ReAcT
- [x] **POC carto local** — Leaflet, 96 départements, données embarquées, marche en double-clic
- [x] **Fond IGN Plan atténué** (vecteur, Géoplateforme, sans clé) — sélecteur de fond, zoom 18,
      noms de forêts et routes d'accès enfin lisibles sous le périmètre d'interdiction
- [x] **Contours de massifs OSM** — Fontainebleau, Trois Pignons, Commanderie (204 / 16 / 34 polygones)
- [x] **Modèle « de quand à quand »** — périodes, dérogations, statut recalculé, abrogations
- [x] **Kit Claude Design** (`design/`) — prompt maître, design system importable, échantillon de
      données réelles généré depuis `data/`, inventaire skills/MCP. Rien de maquetté à ce jour
- [ ] Contours des massifs corses (Bavella, Illarata–Taglio Rosso) : absents d'OSM, à tracer depuis
      les cartes annexées aux arrêtés — c'est le même travail manuel que pour Fontainebleau
- [ ] Fusion des sorties en un `arretes-forets-fr.json` unique et versionné
- [ ] Cadrage carte : `fitBounds` dézoome à ~zoom 4,5 même après `invalidateSize()`, alors que la
      bbox du GeoJSON est saine. Contourné par un `setView` en dur. À élucider si le front se durcit
- [ ] Automatisation quotidienne + déploiement sous-domaine
- [ ] Scaling : à reconsidérer seulement si le trafic l'impose (machine dédiée OVH)

---

## Sources & licences

- Météo des forêts — Météo-France, [archives sur data.gouv.fr](https://www.data.gouv.fr/datasets/archives-de-la-meteo-des-forets), Licence Ouverte 2.0
- NaviForest — [IGN + FCBA](https://naviforest.ign.fr/arretes-prefectoraux-acces-massifs-forestiers)
- Arrêtés préfectoraux — sites `<departement>.gouv.fr`, seul l'arrêté publié fait foi
- Précédent VigiEau — [API](https://github.com/MTES-MCT/vigieau-api) · [dataset](https://www.data.gouv.fr/datasets/donnee-secheresse-vigieau)
- ReAcT — [fiche beta.gouv.fr](https://beta.gouv.fr/startups/re-ac-t.html)
- Contours : © contributeurs [OpenStreetMap](https://www.openstreetmap.org/copyright), ODbL
- Fond de carte — © IGN / [Géoplateforme](https://data.geopf.fr), tuiles vectorielles PLAN.IGN,
  accès libre sans clé (attribution obligatoire)
- feuxdeforet.fr — site tiers **audité, non consommé** : API privée, `403`/`401` sans autorisation

Code : MIT. **Ce projet n'est pas officiel** et ne remplace aucune publication préfectorale.
