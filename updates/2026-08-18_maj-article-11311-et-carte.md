# MAJ du 18/08/2026 — article #11311 + carte /labs/feux-foret/

> Copie prête à coller. L'article est construit en Elementor : **édition manuelle dans l'éditeur**,
> jamais d'injection `_elementor_data` (incident 2026-04-12).

## Le constat

Au 18/08, le live annonçait encore « **Accès interdit jusqu'au 31 juillet 2026 inclus** » (carte et
article, MAJ 26/07). Or l'interdiction **n'a jamais été levée** : elle est prorogée de semaine en
semaine. Un lecteur pouvait donc conclure que la forêt était rouverte depuis 18 jours — et y aller.

| Arrêté | Signé le | Massifs | Fin de validité |
|---|---|---|---|
| `2026/CAB/SIDPC/1223` | 24/07 | Fontainebleau, Commanderie | 31/07 |
| (non numéroté au recueil consulté) | 29/07 | + Nanteau-Poligny, + Nemours · Trois-Pignons à part | 07/08 |
| `1300` / `1301` | 06/08 | idem | 14/08 |
| **`1323` / `1324`** | **13 et 14/08** | **Trois-Pignons · Fontainebleau · Commanderie · Nanteau-Poligny · Nemours** | **21/08 inclus** |

Source qui fait foi : <https://www.seine-et-marne.gouv.fr/Actualites/Acces-massifs-forestiers-et-point-circulation> (page mise à jour le 14/08).
PDF archivés dans `Downloads/` : `20260813_AP-1323_…pdf`, `20260814_AP-1324_…pdf`.

---

## 1. Carte `/labs/feux-foret/` — FAIT en local, à déployer

Fichier modifié : `D:\Google Drive\_WWW_\feux-foret-carte\index.html` (+ `README.md`).

- Badge : « Fermeture jusqu'au **21/08/2026** inclus »
- Sous-titre : arrêtés `1323`/`1324`, mention « prorogée de semaine en semaine depuis le 17/07 »
- Nouveau bandeau jaune : les **2 massifs non dessinés** (Nanteau-Poligny, Nemours) sont annoncés
- Légende : lien vers l'arrêté **et** vers la page préfecture, mention « **Vérifié le 18/08/2026** »
- Avertissement : « si la date ci-dessus est vieille de plus de 7 jours, considérez-la périmée »
- Refactor : `DATE_FIN`, `DATE_VERIF`, `URL_ARRETE` en tête de script — 3 valeurs à changer par prorogation

**Déploiement** : SFTP vers `www/labs/feux-foret/index.html` (le `data.js` est inchangé).

**Limite assumée** : Nanteau-Poligny et la forêt communale de Nemours ne sont pas tracées.
Vérifié le 18/08 par requête Overpass sur la zone (bbox 48.10-48.45 / 2.45-2.95, `landuse=forest`
+ `natural=wood`) : aucun polygone nommé Nanteau, Poligny ou Nemours. Il faudra la BD Forêt IGN.

---

## 2. Article #11311 — copie à coller dans Elementor

### 2a. Corriger le bandeau du hero

**Remplacer** : `Accès interdit jusqu'au 31 juillet 2026 inclus`

**Par** : `Accès interdit jusqu'au 21 août 2026 inclus — prorogé chaque semaine`

### 2b. Ajouter un encart de mise à jour, juste sous le hero

> **Mise à jour du 18 août 2026** — Cet article a été écrit le 26 juillet, sur l'arrêté du 24 juillet
> qui courait jusqu'au 31. Depuis, **l'interdiction n'a jamais été levée** : elle est reconduite de
> semaine en semaine. Les arrêtés en vigueur aujourd'hui sont les n°2026/CAB/SIDPC/1323 et 1324,
> signés les 13 et 14 août, **valables jusqu'au vendredi 21 août inclus**. Le périmètre s'est aussi
> élargi : la forêt domaniale de Nanteau-Poligny et la forêt communale de Nemours s'ajoutent à
> Fontainebleau, la Commanderie et les Trois-Pignons.
>
> La carte a été mise à jour. Les deux massifs ajoutés en août n'y sont pas encore dessinés — ils
> sont absents d'OpenStreetMap sous ce nom — mais ils sont signalés en clair.
>
> **Avant de partir, la seule source qui fait foi reste la page de la préfecture de Seine-et-Marne.**

### 2c. Ajouter une section « Ce qui s'est passé depuis » (facultatif mais recommandé)

Le tableau de chronologie ci-dessus, tel quel. Il transforme un article périmé en suivi daté —
c'est exactement l'argument de l'article (« la préfecture publie mal, je publie lisible »), à
condition de tenir la promesse.

### 2d. Métadonnées

- Date de MAJ affichée : passer `26/07/2026` → `18/08/2026`
- Le title SEO (« Forêt de Fontainebleau fermée : la carte des massifs ») ne contient pas de date : **rien à changer**
- Pas de nouvelle image OG nécessaire

---

## 3. Dette identifiée

- **La page se re-périme tous les vendredis.** Tant qu'il n'y a pas de collecteur automatique
  (c'est l'objet du projet `feux.julienweb.fr`), prévoir une vérification hebdomadaire, ou assumer
  le bandeau « vérifié le … » comme garde-fou honnête.
- Tracer Nanteau-Poligny + Nemours via BD Forêt IGN.
