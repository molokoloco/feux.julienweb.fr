# CLAUDE.md — feux.julienweb.fr

Généralisation nationale de la carte des massifs forestiers fermés.
Créé le 26/07/2026 depuis [Julienweb.fr](../Julienweb.fr/CLAUDE.md) (article #11311 + repo
`molokoloco/feux-foret-carte`).

> **Ce fichier = l'état vivant du projet.** Le récit détaillé de la session fondatrice
> (ce qui a été cherché, trouvé, cassé, pourquoi) vit dans [HANDOFF.md](HANDOFF.md), daté et figé.
> Le paysage des sources et les commandes vivent dans [README.md](README.md).
> Mettre à jour CE fichier à chaque session ; ne jamais réécrire HANDOFF.md.

**Version courante : `0.3.0`** — taguée `v0.3.0` le 27/07/2026. Historique et procédure de release :
[CHANGELOG.md](CHANGELOG.md). La version vit dans `package.json` et **nulle part ailleurs à la
main** : `node app/build-data.js` la recopie dans `app/data.js` + `app/feux-bulletin.js`, les deux
pages l'affichent depuis là. Les `v0.3.0` en dur dans les HTML sont des filets, pas la source.

**Nature** : site statique sur le sous-domaine `feux.julienweb.fr`, **en ligne depuis le 27/07/2026**
en `noindex`. Pas de WordPress. Statique d'abord, React seulement si l'interactivité le justifie.
Scaling (machine dédiée OVH) volontairement repoussé : on le traite si le trafic arrive.

