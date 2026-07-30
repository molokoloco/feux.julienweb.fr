---
name: wrap-up
description: Fin de session feux.julienweb.fr — synthèse, memory, CLAUDE.md/README, vérité des données, frontière projets voisins, mails institutionnels, commit. Snapshot LOCAL du global 2026-07-07.
trigger: /wrap-up
---

> **Snapshot LOCAL** du global `C:/Users/molok/.claude/skills/wrap-up/SKILL.md` (état 2026-07-30) — adapté **2026-07-30** pour feux.julienweb.fr.
> Chemins figés : memory `C:/Users/molok/.claude/projects/D--Google-Drive--WWW--feux-julienweb-fr/memory/`, projet `D:\Google Drive\_WWW_\feux.julienweb.fr`.
> Patches généralisables → backsync vers le canonique : pack web `D:/Google Drive/_Claude/skills/web/` ou global `~/.claude/skills/`.
> Sync inbound depuis le canonique : `/wrap-in`.

---

# /wrap-up — feux.julienweb.fr

Checklist de fin de session. L'étape 1 (Synthèse) sert de **session log incrémental** : bullets accumulés au fil de la session.

## 🚨 Deux règles propres à ce projet, avant tout

1. **Le wrap-up ne lance JAMAIS de collecte.** Pas de `npm run collect`, pas de `npm run veille`, pas de « juste un dernier passage pour avoir des données fraîches ». L'IP s'est fait bannir le 26/07/2026 pour moins que ça. Le wrap-up **lit** l'état de `data/`, il ne le régénère pas.
2. **Aucune date d'arrêté n'entre dans un JSON sans lecture humaine du PDF.** Si la session a ajouté des dates, l'étape 3f l'exige comme vérification explicite, pas comme confiance.

## Usage

```
/wrap-up           # checklist complète (0 → 8)
/wrap-up quick     # steps 1 + 3a + 7 + 8 (session courte)
/wrap-up full      # force le mode full même si le journal de session est vide
```

---

## Étape 0 — Delta mode preflight

```bash
node ~/.claude/scripts/_wrap_state.js delta
```

