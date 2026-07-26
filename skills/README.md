# skills/ — snapshots locaux

Snapshots des skills globaux, **adaptés à ce projet** et figés (chemins, doctrine, garde-fous).
Priorité : un snapshot local, s'il existe, l'emporte sur son canonique.

| Skill | Trigger | Canonique | Rôle ici |
|---|---|---|---|
| [wrap-up](wrap-up/SKILL.md) | `/wrap-up` | `~/.claude/skills/wrap-up/SKILL.md` | fin de session : synthèse, memory, CLAUDE.md/README, **vérité des données**, frontière avec les projets voisins, mails, commit local |

## Conventions

- **Backsync** — un patch généralisable remonte au canonique : pack web `D:/Google Drive/_Claude/skills/web/` (skills web) ou global `~/.claude/skills/` (transverses). Un patch spécifique feux (doctrine des arrêtés, seuils de crawl, échéance du 31/07) reste local.
- **Sync inbound** — `/wrap-in` rattrape les patches du canonique non encore appliqués ici.
- Chaque snapshot garde son **CHANGELOG** en bas de fichier : ce qui a été adapté, et pourquoi.
