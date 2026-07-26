# Skills & MCP — ce qui existe vraiment, et ce qui n'existe pas

> Vérifié le 26/07/2026. Trois listes distinctes, parce que « activer un skill » ne veut pas dire la
> même chose selon l'endroit où on se trouve.

---

## 0. Le point qui change tout : Claude Design n'a pas de sélecteur de skills

Claude Design (claude.ai/design, Anthropic Labs, lancé le 17/04/2026, research preview) n'expose
**pas** de liste de skills à cocher, ni de connecteurs MCP. Ce qui s'y « active », c'est :

| Levier | Ce que ça fait |
|---|---|
| **Import de design system** | Refondu le 17/06/2026. Claude Design lit une base de code et des fichiers de design, en construit un design system, et l'applique à tous les projets. Plusieurs systems peuvent coexister |
| **Pièces jointes** | Images, captures de sites, DOCX / PPTX / XLSX, code source |
| **Exports** | HTML autonome, URL interne, dossier local, PDF, PPTX, Canva (éditable) |
| **Handoff Claude Code** | Le passage design → implémentation |

Capacité qui nous intéresse directement, annoncée par Anthropic :
*« code-powered prototypes with voice, video, shaders, 3D and built-in AI »*. Un prototype Three.js
est donc dans le périmètre du produit, ce n'est pas un détournement.

⚠️ **Coût.** Consommation de tokens très élevée : un testeur PCWorld a épuisé ~80 % de son quota
Pro hebdomadaire en 25 minutes pour trois variations d'une page. Pas de SKU séparé pendant la
research preview : ça pioche dans le quota de l'abonnement. Y aller écran par écran.

---

## 1. Pousser le design system depuis ici — l'outil `DesignSync`

**Trouvaille de cette session** : cet environnement dispose d'un outil `DesignSync` qui lit et écrit
les **projets design-system de claude.ai/design** via le login claude.ai. Méthodes : `list_projects`,
`create_project`, `get_file`, `finalize_plan`, `write_files`…

Ça permet de pousser `DESIGN-SYSTEM-FEUX.md` **directement** dans Claude Design, au lieu de
l'importer à la main. Composant par composant, jamais en remplacement global.

À savoir avant d'essayer :

- la première utilisation demande d'ajouter le scope « design system » au login claude.ai — donc une
  autorisation interactive, impossible dans une session non interactive ;
- le skill compagnon `/design-sync` mentionné par l'outil **n'apparaît pas** dans la liste des skills
  de cette session. À vérifier avant de compter dessus ;
- l'écriture est verrouillée par un `finalize_plan` : la liste exacte des chemins écrits est validée
  par toi, pas par moi.

