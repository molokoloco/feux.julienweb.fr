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
- [ ] Fusion des 3 sorties en un `arretes-forets-fr.json` unique et versionné
- [ ] Géométries : contours de massifs (OSM/Overpass comme sur feux-foret-carte, ou BD TOPO IGN)
- [ ] Front carto (statique Leaflet d'abord ; React seulement si l'interactivité le justifie)
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

Code : MIT. **Ce projet n'est pas officiel** et ne remplace aucune publication préfectorale.
