---
name: deploy-ftp-feux
description: Déploiement SFTP du front statique feux.julienweb.fr — OVH mutualisé clusterNNN, docroot /home/UTILISATEUR-FTP/feux, preset poc. Trigger /deploy-ftp depuis ce projet.
trigger: /deploy-ftp
---

> **Snapshot LOCAL** de `D:/Google Drive/_Claude/skills/web/deploy-ftp/SKILL.md` — figé le 2026-07-27 pour `feux.julienweb.fr`.
> Le snapshot voisin `Julienweb.fr/ops/skills/deploy-ftp-julienweb/` couvre le site WordPress principal ; les deux partagent **la même config et le même hébergement**.
> Patches généralisables → backsync pack web (cf `D:/Google Drive/_Claude/WORKFLOW.md § Backsync`).

# deploy-ftp — feux.julienweb.fr

Pousse le front statique du POC sur le sous-domaine. Deux fichiers utiles, aucune base de données, aucun PHP applicatif.

## Cible figée

| | |
|---|---|
| **Protocole** | **SFTP port 22** — FTPS explicite REFUSÉ par le cluster OVH |
| Host / user | `ftp.clusterNNN.hosting.ovh.net` / `UTILISATEUR-FTP` |
| **Docroot** | `/home/UTILISATEUR-FTP/feux/` (provisionné côté OVH le 2026-07-26) |
| Source locale | `../feux.julienweb.fr/app/` — **le dépôt git est la source de vérité, pas de miroir local** |
| URL | https://feux.julienweb.fr/ |
| Config | `D:/Google Drive/_WWW_/Julienweb.fr-public/.deploy-ftp.json`, cible `feux` — **partagée, jamais commitée**. L'offre mutualisée OVH n'autorise **qu'un seul utilisateur FTP** : ce sous-domaine utilise forcément le même compte que julienweb.fr, et ce compte voit tout l'hébergement. |
| Helper | `ops/scripts/_sftp_op.js` (copie du canonique, aucun secret dedans) |
| `.ovhconfig` | au niveau `/home/UTILISATEUR-FTP/` — **commun à tout l'hébergement**, une modif ici touche aussi julienweb.fr |

Le helper trouve la config tout seul en remontant vers `../Julienweb.fr-public/.deploy-ftp.json`. Rien à passer en argument.

## Commandes

```bash
node ops/scripts/_sftp_op.js targets                        # ce qui est déployable
node ops/scripts/_sftp_op.js --target=feux --dry-run preset poc
node ops/scripts/_sftp_op.js --target=feux preset poc       # le déploiement
node ops/scripts/_sftp_op.js --target=feux ls .             # état du docroot
```

⚠️ Sous Git Bash, préfixer `MSYS_NO_PATHCONV=1` dès qu'un argument commence par `/` — sinon `/home/UTILISATEUR-FTP/...` devient `C:/Program Files/Git/home/UTILISATEUR-FTP/...` avant d'atteindre Node.

## Preset `poc`

| Fichier | Rôle | Piège |
|---|---|---|
| `index.html` | l'application entière (carte, panneaux, logique) | — |
| `data.js` | bundle de données ~1,4 Mo | **généré, et `.gitignore`** |
| `robots.txt` | politique de crawl | — |
| `.htaccess` | noindex + gzip + cache | — |

### Le piège `data.js`

`app/data.js` est **exclu du dépôt** (1 Mo de diff à chaque collecte pour zéro information neuve : tout vient de `data/*.json` et des GeoJSON, déjà versionnés). Conséquence directe : un clone frais **n'a pas** ce fichier, et un déploiement fait sans régénérer publie un bulletin périmé — ou échoue.

**Toujours régénérer avant de déployer :**

```bash
npm run poc          # node app/build-data.js → app/data.js
```

Et pour un bulletin réellement à jour, la collecte complète d'abord :

```bash
npm run collect      # meteo + naviforest + massifs + veille + poc
```

## Désindexation (posée le 2026-07-27)

Le site est **volontairement invisible** des moteurs tant que le POC n'est pas stabilisé. Trois pièces, cohérentes entre elles :

