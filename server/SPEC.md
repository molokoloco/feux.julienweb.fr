# SPEC — mini-API PHP + cron pour feux.julienweb.fr

Cible : hébergement mutualisé OVH, Apache + PHP 8.x, docroot `<docroot>/`.
**Pas de Node sur le serveur.** Hébergement et **IP publique partagés avec julienweb.fr**.

Version de la spec : 2026-07-28. Écrite hors dépôt (réécriture d'historique en cours).

---

## 1. Analyse de risque — le bannissement d'IP, traité en premier

### Ce qui s'est déjà passé

Le 26/07/2026, un crawl à 400 ms de pause sur 30 pages × 10 sites préfectoraux a fait
**bannir l'IP en ~2 minutes**. Le blocage était *de plateforme* : tous les `*.gouv.fr`
d'un coup, connexion acceptée puis fermée sèchement, pendant que `naviforest.ign.fr`
répondait toujours 200. Levée au bout de ~6 minutes.

### Ce que ça coûterait depuis le serveur

L'incident local a coûté six minutes de gêne sur une machine de développement. Le même
incident depuis `<racine-du-compte>/` n'a pas la même facture :

1. **L'IP sortante du mutualisé est celle de julienweb.fr**, le site professionnel de
   Julien — et elle est *aussi* celle de quelques centaines d'autres clients OVH.
   L'incident cesse d'être privé.
2. **Le canal de plainte est l'abuse OVH.** Un service de l'État qui signale un crawl
   abusif ne mail pas le développeur : il mail l'hébergeur, qui répercute au titulaire du
   compte. On échange un fichier JSON contre un dossier abuse au nom de l'entreprise.
3. **Réputation d'IP = délivrabilité mail.** Le même hébergement expédie le courrier
   client de julienweb.fr. Une IP mutualisée qui se fait cataloguer « crawler » finit sur
   des listes de réputation qui ne discriminent pas le port 25 du port 443.
4. **Les CGU du mutualisé** proscrivent l'usage de l'hébergement comme robot d'aspiration.
   Ce n'est pas une zone grise, c'est écrit.
5. **On serait aveugle.** Pas de shell, pas de logs sortants, pas de `curl` de diagnostic.
   Le disjoncteur de `collectors/_http.js` a été écrit *parce qu'on pouvait observer*
   `UND_ERR_SOCKET` en direct. Sur mutualisé, un ban se manifesterait par… un JSON qui
   ne bouge plus.
6. **Et surtout : le gain serait nul.** La veille préfectorale ne produit pas de donnée
   publiable. Elle produit des *candidats* qu'un humain doit ouvrir, lire (PDF scannés,
   Ghostscript + lecture visuelle) et qualifier avant qu'une date entre dans un JSON —
   doctrine n°2 du projet. Automatiser la détection côté serveur ne raccourcirait aucune
   boucle : il faudrait quand même que Julien lise les arrêtés depuis son poste.
   Le watcher a aussi un état (`data/.veille-state.json`) et un disjoncteur par hôte, deux
   choses qui n'ont pas de sens dupliquées sur un mutualisé.

### Verdict

> **Aucun site préfectoral (`*.gouv.fr` départemental) n'est jamais interrogé depuis le
> serveur. Ni maintenant, ni « juste pour tester », ni derrière un flag.**
> La règle est inscrite en tête de `cron.php` et matérialisée par la liste blanche d'hôtes
> `Feux::HOSTS_OK` : une URL préfectorale est refusée par le code avant même d'être ouverte.

### Répartition des sources

