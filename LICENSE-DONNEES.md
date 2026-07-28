# Licences des données

La licence [MIT](LICENSE) couvre **le code** de ce dépôt. Elle ne couvre pas les données qu'il
collecte, transforme et redistribue : celles-ci restent sous la licence de leur producteur, et
l'attribution est obligatoire.

> Ce fichier est séparé de `LICENSE` à dessein : GitHub ne reconnaît une licence que si le fichier
> `LICENSE` contient le texte canonique **et rien d'autre**. Y ajouter ces précisions faisait
> basculer le dépôt en `NOASSERTION` — donc « aucune licence détectée » pour quiconque arrive
> sur la page, alors même que le code est bien sous MIT.

| Donnée | Producteur | Licence | Attribution |
|---|---|---|---|
| Contours de massifs, limites administratives | contributeurs OpenStreetMap | **ODbL** | « © contributeurs OpenStreetMap » — <https://www.openstreetmap.org/copyright> |
| Météo des forêts (danger feu J+1/J+2) | Météo-France, via data.gouv.fr | **Licence Ouverte 2.0** | « Source : Météo-France » |
| Arrêtés préfectoraux référencés | IGN + FCBA (NaviForest) | consultation, index non exhaustif | lien vers la source, jamais la seule référence |
| Fonds de carte vectoriels PLAN.IGN | IGN / Géoplateforme | accès libre sans clé | « © IGN / Géoplateforme » |
| Textes des arrêtés préfectoraux | préfectures de département | documents administratifs publics | cités et liés à leur PDF officiel |

**Conséquence pratique de l'ODbL** : si vous réutilisez les contours de massifs et que vous les
enrichissez, la base dérivée doit rester sous ODbL. Le code qui les manipule, lui, reste librement
réutilisable sous MIT.

## Avertissement — à propager, pas à retirer

**Ce projet n'est pas officiel** et ne remplace aucune publication préfectorale. Seul **l'arrêté
préfectoral publié fait foi**.

La « Météo des forêts » est un indicateur **départemental et indicatif** : elle n'autorise ni
n'interdit l'accès à un massif. Des promeneurs sont verbalisés chaque été à cause de cette
confusion, et les amendes ne sont pas symboliques.

Cet avertissement est transporté dans les données elles-mêmes (champ `avertissement`). Toute
réutilisation, y compris partielle, doit le rendre **aussi visible que la donnée** qu'il accompagne.
Il n'est pas là pour décorer.
