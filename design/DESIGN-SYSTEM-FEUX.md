# Design system — feux.julienweb.fr

> À **importer** dans Claude Design (claude.ai/design → import design system), pas à coller dans le prompt.
> Une fois importé, il s'applique à tous les projets de la marque sans avoir à le redécrire.
>
> Dérivé de la charte « Terminal / éditorial dev » de JulienWeb.fr (`../Julienweb.fr/design-terminal.md`),
> elle-même surcouche sombre de la charte principale (`../Julienweb.fr/design.md`).
> Les valeurs de marque ne changent pas : violet/bleu/jaune, Squada One, Poppins, JetBrains Mono, ツ.

---

## 0. Le principe qui gouverne tout le reste

Cette interface affiche une **information à valeur réglementaire**. Une erreur de lecture vaut
une amende. Donc :

- **La donnée légale prime sur l'effet.** Aucune information d'interdiction ne passe en texture,
  en shader ou en canvas. Elle reste du texte HTML, sélectionnable, copiable, lisible par un lecteur
  d'écran.
- **Le statut ne se code jamais par la couleur seule.** Toujours couleur **+** libellé **+** forme.
  Un daltonien deutan doit distinguer « INTERDIT » de « levée » sans voir la teinte.
- **L'incertitude a sa propre expression visuelle.** Ni rouge ni vert : l'ambre hachuré. Ne jamais
  résoudre un doute en le peignant dans une des deux couleurs franches.

---

## 1. Tokens de couleur

### 1.1 Socle sombre (repris tel quel de la charte terminal)

| Token | Valeur | Usage |
|---|---|---|
| `--fond-page` | `#0A0812` | Backdrop hors carte, fond du canvas 3D |
| `--fond-carte` | `#14121F` | Surface principale, panneaux |
| `--surface-1` | `#1C192B` | Cartes internes, blocs de contenu |
| `--surface-2` | `#221E36` | Barre de titre, en-têtes, dégradés |
| `--puits` | `#0D0B16` | Champs de saisie, blocs « code », listes changelog |
| `--bord` | `rgba(255,255,255,.07)` | Traits de séparation |
| `--bord-focus` | `#9ED5E1` | Champ actif, hover de carte |

### 1.2 Texte

| Token | Valeur | Usage |
|---|---|---|
| `--texte-fort` | `#FFFFFF` | Titres, valeurs clés, nom du massif |
| `--texte-corps` | `#A6A1C0` | Paragraphes (Poppins 300) |
| `--texte-2` | `#9B96B4` | Descriptions de cartes |
| `--muted` | `#5A5478` | Labels de section, chemins |
| `--mono-muted` | `#6C6790` | Dates, métadonnées, numéros d'arrêté |

### 1.3 Accents de marque — parcimonie obligatoire

| Token | Valeur | Usage |
|---|---|---|
| `--jaune` | `#F5FF00` | CTA principal, numéros de repère, `$`, badge. **Rien d'autre** |
| `--bleu-clair` | `#9ED5E1` | Liens, tags, ツ, puce `◆` |
| `--bleu` | `#1E91D4` | Liens texte, bordure badge Cyber |
| `--violet` | `#5A4095` | Rappel de marque, fonds de badge |
| `--vert-ok` | `#28C840` | Succès d'action (formulaire envoyé) — **jamais** un statut d'interdiction |

> Le jaune ne sert **jamais** à qualifier un niveau de danger ni un statut d'interdiction.
> C'est la couleur de l'action, pas de l'information. La confusion serait fatale sur cette interface.

### 1.4 Niveaux de danger — Météo des forêts (fond de carte)

Échelle Météo-France à 4 niveaux, **indicative**, à la maille du **département**.

| Token | Valeur | Niveau | Libellé officiel |
|---|---|---|---|
| `--danger-1` | `#3D8B4A` | 1 | faible |
| `--danger-2` | `#E0B400` | 2 | modéré |
| `--danger-3` | `#E07B00` | 3 | élevé |
| `--danger-4` | `#C22C22` | 4 | très élevé |
| `--danger-nd` | `#3A3F34` | — | hors saison / non couvert |

Ces cinq teintes ne servent **que** pour le fond départemental. Elles sont volontairement
désaturées par rapport aux rouges d'interdiction : le fond est du contexte, pas de la règle.

### 1.5 Statuts d'interdiction — la couche qui compte

Quatre états, dérivés du champ `statut` recalculé + `confiance_dates`.

