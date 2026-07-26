/**
 * meteo-forets.js — Connecteur « Météo des forêts » (Météo-France).
 *
 * Niveau de danger météorologique de feu de forêt, par département, pour J+1 et J+2.
 * Produit chaque jour à 17h pendant la saison des feux (28/05 → 30/09 en 2026).
 *
 * SOURCE RETENUE : l'archive annuelle CSV publiée sur data.gouv.fr.
 * Contre-intuitif mais vérifié le 26/07/2026 : ce fichier n'est pas un historique
 * figé, il est RAFRAÎCHI QUOTIDIENNEMENT (dernière ligne = jour même, 14:50 UTC).
 * → flux national exploitable sans clé API, sous Licence Ouverte 2.0.
 * L'API temps réel du portail Météo-France reste une option, mais elle impose une
 * inscription + une clé applicative : inutile tant que le CSV suffit.
 *
 * Schéma amont : date;num_dep;niveau_j1;niveau_j2;nom_dep
 * Niveaux : 1 vert = faible · 2 jaune = modéré · 3 orange = élevé · 4 rouge = très élevé
 *
 * ⚠️ AVERTISSEMENT NON NÉGOCIABLE (à propager jusqu'à l'affichage) :
 * la Météo des forêts est INDICATIVE et DÉPARTEMENTALE. Elle ne dit pas si un massif
 * est ouvert ou fermé — seul l'arrêté préfectoral zonal l'autorise ou l'interdit.
 * Des gens se font verbaliser chaque année à cause de cette confusion.
 *
 * Sortie : data/meteo-forets.json  (dernier bulletin + série des 14 derniers jours)
 *
 * Usage :
 *   node collectors/meteo-forets.js
 *   node collectors/meteo-forets.js --fresh --year 2026 --history 30
 */

const path = require('path');
const zlib = require('zlib');
const { get, getJSON, writeJSON } = require('./_http');

const DATASET_API = 'https://www.data.gouv.fr/api/1/datasets/archives-de-la-meteo-des-forets/';
const OUT = path.join(__dirname, '..', 'data', 'meteo-forets.json');

const LIBELLES = { 1: 'faible', 2: 'modéré', 3: 'élevé', 4: 'très élevé' };
const COULEURS = { 1: 'vert', 2: 'jaune', 3: 'orange', 4: 'rouge' };

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

/** Résout l'URL de l'archive de l'année via l'API data.gouv (pas d'URL en dur). */
async function resolveResources(year, maxAgeMs) {
  const ds = await getJSON(DATASET_API, { maxAgeMs });
  const csv = ds.resources.find((r) => r.title === `mdf.${year}` || (r.url || '').includes(`mdf_${year}.csv.gz`));
  const geo = ds.resources.find((r) => (r.format || '').toLowerCase() === 'geojson');
  if (!csv) throw new Error(`archive mdf.${year} introuvable dans le dataset data.gouv`);
  return {
    csvUrl: csv.url,
    geojsonUrl: geo ? geo.url : null,
    licence: ds.license,
    frequence: ds.frequency,
    maj_dataset: ds.last_update,
  };
}

function parseCSV(text) {
  const lignes = text.split(/\r?\n/).filter(Boolean);
  const header = lignes[0].split(';');
  const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  const req = ['date', 'num_dep', 'niveau_j1', 'niveau_j2', 'nom_dep'];
  for (const c of req) if (!(c in idx)) throw new Error(`colonne "${c}" absente — schéma amont modifié : ${header}`);

  return lignes.slice(1).map((l) => {
    const c = l.split(';');
    return {
      date: c[idx.date],
      jour: (c[idx.date] || '').slice(0, 10),
      departement: c[idx.num_dep],
      nom: c[idx.nom_dep],
      j1: Number(c[idx.niveau_j1]),
      j2: Number(c[idx.niveau_j2]),
    };
  });
}

async function main() {
  const fresh = process.argv.includes('--fresh');
  const maxAgeMs = fresh ? 0 : 3 * 3600 * 1000;
  const year = arg('year', String(new Date().getFullYear()));
  const history = Number(arg('history', 14));

  const meta = await resolveResources(year, maxAgeMs);
  const { buf } = await get(meta.csvUrl, { maxAgeMs, ext: '.csv.gz' });
  const rows = parseCSV(zlib.gunzipSync(buf).toString('utf8'));
  if (!rows.length) throw new Error('archive vide');

  const jours = [...new Set(rows.map((r) => r.jour))].sort();
  const dernier = jours[jours.length - 1];
  const gardes = new Set(jours.slice(-history));

  const bulletin = rows
    .filter((r) => r.jour === dernier)
    .map((r) => ({
      departement: r.departement,
      nom: r.nom,
      j1: { niveau: r.j1, libelle: LIBELLES[r.j1] || null, couleur: COULEURS[r.j1] || null },
      j2: { niveau: r.j2, libelle: LIBELLES[r.j2] || null, couleur: COULEURS[r.j2] || null },
    }))
    .sort((a, b) => a.departement.localeCompare(b.departement));

  const parJour = {};
  for (const r of rows) {
    if (!gardes.has(r.jour)) continue;
    (parJour[r.jour] ||= {})[r.departement] = [r.j1, r.j2];
  }

  const alerte = bulletin.filter((d) => d.j1.niveau >= 3);

  writeJSON(OUT, {
    source: DATASET_API,
    producteur: 'Météo-France — Météo des forêts',
    licence: meta.licence,
    frequence: meta.frequence,
    maj_dataset: meta.maj_dataset,
    fichier_amont: meta.csvUrl,
    geometries_departements: meta.geojsonUrl,
    avertissement:
      "Indicateur météorologique INDICATIF à l'échelle du département. Il ne vaut pas " +
      "autorisation ni interdiction d'accès : seul l'arrêté préfectoral zonal réglemente " +
      "l'accès aux massifs et l'emploi du feu.",
    collecte: new Date().toISOString(),
    bulletin_du: dernier,
    stats: {
      departements: bulletin.length,
      jours_disponibles: jours.length,
      premier_jour: jours[0],
      departements_niveau_3_ou_4_j1: alerte.length,
    },
    bulletin,
    historique: { format: '{ jour: { dep: [j1, j2] } }', jours: parJour },
  });

  console.log(
    `✅ Météo des forêts — bulletin du ${dernier} · ${bulletin.length} départements\n` +
      `   niveau ≥ 3 (J+1) : ${alerte.length ? alerte.map((d) => `${d.departement}(${d.j1.niveau})`).join(' ') : 'aucun'}\n` +
      `   historique conservé : ${Object.keys(parJour).length} jours · → ${OUT}`
  );
}

if (require.main === module) main().catch((e) => { console.error('❌', e.message); process.exit(1); });
module.exports = { parseCSV, LIBELLES, COULEURS };
