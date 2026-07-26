/**
 * massifs-osm.js — contours des massifs depuis OpenStreetMap (Overpass).
 *
 * Lit le registre curaté data/massifs.json et produit app/massifs.geojson.
 * Les massifs sans correspondance OSM (`osm: []`) sont volontairement conservés
 * dans la sortie, SANS géométrie : une zone interdite dont on ignore le contour
 * doit rester visible dans l'interface, pas disparaître silencieusement.
 *
 * PIÈGES OVERPASS (payés le 26/07/2026)
 *   - User-Agent générique type Mozilla → 406. UA descriptif obligatoire (cf _http.js).
 *   - Une regex de nom NON bornée géographiquement → « Query timed out after 64 seconds ».
 *     Toujours borner (id explicite, ou bbox).
 *   - overpass-api.de renvoie par intermittence « Dispatcher_Client::request_read_and_idx »
 *     (serveur saturé, réponse XML et non JSON) → bascule automatique sur un miroir.
 *
 * Licence des contours : © contributeurs OpenStreetMap, ODbL.
 *
 * Usage : node collectors/massifs-osm.js [--fresh]
 */

const path = require('path');
const { get, writeJSON, sleep } = require('./_http');

const MIROIRS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
];
const REGISTRE = path.join(__dirname, '..', 'data', 'massifs.json');
const OUT = path.join(__dirname, '..', 'app', 'massifs.geojson');

/** Interroge Overpass en basculant de miroir si la réponse n'est pas du JSON. */
async function overpass(query, maxAgeMs) {
  let derniere;
  for (const miroir of MIROIRS) {
    try {
      const url = `${miroir}?data=${encodeURIComponent(query)}`;
      const { buf } = await get(url, { maxAgeMs, ext: '.json', retries: 1 });
      const txt = buf.toString('utf8');
      if (!txt.trimStart().startsWith('{')) {
        derniere = new Error(`réponse non-JSON de ${miroir} (serveur saturé ?)`);
        await sleep(2000);
        continue;
      }
      const data = JSON.parse(txt);
      if (data.remark && /timed out|error/i.test(data.remark)) {
        derniere = new Error(`${miroir} : ${data.remark}`);
        continue;
      }
      return data;
    } catch (e) {
      derniere = e;
      await sleep(2000);
    }
  }
  throw derniere || new Error('tous les miroirs Overpass ont échoué');
}

/**
 * Récupère la géométrie assemblée d'une relation via polygons.openstreetmap.fr.
 *
 * Pourquoi ce service plutôt qu'Overpass `out geom` : une relation multipolygone
 * arrive en segments à recoller, et un recollage maison se plante sur les cas réels
 * (essayé le 26/07/2026 : 81 anneaux incohérents pour Fontainebleau, ZÉRO pour la
 * Commanderie). Ce service fait l'assemblage côté serveur — c'est déjà la méthode
 * retenue sur feux-foret-carte. Overpass reste utile pour CHERCHER des objets,
 * pas pour en assembler la géométrie.
 */
async function polygoneRelation(id, maxAgeMs) {
  const url = `https://polygons.openstreetmap.fr/get_geojson.py?id=${id}&params=0`;
  const { buf } = await get(url, { maxAgeMs, ext: '.json', retries: 2 });
  const txt = buf.toString('utf8');
  if (!txt.trimStart().startsWith('{')) {
    throw new Error(`relation ${id} : réponse non-JSON (« ${txt.slice(0, 60).trim()} »)`);
  }
  const g = JSON.parse(txt);
  if (!g.coordinates || !g.coordinates.length) throw new Error(`relation ${id} : géométrie vide`);
  return g; // { type: 'MultiPolygon'|'Polygon', coordinates }
}

async function main() {
  const fresh = process.argv.includes('--fresh');
  const maxAgeMs = fresh ? 0 : 7 * 24 * 3600 * 1000; // les contours ne bougent pas d'un jour à l'autre
  const registre = JSON.parse(require('fs').readFileSync(REGISTRE, 'utf8'));

  const features = [];
  const sansGeometrie = [];

  for (const m of registre.massifs) {
    if (!m.osm || !m.osm.length) {
      sansGeometrie.push(m);
      features.push({
        type: 'Feature',
        geometry: null,
        properties: { cle: m.cle, nom: m.nom, departement: m.departement, confiance: m.confiance, note: m.note, osm: [] },
      });
      console.log(`   ⚠️  ${m.cle.padEnd(16)} aucun contour OSM — conservé sans géométrie`);
      continue;
    }

    const parties = [];
    for (const o of m.osm) {
      if (o.type !== 'relation') throw new Error(`${m.cle} : seules les relations sont gérées (reçu ${o.type})`);
      const g = await polygoneRelation(o.id, maxAgeMs);
      parties.push(...(g.type === 'Polygon' ? [g.coordinates] : g.coordinates));
      await sleep(1200); // politesse
    }
    if (!parties.length) {
      console.log(`   ⚠️  ${m.cle.padEnd(16)} géométrie vide`);
      continue;
    }
    features.push({
      type: 'Feature',
      geometry: { type: 'MultiPolygon', coordinates: parties },
      properties: { cle: m.cle, nom: m.nom, departement: m.departement, confiance: m.confiance, note: m.note, osm: m.osm },
    });
    console.log(`   ✅ ${m.cle.padEnd(16)} ${parties.length} polygone(s)`);
  }

  writeJSON(OUT, {
    type: 'FeatureCollection',
    attribution: '© les contributeurs OpenStreetMap — ODbL',
    genere_le: new Date().toISOString(),
    features,
  });

  console.log(
    `\n✅ ${features.length} massif(s) — ${features.length - sansGeometrie.length} avec contour, ` +
      `${sansGeometrie.length} sans (${sansGeometrie.map((m) => m.cle).join(', ') || '—'})\n   → ${OUT}`
  );
}

if (require.main === module) main().catch((e) => { console.error('❌', e.message); process.exit(1); });
module.exports = { polygoneRelation, overpass };