**Dépôt public depuis le 28/07/2026** : <https://github.com/molokoloco/feux.julienweb.fr>, licence
MIT ([LICENSE](LICENSE) ; les licences de données vivent à part dans
[LICENSE-DONNEES.md](LICENSE-DONNEES.md) — GitHub ne détecte la licence que si `LICENSE` contient le
texte canonique **et rien d'autre**). Conséquence permanente sur la façon
d'écrire ici — voir 🔒 dans « Mise en ligne » : **aucun identifiant, nom de cluster ou chemin absolu
de docroot ne doit réapparaître dans un fichier versionné.**

## Frontière avec les projets voisins

| Projet | Rôle |
|---|---|
| `Julienweb.fr/` | studio, blog, SEO, CRM — l'**article** #11311 et le SEO-TRACKER vivent là-bas |
| `feux-foret-carte/` | repo public GitHub, carte **Fontainebleau** figée sur l'arrêté 77 de juillet 2026 |
| **ce projet** | **collecte nationale** + flux normalisé + carte multi-départements |

Ne pas fusionner avec `feux-foret-carte` : il raconte un cas précis (un arrêté, un PDF scanné
illisible, une carte reconstruite) cité par l'article. Il reste tel quel.

Le dossier de travail d'origine `_Claude/Projects/Feux-de-foret-2026/` a été **archivé ici le
27/07/2026** : son matériau (PDF de l'arrêté 77, OCR relu, carte annexe ONF, infographie de
l'article) vit dans [archive/2026-07_fontainebleau/](archive/2026-07_fontainebleau/_ARCHIVE.md),
immuable. Le dossier d'origine n'existe plus.

⏰ **Échéance 31/07/2026** : l'arrêté 77 expire. Passé cette date, l'article #11311 **et** le repo
`feux-foret-carte` affirment une interdiction qui n'existe plus. Sujet de sécurité, préfecture citée
nommément — à corriger le jour même.

## État au 27/07/2026 — v0.3.0, 10 commits, tout tourne

| Brique | État |
|---|---|
| `collectors/meteo-forets.js` | ✅ 96 départements, bulletin du jour, sans clé API |
| `collectors/naviforest.js` | ✅ 27 arrêtés — mais **25/96 départements**, et le **77 est vide** |
| `collectors/watch-prefectures.js` | ✅ 10 départements, **28 trouvailles, 0 erreur** |
| `collectors/massifs-osm.js` | ✅ Fontainebleau (204 polygones), Trois Pignons (16), Commanderie (34) |
| `data/zones-interdites.json` | ✅ 6 zones qualifiées à la main, sourcées |
| `app/index.html` | ✅ POC 3 colonnes, marche en **double-clic**, sans serveur — fond IGN + sélecteur de fond |
| `app/Feux - Vue principale.html` | ✅ écran 1 du design, carte SVG 2.5D, 59 Ko, **double-clic** |
| `app/feux-bulletin.js` | ✅ 96 départements × 2 jours, 2 Ko, généré par `build-data.js` (porte la version) |
| `design/` | ✅ kit Claude Design — prompt, design system importable, données réelles, skills |

`npm run collect` enchaîne tout et régénère le POC.

**Prochaine étape** : fusionner les sorties en un `arretes-forets-fr.json` unique et versionné.
Puis : contours des massifs corses (à tracer à la main), automatisation quotidienne, déploiement.

## Piste v2 — webapp 3D (kit prêt, rien de lancé)

`design/` contient de quoi attaquer une refonte 3D via **claude.ai/design** : `PROMPT-CLAUDE-DESIGN.md`
(prompt maître), `DESIGN-SYSTEM-FEUX.md` (tokens à importer, dérivés de la charte terminal
JulienWeb), `DONNEES-REELLES.json` (extrait généré depuis `data/`, aucune valeur inventée),
`SKILLS-ET-MCP.md` (skills vérifiés + verdict sur l'écosystème Three.js).

Parti pris retenu : **globe → plongée sur la France → France extrudée par niveau de danger**, massifs
interdits en volume par-dessus. Implémentation cible React Three Fiber — ce qui contredit le
« statique d'abord » ci-dessus, donc **à arbitrer avant d'écrire la moindre ligne**.

**Arbitrage tranché le 26/07/2026 pour l'écran 1** : pas de React Three Fiber, pas de WebGL. La
plongée et l'extrusion sont rendues en **SVG 2.5D** (faces translatées de `-h/cos(tangage)`, flancs
reconstruits depuis les contours, une seule `scale(1, cos θ)`). 59 Ko contre 690 Ko pour l'export
bundlé du design, et la page marche toujours en double-clic. Le parti pris visuel est tenu sans
renier le « statique d'abord ». À reprendre tel quel pour les écrans suivants — sauf besoin
démontré, pas d'exception.

Trois faits vérifiés le 26/07/2026, à ne pas re-chercher :
- **aucun MCP Three.js n'existe** (registre : 0 résultat) — ce qui circule sont des skills tiers ;
- Claude Design **n'a pas de sélecteur de skills** : ce qui s'active, c'est l'import de design
  system, les pièces jointes, les exports et le handoff Claude Code ;
- il **brûle le quota très vite** (~80 % d'un quota Pro hebdo en 25 min pour 3 variations d'une
  page) → un écran à la fois.

L'outil `DesignSync` de Claude Code peut pousser le design system directement dans claude.ai/design,
mais demande une autorisation interactive du scope design.

## V0.4 en cours — circuit de design inversé (acté le 28/07/2026)

**Le circuit « maquette React → réimplémentation vanilla à la main » est abandonné.** Claude Design
édite désormais **directement `app/Feux - Vue principale.html`**, et ce fichier est le livrable
déployé. Motif : toute modification faite dans le `.dc.html` devait être reportée à la main dans le
vanilla — dérive garantie, travail payé deux fois. On perd les panneaux de réglages live de
l'éditeur ; on gagne zéro réimplémentation et zéro bundle de 690 Ko. Le
`design/Feux - Vue principale (autonome).html` reste comme **archive** de l'écran 1.

Prompt V0.4 prêt à coller : [design/PROMPT-CLAUDE-DESIGN-V04.md](design/PROMPT-CLAUDE-DESIGN-V04.md)
(le [prompt V1](design/PROMPT-CLAUDE-DESIGN.md) reste en archive, il n'est pas remplacé).

Décisions de cadrage prises avec ce prompt, à ne pas re-arbitrer :

| Question | Tranché |
|---|---|
| Échelle visée | **20 à 40 arrêtés** simultanés, pas 6 — la colonne de droite est redécoupée en « en vigueur » / « levées » repliées |
| Cible | **Mobile primaire** — la réponse (carte + statut) visible sans scroll sur téléphone |
| Cadre « fausse fenêtre Mac » | **Supprimé**, le contenu occupe la vraie page |
| Endpoint temps réel | **`data/arretes.json`, nom figé.** Le front tente `fetch()` et retombe **silencieusement** sur les données embarquées si ça échoue — la page doit continuer à marcher en double-clic sur `file://` |
| Monétisation | placeholder pub neutre, **jamais entre la question et la réponse** |

**Contenu de la page** : le bloc explicatif de bas de page est distillé de l'article #11311 et du
brouillon Reddit (`Julienweb.fr/content/`). En reprendre l'**argument**, jamais les paragraphes :
dupliquer le texte entre `julienweb.fr` et `feux.julienweb.fr` créerait du contenu dupliqué entre
deux domaines qu'on contrôle. L'article porte le SEO grand public, ce site porte l'outil ; les deux
se citent.

**Chantier séparé, en parallèle** : mini-API PHP + cron OVH servant `data/arretes.json`. Contrainte
qui domine tout le reste — **Node n'existe pas sur le mutualisé**, et surtout un cron qui crawlerait
les sites préfectoraux depuis l'IP OVH ferait bannir **l'IP partagée avec julienweb.fr** (cf.
« Politesse de crawl »). La collecte préfectorale reste donc locale ; seules les sources stables
(CSV Météo-France, IGN) sont candidates à un rafraîchissement serveur.

## Mini-API PHP + cron — écrite et testée le 28/07/2026, pas encore déployée

Vit dans [server/](server/SPEC.md). **Deux producteurs, un seul fichier public** :

- **poste local (Node)** → `npm run socle` produit `data/socle.json` : zones qualifiées à la main,
  registre des massifs, veille préfectorale, avertissements. Poussé par SFTP. **PHP ne l'écrit
  jamais**, il le lit, le valide *fail closed* et refuse de publier s'il est incomplet ;
- **serveur (PHP, 1×/jour, CLI)** → `server/cron.php` télécharge les deux seules sources autorisées,
  fusionne avec le socle et écrit `data/arretes.json` de façon atomique (temporaire + `rename`) ;
- **Apache** sert `data/arretes.json` en statique. Zéro PHP dans le chemin critique.

**Aucun site préfectoral n'est jamais interrogé depuis le serveur** — liste blanche d'hôtes qui
refuse l'URL avant de l'ouvrir. Le bannissement du 26/07 a coûté 6 minutes en local ; depuis l'IP
OVH, il coûterait un dossier abuse au nom de l'entreprise et la réputation de l'IP qui expédie le
courrier client de julienweb.fr. Et le gain serait nul : la veille produit des *candidats* qu'un
humain doit lire, pas de la donnée publiable.

Arbitrages tranchés, à ne pas re-arbitrer :

| Question | Tranché |
|---|---|
| `statut_calcule` côté serveur | **Jeté.** Le front recalcule déjà le statut à l'ouverture. Deux implémentations de la même règle, dans deux langages, sur un champ qui conditionne une amende = dérive garantie |
| NaviForest depuis le serveur | **Gardé**, 1 req/jour en conditionnel. L'IGN répondait `200` pendant le blocage du 26/07. Retrait = une ligne |
| CORS ouvert sur `arretes.json` | **Assumé.** Le `noindex` protège la page, pas la donnée ; le flux réutilisable est l'objectif affiché |
| Déclencheur web du cron | **Supprimé**, secret compris. CLI uniquement. Un secret qui n'existe pas ne fuit pas |

**Vérifié en local le 28/07** : `php -l` passe sur les trois fichiers, et un passage complet a produit
un `arretes.json` de 53 Ko — bulletin du jour sur 96 départements, 30 arrêtés, 0 dégradation, les 6
zones avec `confiance_dates` et `avertissement` intacts, et **aucun** `statut_calcule`.
PHP n'est pas au PATH : le binaire utilisé est celui de Local by Flywheel
(`~/AppData/Roaming/Local/lightning-services/php-8.2.27+1/bin/win64/php.exe`), à lancer avec
`-d extension=php_curl.dll -d extension=php_openssl.dll -d curl.cainfo=<bundle CA de Git>` — sans
quoi il échoue sur la vérification du certificat. **Le code refuse alors de publier plutôt que de
désactiver la vérification** : c'est voulu, ne pas le « corriger ».

⚠️ Le `.htaccess` durci se pousse **avant** les fichiers PHP. Refuser l'accès à un fichier absent est
sans effet ; le refuser à un fichier déjà en ligne est trop tard.

## Doctrine — ce qui n'est pas négociable

**1. Météo des forêts ≠ autorisation d'accès.** Indicateur *indicatif*, *départemental*. Seul
l'**arrêté préfectoral zonal** est opposable. L'avertissement doit être aussi visible que la donnée ;
les collecteurs le propagent dans le JSON (`avertissement`), ne pas le retirer à l'affichage.
Des gens se font verbaliser chaque année à cause de cette confusion.

**2. L'automatisation s'arrête à la détection, la qualification reste humaine.** Les dates ne sont
pas sur les pages, elles sont dans des PDF **scannés**. Extraire une date de fin par OCR sans
relecture, quand une amende en dépend, n'est pas acceptable.

**3. Ne jamais confondre ces deux cas :**
- « l'arrêté ne fixe pas de terme » = **fait vérifié** → *INTERDIT sans terme*
- « nous n'avons pas lu l'arrêté » = **doute** → *statut incertain*

C'est le champ `confiance_dates`. Confondre les deux, c'est soit rassurer à tort, soit crier au loup.

**4. Une zone sans contour reste affichée.** Ne pas savoir dessiner un périmètre n'autorise pas à
taire l'interdiction.

**5. Jamais de correspondance devinée entre un nom d'arrêté et un objet cartographique.** Voir
« pièges » ci-dessous : ça produit des contours faux sur un sujet pénalement sanctionné.

## Politesse de crawl — on s'est déjà fait bannir

**26/07/2026** : crawl à 400 ms de pause sur 30 pages × 10 départements → **IP bannie en ~2 minutes**.
Connexion acceptée puis fermée sèchement (`curl` → `000` en 0,1 s ; Node → `UND_ERR_SOCKET`), sur
**tous** les sites préfectoraux à la fois, alors que `naviforest.ign.fr` répondait toujours 200.
Anti-crawl de plateforme mutualisée, pas panne locale. Le ban est tombé au bout de ~6 minutes.

`collectors/_http.js` impose : UA descriptif et joignable, séquentiel, backoff exponentiel, cache
disque, **disjoncteur** (3 fermetures sèches → abandon du département avec diagnostic).
Défauts du watcher : 8 pages, profondeur 2, 3 s de pause, 20 s entre départements.

- **Un département à la fois** (`--dep 33`). Pas les dix d'affilée.
- Ne pas paralléliser, ne pas remonter les compteurs « pour tester plus vite ».
- Un arrêté ne sort pas toutes les heures : un passage par jour suffit.
- `000` → attendre des dizaines de minutes. Insister allonge le ban.
- **Astuce** : `WebFetch` lit les pages `.gouv.fr` **sans entamer le quota de l'IP locale**.

**Valabre** (`risque-prevention-incendie.fr`) : ne **pas** requêter l'endpoint non documenté tant que
`mails/01-valabre-acces-massifs.md` n'a pas eu de réponse. Données à valeur réglementaire.

## Pièges déjà payés — ne pas les repayer

**Sites préfectoraux**
- `/rss.xml`, `/rss`, `/feed`, `/sitemap.xml`, `/robots.txt` → **404**. Le crawl est la seule voie.
- `/Actualites` et `/content/view/sitemap/2` → **200 partout**. PDF en
  `/contenu/telechargement/<node>/<id>/file/<nom>.pdf`. Même CMS → un adaptateur, pas 101 scrapers.

**OpenStreetMap / Overpass**
- Le nom d'un massif dans un arrêté **ne correspond pas** à un objet OSM : « Bavella » et
  « Illarata » n'existent ni en relation ni en way (seulement un col, un village, des routes).
  → registre curaté `data/massifs.json`, correspondance saisie à la main.
- **Ne pas recoller les anneaux soi-même** : un assemblage maison a donné 81 anneaux incohérents
  pour Fontainebleau et **zéro** pour la Commanderie. → `polygons.openstreetmap.fr` assemble
  côté serveur. Overpass sert à *chercher*, pas à *assembler*.
- UA générique → `406`. Regex de nom non bornée → timeout à 64 s. Réponse XML au lieu de JSON →
  serveur saturé, basculer sur un miroir.

**PDF d'arrêtés**
- Ils sont **scannés** : `pdftotext` a rendu **32 octets** sur l'arrêté Illarata.
- `pdftoppm` **n'est pas installé** sur cette machine → l'outil `Read` échoue sur les PDF.
- Pipeline qui marche : `"/c/Program Files/gs/gs10.07.1/bin/gswin64c" -sDEVICE=png16m -r150` puis
  lecture visuelle des PNG. Même méthode que sur feux-foret-carte.

**POC / front**
- `fetch()` de JSON locaux est bloqué par **CORS sur `file://`** → données embarquées dans
  `app/data.js` (`window.POC`) via `node app/build-data.js`. La page marche en double-clic.
- `.claude/launch.json` **refuse toute cible hors racine projet** → pas de dev server, et c'est
  très bien : le POC est autonome.
- ⚠️ **Bug ouvert** : `fitBounds` au chargement dézoome à ~zoom 4,5 malgré `invalidateSize()`, alors
  que la bbox du GeoJSON est saine (lon -5,1→9,6 · lat 41,4→51,1). Contourné par `setView` en dur.
  `fitBounds` déclenché par un clic utilisateur fonctionne, lui, très bien.
- L'export bundlé de claude.ai/design pèse **690 Ko** (React + ReactDOM + runtime `x-dc`) pour un
  écran. Il sert de **référence visuelle**, jamais de livrable : on réimplémente en vanilla.
- `feux-geo.js` livré par le design ne contient **pas** le champ `pts` que son propre code appelle
  (`skirt(d.pts, …)`) : les flancs d'extrusion n'étaient jamais dessinés. Ils sont reconstruits en
  parsant les `d` (M/L/Z uniquement, 9 300 segments) — ne pas « corriger » ça en le resupprimant.

## Structure

```
collectors/  _http.js (lib + disjoncteur) · meteo-forets.js · naviforest.js
             massifs-osm.js · watch-prefectures.js
data/        prefectures.json · massifs.json · zones-interdites.json (+ sorties)
app/         index.html (POC Leaflet) · Feux - Vue principale.html (écran 1, SVG 2.5D)
             build-data.js · departements.geojson · massifs.geojson
             feux-geo.js (géométries projetées) · feux-bulletin.js (niveaux, généré)
             robots.txt · .htaccess (déployés avec le POC)
ops/         build-socle.js (produit data/socle.json, la part HUMAINE du flux)
             scripts/_sftp_op.js (déploiement SFTP — aucun secret dedans)
server/      mini-API PHP — SPEC.md · cron.php (CLI seul) · api.php · lib/feux.php
mails/       2 brouillons — à relire et ENVOYER par Julien, rien n'est parti (HORS DÉPÔT)
skills/      snapshots locaux des skills globaux (index README.md)
```

`app/data.js` est **gitignoré** (~1,4 Mo régénéré à chaque collecte).

## Mise en ligne — https://feux.julienweb.fr

**En ligne depuis le 27/07/2026, en `noindex`** : visible pour qui a l'URL, absent des moteurs.
Hébergement mutualisé OVH, le même que julienweb.fr.

🔒 **Ce dépôt est public depuis le 28/07/2026.** Ne jamais y réécrire le nom du cluster, l'utilisateur
SFTP ni le chemin absolu du docroot : ils ont été purgés du dépôt *et de son historique* ce jour-là,
précisément parce qu'ils constituent une cible de force brute sur un compte qui voit **tout**
l'hébergement, julienweb.fr compris. Ces valeurs se lisent dans le `.deploy-ftp.json` hors dépôt.

⚠️ **Ce qui est en ligne depuis le 27/07 au soir, c'est la maquette Claude Design, pas l'app
branchée sur les collecteurs.** Arbitrage de Julien : « c'est pas une vraie prod, on écrase ».

| Fichier | Rôle |
|---|---|
| `app/index.html` | **déployé** — export Claude Design « Vue principale (autonome) », React bundlé, **données figées dans le fichier** (arrêtés du 23–24/07) |
| `app/index-collecteurs.html` | l'app vanilla précédente, branchée sur `data.js` — **conservée pour revenir en arrière** |
| `design/Feux - Vue principale (autonome).html` | l'export d'origine, intact |

Revenir à l'app branchée : `cp app/index-collecteurs.html app/index.html` puis redéployer.

```bash
npm run poc                                              # régénérer app/data.js AVANT
node ops/scripts/_sftp_op.js --target=feux preset poc    # déployer
```

Trois choses à ne pas oublier :

- **La maquette n'utilise pas `data.js`.** Le preset le pousse encore — inoffensif, et utile le jour
  où on rebascule. Mais tant que la maquette est en ligne, **`npm run poc` ne change rien à ce que
  voit le visiteur** : ses données sont dans le HTML.
- **`app/data.js` est gitignoré mais doit être déployé** quand l'app branchée est en ligne. Un clone
  frais ne l'a pas ; déployer sans `npm run poc` publierait un bulletin périmé.
- **Le `noindex` tient en trois pièces cohérentes** — `<meta robots>`, `X-Robots-Tag` dans
  `.htaccess`, et un `robots.txt` qui **autorise** le crawl. Le dernier point est délibéré : bloquer
  le crawl empêcherait les robots de lire le noindex. Pour publier pour de bon, retirer les deux
  premiers, pas le troisième.
  ⚠️ **Piège propre à la maquette** : le bundler réécrit tout le document au chargement et efface le
  `<head>` du fichier. Une balise `<meta robots>` posée dans le `<head>` extérieur **disparaît du
  DOM**. Elle doit être injectée dans le `<script type="__bundler/template">`. Constaté et corrigé le
  27/07 — c'est l'en-tête HTTP du `.htaccess` qui protégeait entre-temps.

Détail, pièges et procédure de vérification : [skills/deploy-ftp-feux/SKILL.md](skills/deploy-ftp-feux/SKILL.md).
Les credentials vivent dans la config partagée `../Julienweb.fr-public/.deploy-ftp.json` — **jamais
dans ce dépôt**.

## Skills locaux

`/wrap-up` → **lire [skills/wrap-up/SKILL.md](skills/wrap-up/SKILL.md) et suivre celui-là**, pas le
global : le snapshot local fige les chemins, remplace l'étape Wiki par la frontière avec les projets
voisins, et ajoute une **étape 3f « Vérité des données »** non-skippable (échéance 31/07,
`confiance_dates`, avertissement météo, correspondances OSM). Il pose aussi deux garde-fous :
le wrap-up ne lance **jamais** de collecte, et aucune date d'arrêté n'entre dans un JSON sans
lecture humaine du PDF. Index : [skills/README.md](skills/README.md).

## En attente de Julien

- Envoyer `mails/01-valabre-acces-massifs.md` (conditions de réutilisation des données d'accès)
- Envoyer `mails/02-react-betagouv.md` (code source de ReAcT — destinataire dans le frontmatter)
- Arbitrer le 31/07 sur l'article #11311 et le repo `feux-foret-carte`

> `mails/` est **hors dépôt depuis le 28/07/2026** (gitignoré, purgé de l'historique) : ce sont des
> brouillons non envoyés adressés à des tiers nommés. Ils restent sur le disque.