1. `index.html` → `<meta name="robots" content="noindex, nofollow, noarchive">`
2. `.htaccess` → `Header set X-Robots-Tag "noindex, nofollow, noarchive"`
3. `robots.txt` → **crawl autorisé** (`Allow: /`)

Le point 3 est contre-intuitif et c'est le plus important : un `Disallow: /` empêcherait les robots de **lire** le noindex. Google indexerait alors l'URL nue, sans titre ni description, et sans moyen de la faire sortir. Bloquer le crawl et vouloir désindexer sont deux intentions incompatibles.

**Pour publier** : retirer 1 **et** 2, ajouter une ligne `Sitemap:` dans `robots.txt`, redéployer, puis demander l'indexation dans la Search Console.

## Vérification post-déploiement

```bash
curl -sI "https://feux.julienweb.fr/?nocache=$(date +%s)"
```

Attendu : `200`, `Last-Modified` récent, et `X-Robots-Tag: noindex, nofollow, noarchive`.

Le `curl` ne prouve que la livraison des octets. Le POC ne **fonctionne** que si la carte se construit — vérifier le rendu réel dans le navigateur : carte visible, panneaux latéraux peuplés, console sans erreur. Un `data.js` tronqué renvoie un `200` parfaitement satisfaisant sur une page blanche.

## Ce que ce déploiement ne fait pas

- **N'efface rien** côté distant. `preset` et `sync` ajoutent et écrasent ; un fichier retiré en local reste en ligne. Pour supprimer : `rm` explicite.
- **Ne touche pas** au `.ovhconfig`, partagé avec julienweb.fr.
- **Ne publie pas** `data/*.json` bruts. Le projet vise à terme un flux JSON public — quand ce sera décidé, ajouter un preset `flux` et une cible `/data/` dans le docroot, pas un `sync .` élargi à l'aveugle.

## CHANGELOG

- 2026-07-27 (nuit, audit) : **`preconnect` Google Fonts retirés**. L'export embarquait `<link rel="preconnect">` vers `fonts.googleapis.com` et `fonts.gstatic.com`. Un `preconnect` **n'émet aucune requête HTTP** — il est donc invisible dans un relevé réseau — mais **ouvre une connexion TLS** vers Google à chaque visite : l'IP du visiteur y part. Vestiges inutiles (les 40 polices sont inlinées en `data:`), et ils rendaient **fausse** la phrase des mentions légales « seul l'hébergeur OVH enregistre l'adresse IP ». Réflexe à garder : sur un export Claude Design, auditer `document.querySelectorAll('link')`, pas seulement le relevé réseau. Dépôt GitHub créé le même jour : `molokoloco/feux.julienweb.fr` (privé, branche `main`).
- 2026-07-27 (soir) : **bascule sur la maquette Claude Design** (`design/Feux - Vue principale (autonome).html` → `app/index.html`, l'app vanilla conservée en `app/index-collecteurs.html`). Deux pièges payés, à ne pas repayer :
  - le bundler **réécrit tout le document** au chargement → une `<meta name="robots">` posée dans le `<head>` du fichier n'existe plus dans le DOM. Vérifier `document.querySelector('meta[name=robots]')` après rendu, pas la présence dans le source. L'injecter dans le `<script type="__bundler/template">`. Seul l'en-tête HTTP `X-Robots-Tag` est inconditionnel.
  - le HTML du bundle vit dans une **chaîne JS échappée** (`"` → `\"`, `/` → `/`). Toute retouche doit respecter cet échappement, et s'ancrer sur un littéral unique vérifié par un `count()==1` avant écriture.
- 2026-07-27 : création du snapshot. Mise en ligne initiale du POC en noindex. Backsync vers le pack web du **schéma de config multi-cible v2** (connexion à la racine + `targets`, `local_base` résolu depuis le dossier de la config, recherche remontante du fichier) et des ops **`preset` / `sync` / `mkdir` / `--dry-run`** du helper — nés ici du besoin de servir deux docroots sur un hébergement unique sans dupliquer le mot de passe.
