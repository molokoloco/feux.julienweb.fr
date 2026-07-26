/**
 * naviforest.js — Parseur de la page nationale NaviForest (IGN + FCBA).
 *
 * Source : https://naviforest.ign.fr/arretes-prefectoraux-acces-massifs-forestiers
 *   → recense les arrêtés préfectoraux réglementant l'accès aux massifs / l'emploi
 *     du feu, pour ~96 départements, avec le PDF et la date de fin de validité.
 *
 * C'est LA raison d'être de ce collecteur : une seule page à parser au lieu de
 * 101 sites préfectoraux hétérogènes (aucun n'expose de RSS ni de sitemap).
 *
 * Limites à garder en tête (l'IGN les assume explicitement sur la page) :
 *   - alimenté par les services de l'État en département → très lacunaire
 *     (beaucoup de départements sans aucun arrêté listé)
 *   - ce sont les arrêtés PERMANENTS (emploi du feu, brûlage, prévention),
 *     pas les fermetures événementielles type Fontainebleau 07/2026
 *   - « seul l'arrêté fait foi », cette donnée est un index, pas une autorité
 *
 * Sortie : data/naviforest.json
 *
 * Usage :
 *   node collectors/naviforest.js            # avec cache (6h)
 *   node collectors/naviforest.js --fresh    # force le réseau
 */

const path = require('path');
const { getText, decodeEntities, writeJSON } = require('./_http');

const SOURCE_URL = 'https://naviforest.ign.fr/arretes-prefectoraux-acces-massifs-forestiers';
const BASE = 'https://naviforest.ign.fr';
const OUT = path.join(__dirname, '..', 'data', 'naviforest.json');

/** "Valide jusqu'au 31-12-2026" → "2026-12-31" (ISO, triable). */
function parseValidite(txt) {
  const m = /(\d{2})-(\d{2})-(\d{4})/.exec(txt || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function parse(html) {
  const departements = new Map();

  // La page est un <table> : une ou plusieurs <tr data-id="NN"> par département.
  // La 1re ligne porte td.grid-name (rowspan = nb d'arrêtés), les suivantes
  // ne portent que les cellules d'arrêté.
  const rows = html.split(/<tr\s+data-id="/).slice(1);

  for (const raw of rows) {
    const dep = raw.slice(0, 2);
    if (!/^[0-9][0-9AB]$/i.test(dep)) continue;

    if (!departements.has(dep)) departements.set(dep, { departement: dep, nom: null, arretes: [] });
    const entry = departements.get(dep);

    const nameCell = /class="grid-name"\s*>([\s\S]*?)<\/td>/.exec(raw);
    if (nameCell && !entry.nom) {
      // "01 - AIN" → "AIN"
      entry.nom = decodeEntities(nameCell[1]).replace(/^\d{2}\s*-\s*/, '');
    }

    // Un arrêté = un <td class="decree-name"> suivi d'un <td class="decree-date">
    const decreeRe =
      /<td class="decree-name"[\s\S]*?href="([^"]+)"[\s\S]*?>([^<]*)<\/a>[\s\S]*?<td class="decree-date"\s*>([\s\S]*?)<\/td>/g;
    let m;
    while ((m = decreeRe.exec(raw)) !== null) {
      const href = m[1].trim();
      const fichier = decodeEntities(m[2]);
      const dateTxt = decodeEntities(m[3]);
      entry.arretes.push({
        fichier,
        url: href.startsWith('http') ? href : BASE + href,
        validite_texte: dateTxt || null,
        valide_jusqu_au: parseValidite(dateTxt),
      });
    }
  }

  return [...departements.values()].sort((a, b) => a.departement.localeCompare(b.departement));
}

async function main() {
  const fresh = process.argv.includes('--fresh');
  const html = await getText(SOURCE_URL, { maxAgeMs: fresh ? 0 : 6 * 3600 * 1000 });
  const departements = parse(html);

  const avec = departements.filter((d) => d.arretes.length > 0);
  const total = departements.reduce((n, d) => n + d.arretes.length, 0);

  const out = {
    source: SOURCE_URL,
    producteur: 'IGN + FCBA (NaviForest)',
    avertissement:
      "Index non officiel. La mise à jour relève des services de l'État en département : " +
      "des arrêtés peuvent manquer ou ne plus être en vigueur. Seul l'arrêté préfectoral fait foi.",
    collecte: new Date().toISOString(),
    stats: {
      departements_listes: departements.length,
      departements_avec_arrete: avec.length,
      departements_sans_arrete: departements.length - avec.length,
      arretes_total: total,
    },
    departements,
  };

  writeJSON(OUT, out);
  console.log(
    `✅ NaviForest — ${total} arrêté(s) sur ${avec.length}/${departements.length} départements\n` +
      `   sans arrêté : ${departements.filter((d) => !d.arretes.length).map((d) => d.departement).join(' ')}\n` +
      `   → ${OUT}`
  );
}

if (require.main === module) main().catch((e) => { console.error('❌', e.message); process.exit(1); });
module.exports = { parse, parseValidite, SOURCE_URL };
