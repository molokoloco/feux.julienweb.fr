# Prompt Claude Design — webapp 3D « feux.julienweb.fr »

## Mode d'emploi (ne pas coller)

1. Ouvrir **claude.ai/design** (research preview — inclus dans l'abonnement Pro/Max, pas de SKU séparé).
2. **Importer le design system** : `design/DESIGN-SYSTEM-FEUX.md` + le bloc `:root` de sa §6.
   Une fois importé, il s'applique à tous les projets de la marque : on ne le recolle pas dans le prompt.
3. **Joindre en pièce jointe** : `design/DONNEES-REELLES.json` (14,8 Ko, données du 26/07/2026,
   aucune valeur inventée).
4. Facultatif mais utile : joindre une **capture de `app/index.html`** (le POC actuel, ouvrable en
   double-clic) pour montrer le point de départ.
5. Coller le prompt ci-dessous, **à partir de la ligne de séparation**.

⚠️ **Quota.** Claude Design consomme vite : un testeur a brûlé 80 % d'un quota Pro hebdomadaire en
~25 minutes pour trois variations d'une seule page. Ne pas lancer les 7 écrans d'un coup. Ordre
conseillé : écran 1 (hero + séquence 3D) → validation → écrans 2 et 3 → validation → le reste.

---
---

# ⬇️ COPIER À PARTIR D'ICI ⬇️

Tu conçois l'interface d'une **webapp cartographique 3D** : `feux.julienweb.fr`.

Réponds et écris **en français**. Tutoiement. Phrases courtes. Zéro tiret cadratin — utilise « : »,
« , » ou des parenthèses. Aucune tournure du type « permet de », « il convient de », « en effet »,
« incontournable ». C'est la voix de JulienWeb.fr : directe, technique, sans corporate fluff.

## 1. Le problème que ce site résout

En France, **aucun flux structuré ne recense les arrêtés préfectoraux**. Vérifié : pas d'API
nationale, pas de RSS, pas de sitemap sur les sites de préfecture. Le seul projet public qui s'y
était attelé (ReAcT, beta.gouv.fr, 4 départements pilotes) a été **arrêté en août 2025**, code source
jamais publié.

Résultat concret : quand un préfet ferme un massif forestier, l'information vit dans un **PDF
scanné** posté sur un site départemental. Elle change tous les trois jours. Personne ne l'agrège.
Des promeneurs se font verbaliser chaque année parce qu'ils n'avaient aucun moyen raisonnable de
savoir.

Ce site comble ce trou. Il agrège trois choses :

1. la **Météo des forêts** de Météo-France — niveau de danger J+1/J+2, 96 départements, indicatif ;
2. les **arrêtés préfectoraux** détectés par veille automatisée puis **qualifiés à la main** ;
3. les **contours de massifs** issus d'OpenStreetMap, quand ils existent.

L'utilisateur type : quelqu'un qui veut partir marcher, grimper ou faire du VTT ce week-end et qui
se demande si c'est fermé. Il arrive souvent depuis son téléphone, parfois avec un réseau pourri,
et il veut sa réponse en moins de dix secondes.

## 2. Les cinq règles non négociables

Elles priment sur toute considération esthétique. Un design qui les enfreint est refusé, même beau.

**1. La Météo des forêts n'est pas une autorisation d'accès.** C'est un indicateur *indicatif*, à la
maille du *département*. Seul **l'arrêté préfectoral zonal** est opposable. L'avertissement doit être
aussi visible que la donnée elle-même. Il ne se replie pas, ne se réduit pas à une icône `ⓘ`, ne
disparaît pas au scroll.

**2. Le doute ne se peint jamais en certitude.** Deux cas se ressemblent et ne doivent **jamais**
être confondus :
- « l'arrêté ne fixe aucune date de fin » = **fait vérifié** → afficher *INTERDIT — sans terme* ;
- « nous n'avons pas lu l'arrêté » = **doute** → afficher *STATUT INCERTAIN*.

Le premier est rouge et ferme. Le second est ambre et hachuré. Les confondre, c'est soit rassurer à
tort quelqu'un qui va prendre une amende, soit crier au loup et perdre toute crédibilité.

**3. Une zone sans contour reste affichée.** Certains massifs interdits n'ont pas de géométrie
exploitable : le périmètre est défini par une carte papier annexée au PDF. Ne pas savoir dessiner
une zone n'autorise pas à taire l'interdiction. Elle apparaît dans la liste, avec la raison.

**4. Aucune correspondance devinée.** « Massif de Bavella » et « massif d'Illarata » n'existent pas
dans OpenStreetMap. Un rapprochement automatique par ressemblance de nom produirait des contours
faux sur un sujet pénalement sanctionné. Le registre est curaté à la main.

**5. Rien n'est inventé dans les maquettes.** Tu utilises **exclusivement** les données du fichier
joint `DONNEES-REELLES.json`. Si une composition a besoin d'un cas de plus, tu écris littéralement
`exemple fictif` dans le libellé et tu le marques visuellement. Une fausse interdiction glissée dans
une maquette finit toujours par se retrouver en production.

## 3. Direction artistique

Le design system JulienWeb.fr est importé, applique-le. En résumé : **thème « Terminal / éditorial
dev »** — fond très sombre `#0A0812` / `#14121F`, surfaces `#1C192B` / `#221E36`, accents jaune
`#F5FF00` réservé à l'action, bleu clair `#9ED5E1` pour les liens et le `ツ`. Typo : **Squada One**
pour les titres, **Poppins** pour la prose, **JetBrains Mono** pour toute donnée système (numéros
d'arrêté, dates, codes département, coordonnées). Chrome de fenêtre à trois pastilles macOS.
Symbole fétiche : `ツ`.

Le registre visé : **console d'astreinte**, pas jeu vidéo. Salle de crise sobre. Ce qui doit se
lire d'abord, c'est la donnée ; la 3D sert à la situer, pas à impressionner.

**Interdit explicitement** :
- flammes animées, particules de braise, fumée volumétrique, glow orange sur tout ;
- compteur anxiogène type « X massifs en feu », effet d'urgence artificielle ;
- affichage binaire vert/rouge « safe / unsafe » — l'incertitude fait partie de l'information ;
- toute composition qui pourrait passer pour un **document officiel** ou un laissez-passer.
  Ce site n'est **pas** officiel et le dit dans son pied de page.

## 4. La séquence 3D

Une seule expérience continue, en deux temps.

### Temps 1 — l'arrivée (hero)

Vue orbitale, la Terre de nuit, sombre, discrète. La caméra descend vers l'Europe puis cadre la
France. Durée **≤ 3 secondes**, une seule fois par session, **skippable au premier scroll, clic ou
touche**. Le titre et la barre de recherche sont **présents et utilisables dès la première frame** :
la séquence ne doit jamais retarder l'accès à l'information.

Pendant la descente, les départements en danger 3 ou 4 s'allument progressivement. Aucun son.

`prefers-reduced-motion: reduce` → pas de séquence du tout, on démarre directement sur la vue de
travail. Même chose si le WebGL n'est pas disponible.

### Temps 2 — la vue de travail (l'écran principal)

France en **plan 3D légèrement incliné** (~35–45° de tangage), pas un globe. C'est ici qu'on passe
99 % du temps.

- **Sol** : les 96 départements, **extrudés proportionnellement au niveau de danger J+1** (niveau 1
  quasi plat, niveau 4 nettement en relief), teintés avec `--danger-1..4`. Les départements non
  couverts restent plats en `--danger-nd`.
- **Couche du dessus** : les **massifs interdits**, posés sur le relief, en volume distinct et plus
  saturé. Ce sont eux le sujet. Le fond départemental **s'atténue au zoom** pour ne pas les masquer.
- **Les quatre statuts sont distinguables sans la couleur** : `INTERDIT` = volume plein arête vive ;
  `sans terme` = plein + chevron `▲` flottant ; `incertain` = hachuré 45°, arêtes pointillées ;
  `levée` = contour seul, remplissage 12 %.
- **Les zones sans contour** ne peuvent pas être dessinées : elles apparaissent comme un **marqueur
  posé au centroïde du département**, avec la mention « périmètre non numérisé », et restent
  listées dans le panneau.
- Interactions : orbite, zoom, clic sur un département ou un massif. Un bouton **« Zoomer sur les
  zones interdites »**. Pas de rotation automatique en boucle.

**Ce qui reste hors de la 3D, toujours** : tout le texte légal — nom du massif, période, numéro
d'arrêté, dérogations, avertissement. C'est du HTML posé par-dessus le canvas, sélectionnable et
lisible par un lecteur d'écran. Aucun texte réglementaire en texture.

## 5. Les écrans à produire

Les trois premiers sont prioritaires.

1. **Vue principale desktop** — hero + carte 3D + les trois colonnes : contexte à gauche (300px),
   carte au centre, **zones interdites à droite** (380px). Le bandeau d'avertissement est visible
   sans scroller.
2. **Panneau « zones interdites »** — trié par urgence, jamais alphabétiquement :
   `INTERDIT` → `sans terme` → `incertain` → `levée / expirée`. Chaque entrée : nom du massif, badge
   de statut, département, **période en clair** (« du 24 au 31 juillet 2026 inclus · encore 5 jours »
   / « depuis le 17 juillet 2026 — aucune date de fin dans l'arrêté »), numéro d'arrêté cliquable
   vers le PDF, dérogations dépliables.
3. **Fiche massif** (panneau ou plein écran) — cas de référence : **Illarata – Taglio Rosso** en
   Corse-du-Sud. Interdit, sans date de fin, avec **trois dérogations** très concrètes (accès
   véhicules entre deux points routiers, parking limité à 260 places, site des « Trois Piscines »
   accessible uniquement par navette communale). Ces dérogations sont souvent l'information la plus
   utile sur le terrain : elles doivent être trouvables, pas enterrées.
4. **Fiche département** — niveaux J+1 / J+2, arrêtés permanents connus, trouvailles de veille,
   indicateurs de couverture des sources. Cas de référence : **Bouches-du-Rhône (13)**, régime
   quotidien, tous les massifs fermés pour la seule journée du 23/07/2026.
5. **Les états qu'on oublie toujours** — et qui sont ici la moitié du sujet :
   *statut incertain* (Trois Pignons : « jusqu'à la fin de la vigilance rouge canicule »,
   impossible de dire depuis l'arrêté seul si c'est encore en vigueur) · *zone sans contour*
   (Bavella) · *interdiction levée* (Bavella, abrogée en 3 jours) · *département non couvert* ·
   *hors saison* · *données du jour indisponibles*.
6. **Mobile (375px)** — **les interdictions passent en premier**, avant la carte. Sur téléphone, le
   sujet c'est « est-ce fermé », pas la cartographie. La 3D se dégrade proprement : plan fixe ou
   carte 2D. Une réponse lisible en moins de dix secondes, sur un réseau faible.
7. **Carte sociale / OG 1200×630** — même charte terminal, pour le partage et l'article de blog.

## 6. Contraintes techniques du rendu

L'implémentation se fera en **React Three Fiber + drei**. Conçois en conséquence :

- **Fallback 2D obligatoire** — pas de WebGL, GPU faible, `reduced-motion` : on bascule sur une
  carte plate. L'information doit être **intégralement** accessible sans 3D. La 3D est un confort,
  jamais un prérequis.
- Budget : **60 fps sur un laptop d'entrée de gamme**, ≥ 30 fps sur mobile milieu de gamme.
  Instancier les départements, LOD sur les contours de massifs (Fontainebleau seul pèse 204 polygones).
- Contraste **AA** sur fond sombre pour tout texte, y compris les libellés superposés au canvas.
- Navigation clavier complète : la 3D ne doit jamais être le seul chemin vers une information.
- Chargement progressif : squelette d'interface d'abord, données ensuite, 3D en dernier.

## 7. SEO, GEO et partage

- `<title>` et meta description orientés recherche réelle : « massif fermé », « interdiction accès
  forêt », « risque incendie <département> ».
- **JSON-LD** : `Dataset` (le flux agrégé, sources et licences) + `WebSite` avec `SearchAction`.
  Ne **pas** utiliser un balisage qui laisserait croire à une publication officielle.
- Chaque massif et chaque département méritent une **URL propre et partageable**
  (`/massif/fontainebleau`, `/departement/13`) — c'est ce que les gens envoient dans un groupe
  WhatsApp la veille d'une sortie.
- Sources et licences visibles : Météo-France (Licence Ouverte 2.0), IGN/FCBA, OpenStreetMap (ODbL),
  sites `<departement>.gouv.fr`.
- Pied de page : badges 🛡 Cyber.gouv.fr et 🇫🇷 France Num, `© 1998–2026 JulienWeb.fr ツ`,
  et la mention **« Ce projet n'est pas officiel et ne remplace aucune publication préfectorale »**.

## 8. Ce que j'attends en retour

Pour chaque écran : la maquette, plus une note courte sur **les arbitrages** — ce que tu as choisi
de montrer d'abord, ce que tu as relégué, et pourquoi. Si une des cinq règles t'a forcé à
sacrifier quelque chose de visuellement plus fort, dis-le explicitement.

Commence par l'**écran 1** seul (hero + séquence 3D + vue de travail). On valide, puis on enchaîne.

# ⬆️ COPIER JUSQU'ICI ⬆️