| Token | Valeur | Statut | Forme associée | Libellé affiché |
|---|---|---|---|---|
| `--statut-interdit` | `#C22C22` | `en_vigueur` avec date de fin | plein, bordure continue 2px | `INTERDIT` |
| `--statut-sans-terme` | `#E04A2F` | `en_vigueur`, `fin: null` | plein, bordure continue + chevron `▲` | `INTERDIT — sans terme` |
| `--statut-incertain` | `#B45309` | `indeterminee` / `confiance: partielle` | **hachures 45°**, bordure pointillée | `STATUT INCERTAIN` |
| `--statut-levee` | `#4A7C59` | `levee` / `expiree` | contour seul, remplissage 12 % | `levée` / `expirée` |

**Tri d'affichage imposé**, jamais alphabétique :
`INTERDIT` → `sans terme` → `incertain` → `levée / expirée`.

### 1.6 Contraste — plancher non négociable

Sur `--fond-carte` (`#14121F`) :

- texte de statut, dates, numéros d'arrêté : **≥ 4,5:1** (WCAG AA)
- libellés de niveau de danger : **≥ 4,5:1** → sur `--danger-4` et `--danger-1`, écrire en blanc ;
  sur `--danger-2` et `--danger-3`, écrire en `#0A0812`
- bordures et éléments non textuels porteurs de sens : **≥ 3:1**

---

## 2. Typographie

| Rôle | Famille | Détail |
|---|---|---|
| Titres | **Squada One** | H1 60–76px (hero), H2 32–42px, line-height ~1 |
| Corps | **Poppins** | 14–18px, weight 300 pour les paragraphes longs, 600 pour les titres de carte |
| Système / donnée | **JetBrains Mono** | numéros d'arrêté, dates, codes département, coordonnées, labels de section, tags |

```html
<link href="https://fonts.googleapis.com/css2?family=Squada+One&family=Poppins:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

**Règle de partage** : tout ce qui est *donnée ou système* passe en mono. Un numéro d'arrêté
(`2026/CAB/SIDPC/1223`) en Poppins, c'est une faute. Il doit se lire comme une référence qu'on
recopie.

Labels de section, format terminal :

```
// zones interdites          12px · letter-spacing .14em · uppercase · --muted
relevé le 26/07/2026         12px mono · --mono-muted · aligné à droite
```

---

## 3. Composants

### 3.1 Barre de fenêtre terminal

En-tête de toute carte principale. Trois pastilles macOS, chemin en mono, ツ à droite.

```
● ● ●   feux.julienweb.fr — ~/massifs/fontainebleau                        ツ
```

Pastilles `#FF5F57` / `#FEBC2E` / `#28C840`, 12px. Fond `--surface-2`,
bordure basse `rgba(255,255,255,.06)`.

### 3.2 Bandeau d'avertissement — composant obligatoire

Présent sur **toute** vue qui affiche un niveau de danger. Non refermable, non repliable,
non réductible à une icône.

- Bordure gauche 4px `--statut-interdit`, fond `rgba(194,44,34,.12)`, radius `0 4px 4px 0`
- Texte 13,5px, Poppins, `--texte-corps`, les termes clés en `#FF8A7E`
- Contenu figé : *« Ceci n'est pas une carte d'autorisation d'accès. Le niveau affiché est la
  Météo des forêts de Météo-France : un indicateur indicatif, à la maille du département.
  Seul l'arrêté préfectoral zonal autorise ou interdit l'accès à un massif. »*

### 3.3 Carte de zone interdite

Le composant central. Une entrée = une interdiction.

```
┌─────────────────────────────────────────────────────────────┐
│  Forêt domaniale de Fontainebleau      [ INTERDIT ]   77     │
│  du 24 au 31 juillet 2026 inclus · encore 5 jours            │
│  arrêté 2026/CAB/SIDPC/1223                    → voir le PDF │
│  ▸ 3 dérogations                                             │
└─────────────────────────────────────────────────────────────┘
```

- Nom du massif : Poppins 600, `--texte-fort`, 14–16px
- Badge de statut : 10,5px, weight 700, letter-spacing .05em, uppercase, radius 3px
- Code département : mono 11,5px `--mono-muted`
- **Période en clair, jamais en ISO** : « du 24 au 31 juillet 2026 inclus · encore 5 jours »,
  « depuis le 17 juillet 2026 — aucune date de fin dans l'arrêté »
- Numéro d'arrêté : mono, cliquable vers le PDF source
- Dérogations : `<details>` replié, puce `◆` `--bleu-clair` — **c'est souvent l'info la plus utile
  sur le terrain**, elle doit être visiblement présente même repliée
- Séparateur `1px dashed --bord` entre deux zones

### 3.4 Encart « zone sans contour »

Pour un massif interdit dont on n'a **pas** la géométrie (Bavella, Illarata).
Il reste listé, avec la raison affichée. Ne jamais le masquer parce qu'il n'est pas dessinable.

Fond `--puits`, bordure pointillée `--muted`, icône `⌀`, texte mono 12px :
*« périmètre défini par une carte annexée au PDF, non numérisée »*.

