# Feux de forêt 2026 — Carte des forêts fermées au public

> Projet créé le 2026-07-26. Point de départ : les forêts de Fontainebleau sont fermées
> suite aux incendies de juillet 2026, et la seule info publique est un arrêté préfectoral
> en PDF scanné avec une carte illisible. On refait une carte lisible, on aide les gens,
> et on voit grand ensuite.

## Vision (validée 2026-07-26)

Il n'existe **aucune source centralisée** des forêts interdites au public suite aux
incendies : chaque préfecture publie son arrêté en PDF dans son coin. Le projet comble
ce trou, en escalier :

1. **MVP Fontainebleau** — carte Leaflet lisible (polygones OSM réels) + infographie PNG
2. **Article julienweb.fr** — « Forêt de Fontainebleau fermée : la carte enfin lisible » + carte interactive hébergée sur julienweb.fr
3. **Gironde + temps réel** — arrêtés préfecture 33 + couche feux actifs (Copernicus EFFIS / NASA FIRMS)
4. **France entière** — pipeline de veille des arrêtés préfectoraux → base → carte nationale. Nom de domaine dédié SEULEMENT si cette étape se déclenche (décision actée : pas d'achat avant).

## Faits — arrêté n°2026/CAB/SIDPC/1223 (préfecture 77)

Source : [sources/2026-07-24_arrete-77-2026_CAB_SIDPC_1223.pdf](sources/2026-07-24_arrete-77-2026_CAB_SIDPC_1223.pdf) — PDF scanné, OCR vision 2026-07-26. Détail : [sources/arrete-77-1223_EXTRAIT.md](sources/arrete-77-1223_EXTRAIT.md)

- Signé le **24 juillet 2026** à Melun par le préfet Pierre Ory, sur proposition de l'ONF. Abroge l'arrêté n°1193 du 17 juillet 2026 (la fermeture date donc d'au moins le 17/07).
- **Fermées au public : forêts domaniales de Fontainebleau et de la Commanderie**, dans tout le département 77, **jusqu'au 31 juillet 2026 inclus**.
- Interdiction valable routes forestières, sentiers de randonnée et intérieur de toutes les parcelles.
- Exceptions : secours, forces de l'ordre, opérateurs réseaux, transporteurs d'intérêt général, propriétaires/entreprises forestières mandatées, habitants de parcelles enclavées.
- La carte annexée (ONF, Scan25 IGN) montre 3 massifs : Fontainebleau (vert), **Trois-Pignons** (violet), Commanderie (orange) — mais l'article 1er ne nomme que Fontainebleau + Commanderie. Trois-Pignons déborde sur l'Essonne (91) → vérifier s'il existe un arrêté 91 jumeau.

### ⚠️ Point clé (contre-intuitif)

La fermeture LÉGALE actuelle s'arrête au **31/07/2026** — pas « un an ou deux ».
Le « un an ou deux » entendu sur place concerne probablement les travaux de sécurisation
(arbres brûlés en racine → chutes) qui donneront lieu à de NOUVEAUX arrêtés de
prolongation, massif par massif. **À surveiller : la page actualités de la préfecture 77
autour du 31/07/2026** — c'est exactement la valeur du projet (personne ne suit ça).

- Page préfecture : https://www.seine-et-marne.gouv.fr/ (rechercher SIDPC / forêts)
- Contexte perso : fils (17 ans) à Paris du 29/07 au ~10-12/08 → si pas de prolongation, réouverture possible dès le 1er août.

## Structure

```
Feux-de-foret-2026/
├── README.md        ← ce fichier (vision + faits + roadmap)
├── sources/         ← PDF arrêtés + extraits OCR (immuable, sourcé)
├── carte/           ← GeoJSON massifs (OSM) + carte Leaflet + exports PNG
└── notes/           ← notes de session
```

## Roadmap / état

- [x] Projet créé, arrêté 77 téléchargé + OCR (2026-07-26)
- [x] Polygones OSM des 3 massifs (Overpass → polygons.openstreetmap.fr → GeoJSON) : Fontainebleau rel 3236785, Commanderie rel 3253740, Trois-Pignons rel 16615234 (2026-07-26)
- [x] Carte Leaflet `carte/index.html` (autonome : GeoJSON embarqués dans `data.js`, marche en double-clic) + aperçu `carte/apercu-2026-07-26.png` (2026-07-26). Piège corrigé : `setView` obligatoire AVANT d'ajouter les calques vectoriels, sinon crash silencieux du renderer.
- [ ] Infographie PNG via `/brand-card`
- [ ] Vérifier arrêté jumeau Essonne (Trois-Pignons côté 91)
- [ ] 31/07 : vérifier prolongation ou réouverture → MAJ carte
- [ ] Article julienweb (`/write-article`) + hébergement carte sur julienweb.fr
- [ ] Étape 3 Gironde (arrêtés 33 + EFFIS/FIRMS temps réel)
- [ ] Étape 4 France entière (si 1-3 concluantes)
