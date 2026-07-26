# CLAUDE.md — feux.julienweb.fr

Projet dédié : généralisation nationale de la carte des massifs forestiers fermés.
Créé le 26/07/2026, issu du projet [Julienweb.fr](../Julienweb.fr/CLAUDE.md) (article #11311 +
repo `molokoloco/feux-foret-carte`).

**Nature** : site statique déployé sur un sous-domaine de julienweb.fr (nom retenu par défaut :
`feux.julienweb.fr`, non déployé — renommage trivial tant que rien n'est en ligne).
Pas de WordPress. Front en statique d'abord ; React seulement si l'interactivité le justifie.
Question du scaling (machine dédiée OVH) volontairement repoussée : on la traite si le trafic arrive.

## Frontière avec les projets voisins

| Projet | Rôle |
|---|---|
| `Julienweb.fr/` | studio, blog, SEO, CRM — c'est là que vit l'**article** #11311 et le suivi SEO-TRACKER |
| `feux-foret-carte/` | repo public GitHub, carte **Fontainebleau** figée sur l'arrêté 77 de juillet 2026 |
| **ce projet** | **collecte nationale** + flux normalisé + carte multi-départements |

Ne pas fusionner avec `feux-foret-carte` : ce repo raconte une histoire précise (un arrêté, un PDF
scanné illisible, une carte reconstruite) qui est citée par l'article. Il reste tel quel.

## Ce qui a été établi le 26/07/2026 (ne pas re-chercher)

- **Aucun flux national d'arrêtés préfectoraux n'existe.** ReAcT (beta.gouv.fr), qui visait
  exactement ça, a été **arrêté le 26/08/2025**, code source non publié.
- Sur les sites préfectoraux : `/rss.xml`, `/rss`, `/feed`, `/sitemap.xml`, `/robots.txt` → **404**.
  Vérifié sur 33, 40, 77, 83. Le crawl est la seule voie.
- `/Actualites` et `/content/view/sitemap/2` répondent **200 sur les 10 sites testés** → endpoints
  communs exploitables. PDF en `/contenu/telechargement/<node>/<id>/file/<nom>.pdf`.
- L'archive `mdf_2026.csv.gz` de la Météo des forêts est **rafraîchie quotidiennement** (pas un
  historique figé) → flux national sans clé API. L'API à clé du portail Météo-France est inutile.
- NaviForest couvre **25/96 départements** et **rate le 77**. Index, pas source de vérité.

## Règle éditoriale non négociable

Météo des forêts = **indicatif, départemental**. L'accès aux massifs est réglementé par l'**arrêté
préfectoral zonal**, seul opposable. Tout affichage doit porter l'avertissement aussi visiblement
que la donnée. Les collecteurs le propagent dans le JSON (`avertissement`) — ne pas le retirer à
l'affichage.

Cohérent avec le garde-fou dual-use des articles cyber : on publie la méthode et le droit, on
n'induit personne en erreur sur ce qui est autorisé.

## Politesse de crawl — non négociable, on s'est déjà fait bannir

**26/07/2026** : un crawl à 400 ms de pause sur 30 pages × 10 départements a fait **bannir l'IP en
~2 minutes**. Connexion acceptée puis fermée sèchement (`curl` → `000` en 0,1 s ; Node →
`UND_ERR_SOCKET`), sur **tous** les sites préfectoraux simultanément, alors que `naviforest.ign.fr`
répondait toujours 200. Anti-crawl de plateforme mutualisée.

`collectors/_http.js` impose : User-Agent descriptif et joignable, séquentiel, backoff exponentiel,
cache disque, et un **disjoncteur** (3 fermetures sèches sur un hôte → abandon du département avec
diagnostic). Défauts du watcher : 8 pages, profondeur 2, 3 s de pause, 20 s entre départements.

- **Un département à la fois** (`--dep 33`). Pas les dix d'affilée.
- Ne pas paralléliser, ne pas remonter les compteurs « pour tester plus vite ».
- Un arrêté ne sort pas toutes les heures : un passage par jour suffit.
- Si ça renvoie `000` : attendre des dizaines de minutes. Insister allonge le bannissement.

Pour Valabre (`risque-prevention-incendie.fr`) : **ne pas requêter l'endpoint non documenté** tant
que la demande écrite (`mails/01-valabre-acces-massifs.md`) n'a pas eu de réponse.

## Structure

```
collectors/   _http.js (lib) · meteo-forets.js · naviforest.js · watch-prefectures.js
data/         prefectures.json (config) + sorties JSON
mails/        brouillons de demandes (Valabre, référent ReAcT) — à envoyer par Julien
```

Commandes : `npm run meteo` · `npm run naviforest` · `npm run veille` · `npm run collect`.

## Reste à faire

Fusion en `arretes-forets-fr.json` unique → géométries (Overpass/OSM comme feux-foret-carte, ou
BD TOPO IGN) → front carto → automatisation quotidienne → déploiement sous-domaine.