### 3.5 Chips de confiance

Mono 12,5px, puce `◆` :

```
◆ arrêté lu intégralement     ◆ relevé le 26/07/2026     ◆ détection heuristique
```

### 3.6 Bouton d'action

Reprend la charte terminal : fond `--jaune`, texte `#14121F`, mono 700, radius 12px,
`box-shadow: 0 8px 24px -8px rgba(245,255,0,.5)`, hover `translateY(-2px)`.
Un seul bouton jaune par vue.

### 3.7 Footer badges

Mono, bordure gauche 3px : `--bleu` pour 🛡 Cyber.gouv.fr, `--jaune` pour 🇫🇷 France Num,
`© 1998–2026 JulienWeb.fr ツ` à droite. Plus la mention **« Ce projet n'est pas officiel et ne
remplace aucune publication préfectorale »**.

---

## 4. Radius, ombres, mouvement

| Élément | Valeur |
|---|---|
| Carte principale | `border-radius: 18px` |
| Cartes internes / inputs / boutons | `12–14px` |
| Éléments de liste | `4px` |
| Ombre carte | `0 30px 80px -30px rgba(0,0,0,.7)` |
| Ombre CTA jaune | `0 8px 24px -8px rgba(245,255,0,.5)` |
| Transition hover | `transform .12s, box-shadow .12s` · carte : `border-color .15s` |

**Mouvement — la limite** : aucune animation en boucle sur un élément porteur d'information
réglementaire. Une zone interdite ne clignote pas, ne pulse pas, ne brûle pas. Le mouvement est
réservé aux transitions de navigation et à la caméra 3D.

`prefers-reduced-motion: reduce` → toutes les transitions de caméra deviennent des coupes,
les transitions d'interface tombent à 0ms. Non négociable.

---

## 5. Grille et responsive

| Propriété | Valeur |
|---|---|
| Max-width contenu | `1290px` |
| Gouttière | `14px` |
| Grille de cartes | `repeat(auto-fit, minmax(260px, 1fr))` · gap `16px` |

Trois points de bascule, hérités du POC actuel :

- **> 1250px** — 3 colonnes : contexte (300px) · carte (fluide) · interdictions (380px)
- **900–1250px** — 2 colonnes : carte + interdictions à droite ; le contexte passe en ligne
  au-dessus, en `auto-fit`
- **< 900px** — 1 colonne, et **les interdictions passent en premier** (`order:-1`).
  Sur mobile, le sujet c'est l'interdiction, pas la carte.

---

## 6. Tokens CSS — bloc importable

```css
:root{
  /* socle */
  --fond-page:#0A0812; --fond-carte:#14121F; --surface-1:#1C192B; --surface-2:#221E36;
  --puits:#0D0B16; --bord:rgba(255,255,255,.07); --bord-focus:#9ED5E1;
  /* texte */
  --texte-fort:#FFFFFF; --texte-corps:#A6A1C0; --texte-2:#9B96B4;
  --muted:#5A5478; --mono-muted:#6C6790;
  /* marque */
  --jaune:#F5FF00; --bleu-clair:#9ED5E1; --bleu:#1E91D4; --violet:#5A4095; --vert-ok:#28C840;
  /* danger météo — fond départemental, indicatif */
  --danger-1:#3D8B4A; --danger-2:#E0B400; --danger-3:#E07B00; --danger-4:#C22C22;
  --danger-nd:#3A3F34;
  /* statut d'interdiction — couche opposable */
  --statut-interdit:#C22C22; --statut-sans-terme:#E04A2F;
  --statut-incertain:#B45309; --statut-levee:#4A7C59;
  /* typo */
  --f-titre:'Squada One',sans-serif;
  --f-corps:'Poppins',system-ui,sans-serif;
  --f-mono:'JetBrains Mono',ui-monospace,monospace;
}
```

---

## 7. Assets de marque

| Asset | Où |
|---|---|
| Logo blanc transparent | `https://julienweb.fr/wp-content/uploads/Studio-Internet-Sticker-06-Logo-blanc-transp.png` |
| Symboles fétiches | `ツ` (signature) · `◆` (puce) · `★` (avis) · `✓` (validation) · `🛡` `🇫🇷` (badges) |
| Badge Cyber.gouv.fr | `https://www.cybermalveillance.gouv.fr/resultat-recherche-prestataire?search=julienweb` |
| Badge France Num | `https://www.francenum.gouv.fr/activateurs/julienwebfr` |

---

*Constitué le 26/07/2026 · sources : `../Julienweb.fr/design-terminal.md`, `../Julienweb.fr/design.md`,
`app/index.html` (POC), `data/zones-interdites.json`.*