Le helper résout le sessionId via `$CLAUDE_CODE_SESSION_ID` (env Bash native — **pas** `$CLAUDE_SESSION_ID`, qui n'existe pas). Retourne `{ journalSummary, journalCount, globalSkillsMoved, dirtyRepos, externallyModified, daysSince* }`.

| Condition | Mode |
|----------|------|
| `journalCount == 0` ET `externallyModified == []` ET `dirtyRepos == []` | **delta-empty** → §1 + §8 seulement, aucun commit |
| `journalCount > 0`, concentré sur 1-2 zones | **delta-partial** → seulement les § dont le journal a des entrées |
| `journalCount > 20` OU `daysSinceWrapUp > 7` OU `/wrap-up full` | **full** → checklist complète |

Reporter en tête de réponse : `mode: … · journal: N events (memory:X, doc:Y, skill:Z)`.

> ⚠️ **Exception projet** : §3f (vérité des données) **n'est jamais skippée** si la session a touché
> `data/*.json`, `collectors/` ou `app/data.js` — même en delta-partial. C'est un garde-fou métier,
> pas une mise à jour de doc.

---

## Étape 1 — Synthèse

3-5 bullets :
- Ce qui a été **fait** (collecteurs écrits, départements couverts, zones qualifiées, bugs fixés)
- Ce qui a **changé** (comportements, seuils de crawl, doctrine, contournements)
- **Fichiers touchés** (chemins relatifs)
- **Actions pendantes** (ce qui reste à faire par Julien — mails à envoyer, arbitrages)
- **Ce qui a été appris à ses dépens** (ban, 404, timeout, PDF illisible) → candidat § « Pièges déjà payés » de CLAUDE.md

---

## Étape 2 — Memory `(delta)`

Répertoire : `C:/Users/molok/.claude/projects/D--Google-Drive--WWW--feux-julienweb-fr/memory/`

> Au 26/07/2026 ce répertoire est **vide** : pas encore de `MEMORY.md`. Le premier wrap-up qui écrit une mémoire crée aussi l'index.

**Delta mode** : si `journalSummary.memory == 0` ET aucun `externallyModified` dans ce répertoire → skip §2, logger `§2 memory: skipped (delta-empty)`.

### 2a — Lire MEMORY.md
Repérer les entrées stales : arrêté expiré, département devenu couvert, source qui a changé d'URL.

### 2b — Mettre à jour ou créer

| Type | Quand, sur ce projet |
|------|------|
| `project_*.md` | Avancement de la collecte nationale, échéance 31/07, état d'un mail envoyé/répondu |
| `feedback_*.md` | Règle de crawl confirmée, arbitrage de Julien sur la doctrine, approche rejetée |
| `reference_*.md` | Nouvel endpoint (naviforest, Overpass, polygons.osm), pattern d'URL PDF préfectoral, contact institutionnel |
| `user_*.md` | Rare ici — les préférences de Julien vivent côté Julienweb.fr |

**Ne pas mettre en mémoire** ce que CLAUDE.md dit déjà (doctrine, pièges, politesse de crawl) : ce fichier est lu à chaque session. La mémoire sert à ce qui **survit au-delà** de ce repo — typiquement ce qui vaut aussi pour Julienweb.fr ou feux-foret-carte.

**Format :**
```markdown
---
name: ...
description: une ligne — sert à décider la pertinence future
type: feedback|project|reference|user
---

[corps — pour feedback/project : fait, **Why:**, **How to apply:**]
```

### 2c — Index MEMORY.md
Une ligne par fichier, ~150 chars : `- [Titre](fichier.md) — hook`

---

## Étape 3 — Docs projet `(delta)`

Le projet n'a ni `project.md` ni `playbook.md`. La répartition est :

| Fichier | Rôle | Réécrit ? |
|---|---|---|
| `CLAUDE.md` | **état vivant** — briques, doctrine, pièges, prochaine étape, en attente de Julien | ✅ à chaque session |
| `HANDOFF.md` | **récit figé et daté** de la session fondatrice | ❌ **jamais** |
| `README.md` | paysage des sources, commandes, structure publique | ✅ si sources/commandes changent |

### 3a — CLAUDE.md — l'état vivant

Sections à vérifier selon le travail de la session :

| Travail fait | Section CLAUDE.md |
|---|---|
| Collecteur écrit / corrigé / élargi | tableau **« État au JJ/MM/AAAA »** (mettre la date à jour, pas seulement les lignes) |
| Nouveau département couvert, compteur qui bouge | même tableau — chiffres réels, pas arrondis |
| Nouvelle règle métier tranchée avec Julien | **Doctrine** (numéroter la nouvelle règle, ne pas diluer les 5 existantes) |
| Ban, 404, timeout, format inattendu, outil manquant | **Pièges déjà payés** ou **Politesse de crawl** |
| Nouveau dossier / script | **Structure** |
| Chose à faire par Julien (mail, arbitrage, compte) | **En attente de Julien** |
| Décision d'architecture prise | **Prochaine étape** |

Règle : une ligne ajoutée à « Pièges » doit dire **ce qui a été payé**, pas seulement ce qu'il faut faire. C'est ce qui empêche de le repayer.

### 3b — HANDOFF.md — ne pas y toucher

`HANDOFF.md` est le récit daté de la session fondatrice (26/07/2026). **Ne jamais le réécrire, ni le corriger, ni le « mettre à jour ».**

Si une session ultérieure mérite un récit du même ordre (pivot, refonte, gros incident) → créer un **nouveau** fichier `HANDOFF-YYYY-MM-DD.md` et l'ajouter au tableau ci-dessus dans CLAUDE.md. L'ancien reste tel quel, faux compris : c'est un instantané, pas une doc.

### 3c — README.md

Vérifier :
- [ ] Compteurs annoncés (départements, arrêtés, zones, polygones) **cohérents avec `data/` réel** — les recompter, ne pas les recopier
- [ ] Commandes `npm run …` toujours exactes vs `package.json`
- [ ] Nouvelles sources dans le paysage (portail, endpoint, jeu de données) ajoutées avec leur statut
- [ ] Aucun claim de couverture nationale que la collecte ne tient pas (25/96 reste 25/96)

### 3d — Régen TODOs multi-cas — **N/A sur ce projet**

Pas de structure `_EN-COURS.md` par cas. Le suivi des actions pendantes vit dans la section **« En attente de Julien »** de CLAUDE.md, tenue à la main en §3a. Si un jour la collecte devient un cas par département (un `_EN-COURS.md` par préfecture), réactiver le §3d du global.

### 3e — Trackers projet — aucun à ce jour

Si un tracker apparaît (`VEILLE-TRACKER.md` par département, `DEPLOY-STATUS.md`), le déclarer ici avec sa convention d'emojis : 🔴 à faire · 🟠 en cours · 🟢 terminé · 🟡 en attente.

### 3f — Vérité des données — **spécifique feux, jamais skippée**

À exécuter dès que la session a touché `data/*.json`, `collectors/` ou `app/`. C'est la contrepartie de la doctrine : elle est écrite dans CLAUDE.md, cette étape vérifie qu'elle a **tenu** cette session.

- [ ] **Échéance 31/07/2026** — l'arrêté 77 expire. Si on est proche ou après : l'article #11311 et le repo `feux-foret-carte` affirment une interdiction qui n'existe plus. Le signaler dans la synthèse, à voix haute, tant que ce n'est pas arbitré.
- [ ] **`confiance_dates`** — toute date de fin ajoutée cette session vient-elle d'un PDF **lu visuellement** ? Si elle vient d'un OCR non relu ou d'une déduction : la retirer ou la basculer en statut incertain. « L'arrêté ne fixe pas de terme » (fait vérifié) ≠ « nous n'avons pas lu l'arrêté » (doute).
- [ ] **Avertissement météo** — le champ `avertissement` est-il toujours propagé par les collecteurs **et** affiché dans `app/index.html` ? Météo des forêts ≠ autorisation d'accès.
- [ ] **Zones sans contour** — toujours affichées ? Ne pas savoir dessiner un périmètre n'autorise pas à taire l'interdiction.
- [ ] **Correspondances OSM** — aucune correspondance nom d'arrêté ↔ objet OSM devinée cette session ? Toute nouvelle entrée passe par `data/massifs.json`, saisie à la main.
- [ ] **Compteurs** — ce que CLAUDE.md et README annoncent correspond aux fichiers réels de `data/`.
- [ ] **Valabre** — l'endpoint non documenté de `risque-prevention-incendie.fr` n'a pas été requêté tant que `mails/01-valabre-acces-massifs.md` est sans réponse.

Si une case saute, ce n'est pas un détail à noter : **corriger avant de committer.** Une amende dépend de ces champs.

### 3g — 🔴 Passe anti-péremption (NEW 2026-07-30, du global §3f) — **jamais skippée en delta-partial**

> Complémentaire du §3f local : le §3f vérifie la **vérité des données**, le §3g vérifie la **vérité
> des docs**. Le reste de l'Étape 3 AJOUTE ; cette passe DÉMENT — elle cherche ce qui est devenu **faux**.

**Déclencheur** : changement d'état observable cette session — mise en ligne/hors ligne du front,
nouveau département couvert, réponse Valabre/préfecture reçue, arrêté expiré, décision actée.
Si oui, passe sur les docs pilotes (CLAUDE.md — **jamais** HANDOFF.md — README.md).

**Procédure** : 1. établir l'**état réel** (`curl` du front, `ls data/`, compteurs recomptés), pas
supposé. 2. balayer : tableau « État au JJ/MM » (**la date du titre aussi**) · bandeaux/en-têtes ·
tableaux de statut · **titres de section** · « Prochaine étape » / « En attente de Julien ».
3. grep des formulations qui périment (`actuel`, `pour l'instant`, `toujours`, `encore`, `reste`,
`en attente`, `pas encore`, `à faire`, `en cours`) — confronter au réel. 4. **requalifier sans
effacer** (`~~périmé~~ → ✅ fait le JJ/MM`) — sauf HANDOFF.md, figé faux compris. 5. deux docs qui
se contredisent → trancher avec la preuve, corriger les deux. 6. reporter : `§3g anti-péremption :
N corrections dans M fichiers` (ou passe non déclenchée).

---

## Étape 4 — Skills (avec backsync) `(delta)`

**Delta mode** : si `journalSummary.skillGlobal == 0` ET `skillLocal == 0` → skip §4.

Skills locaux du projet : `skills/` (racine projet)
- `skills/wrap-up/SKILL.md` ↔ global `~/.claude/skills/wrap-up/SKILL.md` *(ce fichier)*

Pour chaque skill utilisé ou amélioré :
1. Lire le SKILL.md local + son canonique
2. Repérer ce qui est **désormais faux ou incomplet**
3. Patcher le **local** + ligne au CHANGELOG local
4. Décider le backsync (2 étages) :
   - ✅ généralisable **web** → `D:/Google Drive/_Claude/skills/web/<skill>/SKILL.md`
   - ✅ généralisable **transverse** (helper Node, pattern crawl poli, règle OSM/Overpass, pipeline PDF scanné) → `~/.claude/skills/<skill>/SKILL.md`
   - ❌ spécifique feux (doctrine arrêtés, seuils de crawl préfectoral, échéance 77) → reste local
5. Documenter le backsync dans le CHANGELOG du canonique

> Candidats backsync repérés sur ce projet : pipeline **PDF scanné → Ghostscript PNG → lecture visuelle** (`pdftoppm` absent de cette machine) et **assemblage de polygones OSM via `polygons.openstreetmap.fr`** plutôt qu'à la main. Les deux valent au-delà de feux.

> Sync canonique→local : `/wrap-in`.

---

## Étape 5 — Frontière avec les projets voisins *(remplace l'étape Wiki du global)*

Pas de wiki ni de `export_wiki.js` ici. À la place : vérifier qu'on n'a pas laissé une contradiction chez les voisins.

| Si la session a… | Alors, **là-bas** |
|---|---|
| changé un fait cité par l'article #11311 | le noter comme action pendante pour `Julienweb.fr` — **ne pas éditer l'article depuis ce projet** |
| invalidé la carte Fontainebleau figée | le noter pour le repo `feux-foret-carte` — il raconte un cas daté, il n'est pas maintenu depuis ici |
| franchi le 31/07/2026 sans arbitrage | le remonter en tête de synthèse : deux publications affirment une interdiction périmée |

Règle : ce projet **collecte**, il ne publie pas. Ne pas fusionner, ne pas corriger à distance, juste signaler.

---

## Étape 6 — Mails institutionnels

Dossier : `mails/`. Deux brouillons au 26/07/2026, **rien n'est parti** :
- `mails/01-valabre-acces-massifs.md` — conditions de réutilisation des données d'accès aux massifs
- `mails/02-react-betagouv.md` — code source de ReAcT (`jean-luc.girel@aube.gouv.fr`)

Voix : **institutionnelle, sobre, française, joignable** — destinataires = agents publics et opérateurs de données réglementaires. Dire qui on est, ce qu'on veut réutiliser, à quelles conditions, et laisser une adresse. Pas de ton commercial, pas de tutoiement, pas d'urgence fabriquée.

**Claude n'envoie rien.** Rédiger, relire, laisser dans `mails/`. L'envoi est un acte de Julien. Si une réponse arrive, journaliser la réponse dans le brouillon concerné et mettre à jour « En attente de Julien » dans CLAUDE.md.

---

## Étape 7 — Commit

### 7.0 — Préflight scope

```bash
node ~/.claude/scripts/_repo_scope_check.js \
  "D:/Google Drive/_Claude" \
  "D:/Google Drive/_WWW_/feux.julienweb.fr"
```

- **Tous clean** → skip §7, passer §8.
- **Au moins un dirty** → reporter à Julien quels repos, combien de fichiers, avant d'aller plus loin.
- **Missing** → ignorer.

> ⚠️ **Pas de remote sur ce repo** (au 26/07/2026 : `git remote -v` vide). Le commit est **local** : ne pas tenter `git push`, ne pas en inventer un. Si un remote apparaît, mettre à jour cette ligne.

### 7.1 — Pré-conditions

```bash
node ~/.claude/scripts/_drive_state.js check
```
- **Exit 0** → flag du jour présent → procéder, aucune question.
- **Exit 1** → UNE seule `AskUserQuestion("Drive en pause aujourd'hui ?")`.
  - OUI → `node ~/.claude/scripts/_drive_state.js mark` puis procéder.
  - NON → STOP : pause Drive (icône taskbar) → `mark` → relancer `/wrap-up`.

Le projet vit **dans Google Drive** : un commit pendant une synchro donne des `.git` corrompus et des `desktop.ini` dans les refs. Ce n'est pas une formalité.

Lock, avant tout commit :
```bash
node ~/.claude/scripts/_git_lock.js wait "D:/Google Drive/_WWW_/feux.julienweb.fr"
```
Exit 1 → **ne pas committer**, signaler (session parallèle, ou lock stale à supprimer à la main).

### 7.2 — Procédure

```bash
cd "D:/Google Drive/_WWW_/feux.julienweb.fr"
git status --short
find .git -name "desktop.ini" -delete 2>/dev/null
git add -A
git commit -m "<type>(<scope>): <sujet>"
```

- `git add -A` est sûr ici : `.gitignore` couvre déjà `app/data.js` (~1,4 Mo régénéré), `.cache/`, `data/.veille-state.json`, `node_modules/`, `desktop.ini`. **Vérifier quand même `git status --short`** avant : un gros fichier de données non prévu au gitignore ne doit pas entrer.
- Erreur `bad ref refs/desktop.ini` → `find .git -name "desktop.ini" -delete && git gc --prune=now` puis retry.
- Message : Conventional Commits, en français, footer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Scopes usuels : `collect` · `app` · `data` · `docs` · `mails` · `skills`.

Si `D:/Google Drive/_Claude` est aussi dirty (mémoire, skills globaux patchés) → y faire sa passe `npm run sync-prefs` + commit + push, séparément.

### 7.3 — Marquer la fin du wrap-up

```bash
node ~/.claude/scripts/_wrap_state.js mark-wrap-up <commit-hash>
```
(`none` à la place du hash si delta-empty sans commit.) Ne touche pas `globalSkillCommits` — cette baseline appartient à `/wrap-in`.

---

## Étape 8 — Suggestions finales

```
Session feux enregistrée + commit local.
Suite possible :
  - /wrap-in    → rattraper les patches du global non encore dans skills/ (si applicable)
  - /wrap-all   → deep pass + audit cross-références (si pivot majeur ou >10 sessions)
  - /compact    → libérer le contexte avant la suite
```

Adapter : retirer `/wrap-in` si rien n'a bougé côté global, `/wrap-all` s'il est récent. `/compact` toujours.

Et si l'échéance **31/07/2026** approche ou est passée sans arbitrage : le redire ici, en dernière ligne, à chaque session.

---

## Checklist rapide

```
[ ] 0. Delta preflight — _wrap_state.js delta
[ ] 1. Synthèse 3-5 bullets (+ ce qui a été payé)
[ ] 2. Memory — update/create + index MEMORY.md
[ ] 3a. CLAUDE.md — tableau d'état daté, doctrine, pièges, en attente de Julien
[ ] 3b. HANDOFF.md — NE PAS TOUCHER (nouveau fichier daté si besoin)
[ ] 3c. README.md — compteurs recomptés, commandes, sources
[ ] 3f. Vérité des données — 7 cases, JAMAIS skippée si data/ ou collectors/ touchés
[ ] 3g. 🔴 Anti-péremption docs — si changement d'état : en-têtes datés, statuts, titres, prochaine étape
[ ] 4. Skills — patcher skills/wrap-up + backsync si généralisable
[ ] 5. Frontière voisins — signaler, ne pas éditer Julienweb.fr / feux-foret-carte d'ici
[ ] 6. Mails — rédiger dans mails/, ne rien envoyer
[ ] 7. Commit — scope, Drive en pause, lock, git status avant add -A, PAS de push (pas de remote)
[ ] 8. Suggestions + rappel échéance 31/07/2026
```

> `/wrap-up quick` = étapes 1 + 3a + 7 + 8.

---

## Triggers naturels

`/wrap-up` · `fin de session` · `on se met à jour` · `bilan` · `wrap up` · `synthèse`

---

## CHANGELOG (patches → candidats backsync)

- 2026-07-30 : wrap-in-all depuis canonique commit e1b7861 — **§3g passe anti-péremption docs**
  (le §3f du global, renuméroté : 3f local = vérité des données, déjà pris). Le principe non-skippable
  noté « candidat backsync » le 26/07 est justement devenu canonique — la boucle est bouclée.
  Header rebump (état global 2026-07-30).
- 2026-07-26 : **création du snapshot local** depuis le global (état 2026-07-07). Adaptations feux :
  - garde-fous en tête : le wrap-up ne lance jamais de collecte · aucune date sans lecture humaine du PDF
  - §3 remappée sur le trio `CLAUDE.md` (vivant) / `HANDOFF.md` (figé, jamais réécrit) / `README.md` — le projet n'a ni `project.md` ni `playbook.md`
  - **§3f « Vérité des données » ajoutée** (7 cases : échéance 31/07, `confiance_dates`, avertissement météo, zones sans contour, correspondances OSM, compteurs, Valabre) — exemptée du delta-skip. *Candidat backsync partiel : le principe « une étape de wrap-up non-skippable quand le domaine a des conséquences légales » est généralisable, le contenu non.*
  - §3d et §3e marquées N/A (pas de multi-cas, pas de tracker)
  - **§5 « Wiki » remplacée par « Frontière avec les projets voisins »** — ce projet collecte, il ne publie pas
  - §6 voix mail institutionnelle + règle « Claude n'envoie rien »
  - §7 sans push (pas de remote), avec `git status --short` obligatoire avant `git add -A`, et rappel Drive = cause réelle de corruption `.git` ici
  - §4 note 2 candidats backsync transverses : pipeline PDF scanné (Ghostscript, `pdftoppm` absent) et assemblage de polygones via `polygons.openstreetmap.fr`