| Source | Où | Pourquoi |
|---|---|---|
| **Météo-France — CSV `mdf_AAAA.csv.gz`** (`meteofrance.s3.sbg.io.cloud.ovh.net`) | **serveur** | Stockage objet S3, dimensionné pour du téléchargement en masse, Licence Ouverte 2.0, rafraîchi quotidiennement. 1 requête/jour. C'est même du S3 **OVH Strasbourg** : trafic interne au réseau de l'hébergeur. Aucun risque. |
| **data.gouv.fr — API dataset** (résolution de l'URL du CSV) | **serveur** | API publique documentée, 1 appel/jour, en cache conditionnel. Repli sur l'URL S3 connue si elle est muette. |
| **NaviForest (IGN + FCBA)** — 1 page HTML | **serveur, sous conditions** | Site institutionnel IGN, **plateforme distincte** de celle qui a banni (il répondait 200 pendant l'incident). 1 requête/jour, en `If-None-Match` / `If-Modified-Since` : les jours sans changement, zéro octet transféré. C'est du *scraping* de HTML, donc surveillé : si l'IGN commence à renvoyer 403/429, le disjoncteur est le retrait pur et simple de la source (une ligne dans `Feux::UPSTREAM`). |
| **Sites préfectoraux** (`watch-prefectures.js`) | **local uniquement** | Cf. ci-dessus. Interdit côté serveur. |
| **OSM / Overpass / polygons.openstreetmap.fr** (`massifs-osm.js`) | **local uniquement** | Géométries lourdes, assemblage côté serveur tiers, UA sensible (406), et surtout : ça ne bouge quasiment jamais. `massifs.geojson` est un asset statique déployé, pas un flux. |
| **Valabre** (`risque-prevention-incendie.fr`) | **nulle part** | Endpoint non documenté, données à valeur réglementaire. Gelé tant que `mails/01-valabre-acces-massifs.md` n'a pas de réponse. Absent de la liste blanche. |
| **`zones-interdites.json`** (zones qualifiées à la main) | **local uniquement** | Par construction : c'est le produit d'une lecture humaine de PDF scannés. |

---

## 2. Architecture retenue

Deux producteurs, un seul fichier public. La frontière suit exactement la frontière du
risque : **ce qui demande un jugement humain ou un crawl impoli est figé en local et
poussé par SFTP ; ce qui est un téléchargement poli de donnée ouverte tourne sur le
serveur.**

```
POSTE LOCAL (Node)                          SERVEUR OVH (PHP, pas de Node)
──────────────────────────────────          ──────────────────────────────────────────
watch-prefectures.js  ─┐                     cron.php  (CLI, 1×/jour, 06:20)
massifs-osm.js        ─┤                        │
[lecture humaine PDF] ─┤                        ├── GET data.gouv API ──┐
                       ▼                        ├── GET mdf_2026.csv.gz ┤  liste blanche
              zones-interdites.json             ├── GET naviforest      ┘  d'hôtes
              massifs.json                      │
              veille-prefectures.json           ├── lit data/socle.json  (jamais écrit)
                       │                        ├── valide (fail closed)
              ops/build-socle.js                ├── fusionne
                       ▼                        ▼
              data/socle.json ══ SFTP ═══▶  data/arretes.json   (temp + rename)
                                                    │
                                                    ▼
                                            Apache (statique, gzip, ETag)
                                                    │
                                    fetch('data/arretes.json')  ← le front
                                                    │ échec (file://, 503, hors-ligne)
                                                    ▼
                                            données embarquées (window.POC)
```

### Le socle

`data/socle.json` porte tout ce que le serveur n'a **pas le droit** de produire :
zones qualifiées, registre des massifs, veille, textes d'avertissement, version.
Il est produit par `ops/build-socle.js` sur le poste de Julien et poussé par SFTP.

- **PHP ne l'écrit jamais.** Il le lit, le valide, s'en sert.
- Il est **interdit d'accès public** par le `.htaccess` : le contrat public, c'est
  `arretes.json`, un seul fichier, pour ne pas avoir deux vérités en ligne.
- S'il manque ou s'il est invalide → **`cron.php` refuse de publier** et laisse
  `arretes.json` intact. Fail closed, jamais fail open.

### Dossier privé, hors docroot

```
<dossier-prive>/            (frère du docroot, inaccessible par HTTP)
├── feux.log                    (journal détaillé, rotation à 1 Mo)
└── var/
    ├── cron.lock               (flock)
    ├── derniere-frappe         (horodatage pour la limitation de débit)
    ├── snap-mdf.json           (dernier résultat normalisé — repli si l'amont tombe)
    ├── snap-navi.json
    └── cache/                  (corps amont + ETag/Last-Modified pour les 304)
```

Surchargeable par `FEUX_PRIVATE_DIR`. Par défaut : `dirname(docroot) . '/.feux'`.

---

## 3. Fichier statique ou script PHP ? — tranché : **fichier statique**

Julien penchait pour le statique. C'est le bon choix, et pour des raisons plus fortes
que la performance.

1. **Zéro PHP dans le chemin critique.** Sur un mutualisé, PHP est la ressource rare
   (workers partagés, `max_children` opaque, coupures de pool). Apache servant un fichier
   depuis le disque est ce qui casse en dernier. Le jour où l'article #11311 remonte et
   amène du trafic, un `readfile()` par visiteur est un point de rupture gratuit.
2. **Surface d'attaque nulle par construction.** L'exigence « aucune entrée utilisateur
   ne touche le système de fichiers » devient triviale quand *il n'y a pas d'entrée* :
   pas de query string, pas de code exécuté par requête visiteur.
3. **Apache fait déjà tout, mieux.** `mod_deflate`, `ETag`, `Last-Modified`, `304`,
   `Range`, `stale-if-error`. Réimplémenter ça en PHP, c'est le réimplémenter à moitié.
4. **Cohérence avec la doctrine du projet.** La page marche en double-clic sur `file://`
   avec ses données embarquées. Un fichier JSON posé à côté, c'est le même objet servi
   par un autre canal — pas un système différent.
5. **Réutilisabilité.** L'ambition affichée est un flux national normalisé. Un fichier
   statique sous URL stable, cacheable et CORS-ouvert *est* le format d'un flux ouvert.

**Conséquence pratique : `api.php` n'est pas le chemin nominal.** Il est fourni, mais pour
deux usages où le fichier ne suffit pas :

- `?dep=NN` — vue filtrée sur un département (tiers réutilisateur, future page `/33`) ;
- `?meta=1` — entête seul (fraîcheur, dégradations) pour une sonde de supervision.

Le front, lui, ne l'appelle jamais. Si `api.php` était supprimé demain, le site
fonctionnerait à l'identique. C'est le test de « hors chemin critique ».

---

## 4. Contrat de l'endpoint

### `GET /data/arretes.json` — le contrat

Nom **figé**. Le front fait `fetch('data/arretes.json')` et **retombe silencieusement**
sur ses données embarquées en cas d'échec (y compris sur `file://`, où la requête est
bloquée par CORS — comportement attendu, pas une panne).

Les clés reprennent volontairement celles de `window.POC` produit par `app/build-data.js`
(`mdf`, `navi`, `interdits`, `veille`) : le repli embarqué et le flux réseau ont la même
forme, le front n'a qu'un seul chemin de lecture.

```jsonc
{
  "version": "0.3.0",
  "genere_le": "2026-07-28T06:20:11+00:00",   // UTC, ISO 8601
  "genere_par": "cron.php",
  "socle_genere_le": "2026-07-27T22:10:04.117Z",

  // DOCTRINE — recopié verbatim du socle. Ne jamais retirer, ne jamais reformuler.
  "avertissement": "La Météo des forêts est un indicateur … seul l'arrêté préfectoral …",

  "mdf": {                                     // null si la source est tombée sans repli
    "bulletin_du": "2026-07-28",
    "bulletin": [ { "departement": "01", "nom": "Ain",
                    "j1": { "niveau": 2, "libelle": "modéré", "couleur": "jaune" },
                    "j2": { … } } ],
    "stats": { "departements": 96, "departements_niveau_3_ou_4_j1": 7, … },
    "licence": "lov2", "producteur": "Météo-France — Météo des forêts",
    "fichier_amont": "https://meteofrance.s3.sbg.io.cloud.ovh.net/…",
    "avertissement": "Indicateur météorologique INDICATIF …"
  },

  "navi": {
    "departements": [ { "departement": "01", "nom": "AIN",
                        "arretes": [ { "fichier": "…pdf", "url": "…",
                                       "validite_texte": "Valide jusqu'au 31-12-2026",
                                       "valide_jusqu_au": "2026-12-31" } ] } ],
    "stats": { "arretes_total": 27, "departements_avec_arrete": 25, … },
    "avertissement": "Index non officiel …"
  },

  "interdits": [ {
      // ── recopie INTÉGRALE de zones-interdites.json, champ par champ ──
      "massif": "illarata", "portee": "massif", "departement": "2A",
      "debut": "2026-07-17", "fin": null, "fin_condition": null,
      "statut": "en_vigueur",              // valeur CONSTATÉE par un humain à releve_le
      "confiance_dates": "verifiee",       // JAMAIS retiré, JAMAIS simplifié
      "arrete": "2A-2026-07-20-00007 …", "source": "https://…pdf",
      "releve_le": "2026-07-26", "derogations": [ … ], "note": "…"
      // ── AUCUN ajout du serveur : recopie stricte du socle humain ──
  } ],

  "massifs": { … },                            // registre curaté, verbatim du socle
  "veille":  { "stats": {…}, "departements": [ … ] },

  "degradations": [ { "source": "navi", "raison": "amont indisponible",
                      "repli_du": "2026-07-27T06:20:03+00:00" } ],
  "frais": false                               // true ⟺ degradations === []
}
```

### Zéro déduction serveur — arbitrage tranché le 28/07/2026

Une première version ajoutait un champ `statut_calcule` : le serveur comparait la date
de fin saisie par un humain à l'horloge et annotait chaque zone, sans jamais toucher au
`statut` constaté. **Retiré.**

Motif : **le front recalcule déjà le statut à chaque ouverture de page.** C'est la
doctrine du projet et c'est implémenté depuis la v0.3. Porter la même règle ici en
aurait fait deux implémentations, dans deux langages, d'un calcul dont le résultat
conditionne une amende. Le jour où l'une évolue sans l'autre, la page et le flux se
contredisent sur « ce massif est-il fermé ? » — et rien ne dit laquelle a raison.

Le serveur transporte donc les zones **telles que l'humain les a saisies** : `statut`,
`releve_le`, `debut`, `fin`, `fin_condition`, `confiance_dates`, `abroge_par`. Le
consommateur tranche. C'est aussi ce qui rend le flux réutilisable : un tiers applique
sa propre règle sur des faits bruts, pas sur notre interprétation des faits.

L'échéance du 31/07/2026 (Fontainebleau, Commanderie) reste donc gérée **côté front**,
là où elle l'était déjà. C'est le bon endroit : c'est là que le lecteur voit la réponse.

> Si ce calcul devait un jour revenir côté serveur, il faudrait d'abord **retirer**
> celui du front — pas l'ajouter à côté.

### `GET /api.php` — secondaire

| Paramètre | Valeurs acceptées | Effet |
|---|---|---|
| *(aucun)* | — | passe-plat brut de `arretes.json` (`readfile`) |
| `dep` | `01`–`95`, `2A`, `2B`, `971`–`976` — **liste blanche par regex**, puis vérification d'existence dans les données | vue filtrée, `avertissement` et `confiance_dates` conservés intégralement |
| `meta` | `1` | entête seul : version, fraîcheur, dégradations, stats |

Codes : `200`, `304`, `400 {"erreur":"parametre"}`, `405`, `503 {"erreur":"indisponible"}`.
Aucun message ne contient de chemin, de nom de fichier serveur, ni de trace.

---

## 5. Politique de cache

| Ressource | En-têtes | Raison |
|---|---|---|
| `data/arretes.json` | `public, max-age=900, stale-while-revalidate=3600, stale-if-error=86400` + `ETag` + `Last-Modified` (Apache) | Le bulletin Météo des forêts sort une fois par jour vers 17 h. 15 min de fraîcheur suffisent largement. `stale-if-error` est le point important : si PHP, le cron ou l'amont tombent, les caches intermédiaires continuent de servir la dernière version valide pendant 24 h plutôt que d'afficher une carte vide. |
| `*.geojson` | `public, max-age=604800` | Géométries produites à la main, elles ne bougent qu'à la main. |
| `*.js` (`data.js`, `feux-bulletin.js`) | `max-age=3600` | Régénérés à chaque collecte. |
| `*.html` | `no-cache, must-revalidate` | La page porte le n° de version affiché. |
| `api.php` | `public, max-age=900` + `ETag` (mtime+taille+params) | Aligné sur le fichier statique. |

**Cache amont** (côté cron, invisible du visiteur) : `If-None-Match` / `If-Modified-Since`
sur chaque source, corps mis en cache dans `<dossier-prive>/var/cache/`. Un 304 côté
NaviForest = zéro octet transféré. C'est la politesse de crawl transposée au serveur.

**Limitation de débit du cron** : plancher de **3600 s** entre deux frappes amont
(`CRON_INTERVAL_MIN`). Rappelé plus tôt → le script sort immédiatement en laissant
`arretes.json` en place. `--force` existe, **en CLI seulement**.

---

## 6. Sécurité — ce qui est implémenté, point par point

| Exigence | Implémentation |
|---|---|
| PHP moderne, sans Composer | `declare(strict_types=1)` dans les 3 fichiers, zéro dépendance |
| Aucune entrée utilisateur vers le FS | Un seul chemin lu : la constante `Feux::OUT`. `dep` sert uniquement de clé de comparaison en mémoire, après regex de liste blanche **et** vérification d'existence. `?dep[]=` rejeté par `is_string`. |
| Pas d'`eval` / `include` dynamique / `shell_exec` / désérialisation | Aucun. `json_decode` partout, `unserialize` nulle part. |
| `cron.php` non déclenchable par un anonyme | **CLI-only, sans exception.** Le déclencheur web et son secret ont été supprimés le 28/07/2026 : un secret qui n'existe pas ne fuit pas, et le cron OVH sait exécuter en CLI. Toute requête HTTP → **404 muet** (pas 403 : aucun oracle sur l'existence du fichier). Doublé d'un `Require all denied` Apache. |
| Pas de SSRF | URLs amont en dur (`Feux::UPSTREAM`) + liste blanche d'hôtes (`Feux::HOSTS_OK`) vérifiée **avant** la requête, **sur l'URL résolue depuis data.gouv** (c'est de la donnée distante, donc suspecte) et **après redirections** sur l'URL effective. `https` imposé sur la requête initiale et sur les redirections, 3 sauts max. |
| Limitation de débit / garde-fou | Plancher de 1 h, verrou `flock(LOCK_EX|LOCK_NB)`, une seule tentative par source et par passage (pas de retry en boucle : c'est justement ce qui aggrave un ban). Le budget temps « mode web » a disparu avec le mode web. |
| Messages publics muets | `Feux::erreurPublique()` renvoie `{"erreur":"<code court>"}`. `display_errors=0`, `set_error_handler` avale tout, `set_exception_handler` + `register_shutdown_function` (fatals) journalisent **hors docroot**. |
| `avertissement` et `confiance_dates` propagés | `Feux::assertSocleValide()` **refuse de publier** si l'avertissement global manque, si une zone n'a pas de `confiance_dates`, ou si sa valeur est hors nomenclature (`verifiee`/`partielle`/`inconnue`). Les zones sont recopiées intégralement, y compris `derogations` et `note`, **même dans la vue filtrée par département**. |
| Aucune date déduite | Le serveur ne lit aucun PDF, ne fait aucun OCR, n'extrait aucune date. `valide_jusqu_au` de NaviForest est la **recopie** d'une date imprimée sur la page amont. Depuis le 28/07/2026, le serveur ne calcule même plus de statut : il recopie ce que l'humain a saisi et laisse le front trancher (§ 4). |

**Garde-fous supplémentaires** : plafond de téléchargement 12 Mo avec coupure en vol,
décompression gzip **en flux** plafonnée à 64 Mo (`gzdecode()` alloue tout d'un coup — une
archive piégée ferait tomber le process), `lib/feux.php` refuse d'être appelé en direct
(`FEUX_BOOT`) **et** est bloqué par Apache, écriture atomique (temporaire dans le même
dossier + `fsync` + `rename`) : un visiteur ne lit jamais un JSON tronqué.

---

## 7. Installation

### Arborescence

```
<docroot>/                 (docroot)
├── index.html                      (existant)
├── .htaccess                       ← app/.htaccess (fusion déjà faite au dépôt)
├── api.php                         ← nouveau (secondaire)
├── cron.php                        ← nouveau
├── lib/feux.php                    ← nouveau
└── data/
    ├── socle.json                  ← poussé par SFTP, non servi publiquement
    └── arretes.json                ← produit par cron.php, LE contrat public

<dossier-prive>/                (hors docroot — à créer)
├── feux.log
└── var/
```

### Mise en place

```bash
# 1. côté local : produire et pousser le socle
node ops/build-socle.js
node ops/scripts/_sftp_op.js --target=feux put data/socle.json

# 2. côté local : pousser le .htaccess durci AVANT les scripts.
#    L'ordre compte : refuser l'accès à un fichier absent est sans effet,
#    refuser l'accès à un fichier déjà en ligne est trop tard.
node ops/scripts/_sftp_op.js --target=feux put app/.htaccess

# 3. côté local : pousser les fichiers PHP (depuis server/)
node ops/scripts/_sftp_op.js --target=feux put server/api.php
node ops/scripts/_sftp_op.js --target=feux put server/cron.php
node ops/scripts/_sftp_op.js --target=feux mkdir lib
node ops/scripts/_sftp_op.js --target=feux put server/lib/feux.php

# 4. premier passage (le dossier privé se crée tout seul)
#    via le cron OVH, ou par SSH si l'offre l'inclut :
/usr/local/php8.3/bin/php <docroot>/cron.php --force
```

### Cron OVH

Une seule tâche, **une fois par jour**. La Météo des forêts est publiée vers 17 h ;
un passage matinal donne le bulletin du jour, un passage vespéral le rafraîchit.
Le strict nécessaire :

| | |
|---|---|
| Commande | `/usr/local/php8.3/bin/php <docroot>/cron.php` |
| Langage | PHP 8.3 **CLI** |
| Fréquence | `20 6 * * *` (06:20). Optionnel : un second passage `20 18 * * *`. |

> Ajouter des passages ne sert à rien : « un arrêté ne sort pas toutes les heures ».
> Le plancher de 1 h annule de toute façon les appels rapprochés.

### Vérification

```bash
curl -sI "https://feux.julienweb.fr/data/arretes.json"        # 200, Last-Modified récent
curl -s  "https://feux.julienweb.fr/data/arretes.json" | head -c 400
curl -s  "https://feux.julienweb.fr/api.php?meta=1"           # fraîcheur + dégradations
curl -sI "https://feux.julienweb.fr/cron.php"                 # attendu : 403/404, jamais 200
curl -sI "https://feux.julienweb.fr/data/socle.json"          # attendu : 403
curl -sI "https://feux.julienweb.fr/lib/feux.php"             # attendu : 404
```

**Aucun de ces `curl` ne prouve que le site marche.** Un `200` sur un JSON tronqué est un
`200` parfaitement satisfaisant. Vérifier la carte dans un navigateur, console ouverte.

### Rythme d'exploitation

| Quand | Quoi | Où |
|---|---|---|
| chaque jour, automatique | Météo des forêts + NaviForest → `arretes.json` | serveur |
| quand Julien s'y met | `npm run veille` (un département à la fois), lecture des PDF, mise à jour de `zones-interdites.json`, `build-socle.js`, push SFTP | local |
| au besoin | `massifs-osm.js` + push des `.geojson` | local |

---

## 8. Arbitrages — tranchés le 28/07/2026

1. **`statut_calcule` : jeté.** Le front recalcule déjà le statut à l'ouverture ; deux
   implémentations de la même règle, dans deux langages, sur un champ qui conditionne une
   amende, c'est une dérive garantie. `Feux::annoterStatut()` a été supprimée, les zones
   sont recopiées telles quelles. Cf § 4.
2. **NaviForest depuis le serveur : gardé.** 1 requête/jour en conditionnel. L'IGN n'est pas
   la plateforme qui a banni — elle répondait `200` pendant le blocage du 26/07. C'est le
   seul point de la répartition où le risque n'est pas strictement nul ; le retrait coûte
   une ligne si on change d'avis.
3. **Le flux est public : assumé.** Le `.htaccess` ouvre le CORS sur `arretes.json`. Le
   `noindex` protège la *page*, pas la donnée, et un flux national réutilisable est
   l'objectif affiché du projet — le fermer contredirait le README, qui invite à forker.
4. **Déclencheur web du cron : supprimé**, secret compris. CLI uniquement. À ne pas
   rouvrir « pour dépanner » : si le besoin se présente, ça se décide dans `cron.php`.
5. **`php -l` : reste à jouer.** PHP n'est pas installé sur le poste de Julien
   (`php: command not found`) : les fichiers ont été relus à la main, l'équilibrage des
   blocs vérifié, mais le linter n'a pas tourné. **À faire au premier passage CLI sur le
   serveur, avant d'activer le cron.** C'est le seul point non vérifié du lot.

6. **Échéance 31/07/2026** — hors périmètre de cette spec, mais elle la croise : l'arrêté 77
   expire, et l'article #11311 comme le repo `feux-foret-carte` affirmeront une interdiction
   qui n'existe plus. La chaîne décrite ici ne les corrige pas.
