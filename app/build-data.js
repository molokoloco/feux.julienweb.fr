/**
 * build-data.js — embarque les sorties des collecteurs dans app/data.js.
 *
 * Même parti pris que feux-foret-carte : la page doit marcher en DOUBLE-CLIC sur
 * index.html, sans serveur (fetch() sur file:// est bloqué par CORS), et hors
 * connexion à l'exception des tuiles de fond.
 *
 * Usage : node app/build-data.js
 */

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const lire = (p) => JSON.parse(fs.readFileSync(path.join(RACINE, p), 'utf8'));

const geo = lire('app/departements.geojson');
const mdf = lire('data/meteo-forets.json');
const navi = lire('data/naviforest.json');
const massifs = lire('app/massifs.geojson');
const interdits = lire('data/zones-interdites.json');
let veille = { departements: [], stats: {} };
try { veille = lire('data/veille-prefectures.json'); } catch { /* veille pas encore lancée */ }

// On n'embarque que ce dont la page a besoin : l'historique 14 jours reste dans data/.
const paquet = {
  genere_le: new Date().toISOString(),
  geo,
  mdf: { bulletin_du: mdf.bulletin_du, bulletin: mdf.bulletin, stats: mdf.stats, avertissement: mdf.avertissement },
  navi: { stats: navi.stats, departements: navi.departements, avertissement: navi.avertissement },
  veille: { stats: veille.stats || {}, departements: veille.departements || [] },
  massifs,
  interdits: interdits.zones,
};

const sortie = path.join(__dirname, 'data.js');
fs.writeFileSync(sortie, 'window.POC = ' + JSON.stringify(paquet) + ';\n', 'utf8');

const ko = Math.round(fs.statSync(sortie).size / 1024);
console.log(
  `✅ app/data.js — ${ko} Ko · bulletin ${paquet.mdf.bulletin_du} · ` +
    `${paquet.geo.features.length} départements · ${paquet.navi.stats.arretes_total} arrêté(s) NaviForest · ` +
    `${paquet.veille.stats.trouvailles || 0} trouvaille(s) de veille`
);
