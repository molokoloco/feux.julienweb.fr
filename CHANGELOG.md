# Changelog

Toutes les versions notables de `feux.julienweb.fr`. Format inspiré de
[Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versionnage
[SemVer](https://semver.org/lang/fr/) — en `0.x`, l'API du JSON de sortie n'est pas encore stable.

**Où la version est écrite** : `package.json` est le **seul point de vérité**.
`node app/build-data.js` la recopie dans `app/data.js` et `app/feux-bulletin.js`, et les deux pages
l'affichent depuis là (barre de fenêtre + pied de page). Les `v0.3.0` en dur dans les HTML ne sont
qu'un filet si les fichiers générés manquent — **ne pas les maintenir à la main comme source**.

Les 0.1 et 0.2 sont reconstituées après coup depuis l'historique git de la session fondatrice
(26/07/2026) : elles n'ont jamais été taguées sur le moment.

---

## [0.3.0] — 2026-07-27

Première version **visiblement numérotée**, et première fois que le sous-domaine existe côté DNS.

### Ajouté
- **Version affichée dans les pages** : `feux.julienweb.fr v0.3.0` dans le pied du POC, badge dans
  la barre de fenêtre + pied de l'écran 1. Alimentée par `package.json` via `build-data.js`.
- **Écran 1 du design implémenté en vanilla** — carte SVG 2.5D (France extrudée par niveau de
  danger, massifs interdits en volume), 59 Ko, marche en double-clic (`ef3d017`).
- **Kit Claude Design** (`design/`) — prompt maître, design system importable, échantillon de
  données réelles généré depuis `data/`, inventaire skills/MCP (`9c76354`).
- **Fond de carte IGN Géoplateforme** — tuiles vectorielles PLAN.IGN, sans clé, style `attenue` par
  défaut, sélecteur de fond, zoom 18 (`9c76354`).
- **Archive du dossier fondateur Fontainebleau** dans `archive/2026-07_fontainebleau/` — PDF de
  l'arrêté 77, OCR relu, carte annexe ONF, infographie (`15e6e92`).
- `app/feux-bulletin.js` — 96 départements × 2 jours, 2 Ko, généré.

### Corrigé
- `feux-geo.js` livré par le design n'avait pas le champ `pts` que son propre code appelait : les
  flancs d'extrusion n'étaient jamais dessinés. Reconstruits en parsant les `d` (9 300 segments).

### Connu, non résolu
- `fitBounds` dézoome à ~zoom 4,5 au chargement du POC malgré `invalidateSize()` ; contourné par un
  `setView` en dur. Le même `fitBounds` déclenché par un clic fonctionne.
- Contours des massifs corses (Bavella, Illarata–Taglio Rosso) absents d'OSM — zones affichées sans
  géométrie, jamais devinées.
- Sorties des collecteurs pas encore fusionnées en un `arretes-forets-fr.json` unique.

### Déploiement
- `feux.julienweb.fr` **résout et répond `200`** (Apache/OVH), mais sa racine est **vide** : rien de
  ce dépôt n'est publié à ce jour. Aucun automatisme de publication.

### ⏰ Échéance
- L'arrêté 77 n°2026/CAB/SIDPC/1223 **expire le 31/07/2026**. Passé cette date, l'article #11311 et
  le repo `feux-foret-carte` affirment une interdiction qui n'existe plus. À traiter le jour même.

---

## [0.2.0] — 2026-07-26 *(reconstituée)*

L'interdiction devient le sujet de la page, pas la météo.

### Ajouté
- **Contours de massifs OSM** via registre curaté `data/massifs.json` — Fontainebleau (204
  polygones), Trois Pignons (16), Commanderie (34). Assemblage délégué à
  `polygons.openstreetmap.fr` (`558b352`).
- **Modèle « quoi, de quand à quand »** (`data/zones-interdites.json`) : `fin: null` +
  `fin_condition`, `abroge_par`, `derogations`, et surtout `confiance_dates` qui distingue
  « l'arrêté ne fixe pas de terme » (fait) de « nous n'avons pas lu l'arrêté » (doute) (`558b352`).
- Mise en page 3 colonnes — contexte à gauche, carte au centre, interdictions à droite (`2be6b36`).
- `HANDOFF.md` — récit figé de la session fondatrice (`d3653da`).

### Doctrine posée
- **Météo des forêts ≠ autorisation d'accès.** Seul l'arrêté préfectoral zonal est opposable ;
  l'avertissement est propagé dans le JSON et doit rester affiché.
- **L'automatisation s'arrête à la détection, la qualification reste humaine** — les dates sont dans
  des PDF scannés (`pdftotext` : 32 octets sur l'arrêté Illarata).
- **Une zone sans contour reste affichée.** Ne pas savoir dessiner un périmètre n'autorise pas à
  taire l'interdiction.
- **Jamais de correspondance devinée** entre un nom d'arrêté et un objet cartographique.

---

## [0.1.0] — 2026-07-26 *(reconstituée)*

Le socle : les données existent, elles sont collectables sans clé et sans se faire bannir.

### Ajouté
- `collectors/meteo-forets.js` — 96 départements, bulletin du jour, Licence Ouverte 2.0,
  **sans clé API** (l'archive annuelle est en fait rafraîchie quotidiennement) (`3913bd9`).
- `collectors/naviforest.js` — 27 arrêtés permanents, mais **25/96 départements** et le **77 vide** :
  c'est un index, pas une source de vérité (`3913bd9`).
- `collectors/watch-prefectures.js` — crawl borné des sites préfectoraux, état persistant,
  28 trouvailles / 0 erreur sur 10 départements (`3913bd9`, `36c4314`).
- `collectors/_http.js` — UA descriptif, séquentiel, backoff exponentiel, cache disque et
  **disjoncteur** (3 fermetures sèches → abandon du département avec diagnostic).
- POC carto Leaflet local, données embarquées dans `app/data.js` (`window.POC`) — CORS bloque
  `fetch()` sur `file://`, donc la page marche en double-clic (`6b9fa4f`).
- Brouillons de demande écrite : Valabre (accès massifs) et référent ReAcT (`mails/`).

### Leçon payée
- Premier watcher à 400 ms de pause sur 30 pages × 10 départements → **IP bannie en ~2 minutes**,
  sur *tous* les sites préfectoraux à la fois (plateforme mutualisée). Défauts ramenés à 8 pages,
  profondeur 2, 3 s de pause, 20 s entre départements. **Un département à la fois** (`--dep 33`).

---

## Comment publier une version

```bash
npm version minor --no-git-tag-version && node app/build-data.js
```

Puis mettre à jour ce fichier, `CLAUDE.md` (tableau d'état) et `README.md`, vérifier que la version
s'affiche bien dans les deux pages, et seulement ensuite :

```bash
git tag -a v0.3.0 -m "0.3.0 — <résumé>"
```