**Recommandation** : première fois, import manuel (c'est deux minutes). Si le design system bouge
souvent, basculer sur `DesignSync`.

---

## 2. Skills utiles **ici, dans Claude Code** — tous vérifiés présents dans cette session

### Pour préparer et exploiter les maquettes

| Skill | À quoi il sert sur ce projet |
|---|---|
| `anthropic-skills:theme-factory` | Décliner / ajuster le thème appliqué aux artefacts produits |
| `anthropic-skills:web-artifacts-builder` | React + Tailwind + shadcn/ui pour les artefacts complexes — le bon outil quand le prototype dépasse le fichier unique |
| `dataviz` | **À lire avant d'écrire la moindre ligne de code de graphique.** Contient la méthode couleur, les palettes séquentielles/divergentes et un validateur. Directement pertinent pour l'échelle de danger à 4 niveaux |
| `design:design-system` | Auditer la cohérence des tokens, documenter variantes et états |
| `design:design-handoff` | Générer la spec de handoff design → dev : tokens, props, états, breakpoints, edge cases |
| `design:ux-copy` | Microcopie : libellés de statut, états vides, formulation de l'avertissement |
| `design:accessibility-review` | Audit WCAG 2.1 AA — critique ici : fond sombre + statuts couleur + canvas WebGL |
| `design:design-critique` | Retour structuré sur une maquette rendue par Claude Design |
| `engineering:system-design` | Contrat de données de la webapp, frontières de services |
| `engineering:architecture` | ADR pour trancher R3F vs carte 2D, si le débat revient |
| `brand-card` | Carte image brandée (OG / featured / social) via Chrome headless → PNG → `img-optim` |
| `img-optim` | PNG 256 + JPEG OG 1200px mozjpeg, EXIF strippé |
| `anthropic-skills:canvas-design` | Visuels statiques (poster, PDF) si besoin d'un support de présentation |

### Côté publication et SEO — dans le projet voisin `Julienweb.fr/`

Le SEO de ce sujet vit **là-bas**, pas ici (l'article #11311 et le SEO-TRACKER sont chez Julienweb) :

- `ops/skills/publish-wp-article-julienweb/` — workflow de publication en 6 étapes
- `ops/skills/llms-generator-julienweb/` — régénération des 2 sources canoniques `llms.txt` et
  `llms-profile.txt`
- Pack skills web global : `D:/Google Drive/_Claude/skills/web/` (23 skills WP / builders / SEO /
  publication / serveur), index `README.md`, orchestration `WORKFLOW.md`

### MCP disponibles et pertinents

| MCP | État |
|---|---|
| `Claude_Browser` (`preview_start`, `read_page`, `computer`) | ✅ connecté — sert à ouvrir le POC et à screenshoter pour joindre à Claude Design |
| `visualize` (`show_widget`) | ✅ connecté — prévisualiser une maquette HTML/SVG inline |
| `plugin:design:figma` | ⛔ **nécessite une autorisation** — indisponible tant que le serveur n'est pas connecté (via les réglages de connecteurs claude.ai, ou `claude mcp` / `/mcp` en session interactive) |
| `plugin:engineering:github` | ⛔ même chose — utile plus tard pour le repo public |

---

## 3. Three.js / React Three Fiber — l'état réel du terrain

### Il n'existe pas de MCP Three.js

Recherche dans le registre MCP connecté (mots-clés `three.js`, `3d`, `webgl`, `react-three-fiber`,
`design`) : **0 résultat**. Ce qu'on trouve en ligne sous l'étiquette « MCP Three.js », ce sont des
**skills** indexés sur des annuaires MCP-adjacents. Ce n'est pas la même chose.

### Les skills communautaires qui circulent

Aucun n'est officiel Anthropic. Provenance variable, et les descriptions élogieuses sont recopiées
d'un listing à l'autre — ce sont des fiches marketing, pas des évaluations indépendantes.

| Skill | Angle | Où |
|---|---|---|
| `react-three-fiber` (freshtechbro / claudedesignskills) | R3F générique, orienté design | [explainx.ai](https://explainx.ai/skills/freshtechbro/claudedesignskills/react-three-fiber) |
| `react-three-fiber-3d-scenes` | R3F + drei, état WebGL, SSR Next.js, instancing, LOD | [mcpmarket.com](https://mcpmarket.com/tools/skills/react-three-fiber-3d-scenes) |
| `three-js-react-ui-specialist` | **Le plus proche de notre besoin** : cartes interactives, fonds ambiants, parallaxe, gestion du framerate, rendu par appareil, amélioration progressive — pas des scènes de jeu | [mcpmarket.com](https://mcpmarket.com/tools/skills/three-js-react-ui-specialist) |
| `3d-web-experience-architect` | Three.js + R3F + Spline, GSAP/ScrollControls, pipeline GLB/GLTF | [mcpmarket.com](https://mcpmarket.com/tools/skills/3d-web-experience-architect-7) |
| `three-js` (mindrally) | TypeScript, cleanup et dispose GPU, merge de géométries, instancing, `useFrame`, drei | [claudemarketplaces.com](https://claudemarketplaces.com/skills/mindrally/skills/three-js) |
| `react-three-fiber` (vercel-labs / json-render) | R3F, publié le 16/05/2026 | [claudemarketplaces.com](https://claudemarketplaces.com/skills/vercel-labs/json-render/react-three-fiber) |

**Recommandation** : si un seul, prendre `three-js-react-ui-specialist` — c'est l'angle « interface
3D avec contrainte de framerate », pas l'angle jeu vidéo, et c'est exactement le registre visé.

**Avant toute installation** :

1. `/do-i-have-a-skill` s'auto-déclenche sur `/add-skill <url>` — laisser faire, il évite les doublons ;
2. **lire le `SKILL.md` en entier** avant d'installer. Un skill est du texte qui entre dans le
   contexte et oriente les décisions : sur un projet où une erreur d'affichage vaut une amende, on
   ne charge pas un fichier tiers sans l'avoir lu ;
3. `/add-skill <url git>` pour l'ajouter en submodule, puis `/update-skills` pour resynchroniser.

### Et si on n'installe rien ?

C'est une option défendable. R3F est de la documentation publique bien couverte, et le vrai risque
technique du projet n'est pas Three.js : c'est le **dispose GPU**, le **LOD sur 204 polygones** et
le **fallback 2D**. Trois points qu'un skill générique ne résout pas à ta place.

---

## 4. Ordre d'opérations conseillé

1. **Ici** — le kit `design/` est prêt (ce fichier, le prompt, le design system, les données réelles)
2. **Ici** — screenshot du POC via `Claude_Browser` pour la pièce jointe *(optionnel)*
3. **claude.ai/design** — importer le design system, joindre le JSON, coller le prompt, **écran 1 seul**
4. **Validation visuelle** → écrans 2 et 3 → validation → le reste
5. **Export HTML autonome** + handoff vers Claude Code
6. **Ici** — implémentation R3F, avec `design:accessibility-review` et `design:design-handoff` en
   garde-fous
7. **Ici** — `brand-card` + `img-optim` pour l'OG, puis publication côté `Julienweb.fr/`

---

*Sources vérifiées le 26/07/2026 : [annonce Claude Design (Anthropic)](https://www.anthropic.com/news/claude-design-anthropic-labs) ·
[TechCrunch, 17/04/2026](https://techcrunch.com/2026/04/17/anthropic-launches-claude-design-a-new-product-for-creating-quick-visuals/) ·
[VentureBeat — refonte du 17/06/2026](https://venturebeat.com/technology/anthropic-ships-major-claude-design-overhaul-with-design-system-imports-code-round-trips-and-a-fix-for-its-token-burning-problem) ·
[DataCamp](https://www.datacamp.com/blog/claude-design) · registre MCP connecté (recherche 3D : 0 résultat).*
