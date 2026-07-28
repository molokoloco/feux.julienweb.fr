/**
 * build-socle.js — produit data/socle.json, la part HUMAINE du flux.
 *
 * À poser dans le dépôt en `ops/build-socle.js` et à câbler dans package.json :
 *   "socle": "node ops/build-socle.js"
 *   "collect": "... && npm run poc && npm run socle"
 *
 * POURQUOI CE FICHIER EXISTE
 * Le serveur OVH n'a pas Node, et surtout il n'a PAS LE DROIT de produire ces
 * données : elles viennent soit d'un crawl préfectoral interdit depuis l'IP
 * mutualisée (veille), soit d'une lecture humaine de PDF scannés (zones), soit
 * d'un travail cartographique manuel (massifs). Le socle est donc figé ici, sur
 * le poste de Julien, poussé par SFTP, et le cron.php serveur ne fait que le
 * recopier verbatim en y ajoutant les deux sources volatiles autorisées
 * (Météo des forêts, NaviForest).
 *
 * Le serveur n'écrit JAMAIS ce fichier. Il le lit, le valide (fail closed sur
 * `confiance_dates` et `avertissement`) et refuse de publier s'il est incomplet.
 *
 * Déploiement :
 *   node ops/build-socle.js
 *   node ops/scripts/_sftp_op.js --target=feux put data/socle.json
 */

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const lire = (p) => JSON.parse(fs.readFileSync(path.join(RACINE, p), 'utf8'));
const lireOpt = (p, def) => { try { return lire(p); } catch { return def; } };

const pkg = lire('package.json');
const interdits = lire('data/zones-interdites.json');
const massifs = lireOpt('data/massifs.json', null);
const veille = lireOpt('data/veille-prefectures.json', { stats: {}, departements: [] });
const mdf = lire('data/meteo-forets.json');
const navi = lire('data/naviforest.json');

// ── Garde-fou doctrinal, côté producteur ────────────────────────────────────
// Le serveur refuse déjà de publier une zone sans confiance_dates ; on échoue
// ici, à la source, pour ne même pas expédier un socle bancal.
const manquants = interdits.zones
  .map((z, i) => ({ i, z }))
  .filter(({ z }) => !['verifiee', 'partielle', 'inconnue'].includes(z.confiance_dates));
if (manquants.length) {
  console.error(`❌ ${manquants.length} zone(s) sans confiance_dates valide : #${manquants.map((m) => m.i).join(', #')}`);
  process.exit(1);
}
if (!mdf.avertissement || !navi.avertissement) {
  console.error('❌ avertissement absent en amont — socle refusé');
  process.exit(1);
}

const socle = {
  version: pkg.version,
  genere_le: new Date().toISOString(),
  genere_par: 'ops/build-socle.js (poste local)',

  // Avertissement global : c'est CE texte que le serveur recopie verbatim.
  avertissement:
    "La Météo des forêts est un indicateur météorologique INDICATIF et DÉPARTEMENTAL. " +
    "Elle ne vaut ni autorisation ni interdiction d'accès : seul l'arrêté préfectoral " +
    "zonal réglemente l'accès aux massifs et l'emploi du feu. En cas de doute, se " +
    "reporter à l'arrêté lui-même, dont le lien figure sur chaque zone.",

  // Avertissements par source, repris tels quels des collecteurs.
  avertissements: {
    mdf: mdf.avertissement,
    navi: navi.avertissement,
    veille: veille.avertissement || null,
  },

  // Zones qualifiées à la main. Recopie INTÉGRALE : dates, confiance_dates,
  // dérogations, notes, sources. On n'élague rien, on ne recalcule rien.
  interdits: interdits.zones,

  massifs: massifs
    ? { _doc: massifs._doc, massifs: massifs.massifs || massifs.registre || null }
    : null,

  veille: { stats: veille.stats || {}, departements: veille.departements || [] },
};

const sortie = path.join(RACINE, 'data', 'socle.json');
fs.writeFileSync(sortie, JSON.stringify(socle, null, 2) + '\n', 'utf8');

const parConfiance = socle.interdits.reduce((a, z) => ((a[z.confiance_dates] = (a[z.confiance_dates] || 0) + 1), a), {});
console.log(
  `✅ data/socle.json — v${socle.version} · ${socle.interdits.length} zone(s) ` +
    `(${Object.entries(parConfiance).map(([k, v]) => `${k}:${v}`).join(' ')}) · ` +
    `veille ${socle.veille.departements.length} dép.\n` +
    `   → pousser : node ops/scripts/_sftp_op.js --target=feux put data/socle.json`
);
