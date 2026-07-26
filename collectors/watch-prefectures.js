/**
 * watch-prefectures.js — Détection des arrêtés préfectoraux « forêt / feu » événementiels.
 *
 * POURQUOI CE SCRIPT EXISTE
 * Les fermetures de massifs qui comptent (Fontainebleau 07/2026, Gironde tempête 02/2026)
 * sont des arrêtés ÉVÉNEMENTIELS. On a vérifié qu'aucun flux ne les expose :
 *   - pas d'API nationale des arrêtés préfectoraux (ReAcT/beta.gouv arrêté le 26/08/2025)
 *   - sur les sites .gouv.fr : /rss.xml, /rss, /feed, /sitemap.xml, /robots.txt → 404
 *   - NaviForest ne couvre que 25/96 départements et rate le 77 (vérifié 26/07/2026)
 * Reste le crawl. C'est ingrat, mais borné : les 101 sites tournent sur le même CMS.
 *
 * CE QUI EST RÉUTILISABLE D'UN SITE À L'AUTRE (vérifié sur 33, 40, 77, 83)
 *   - /Actualites répond 200 partout            → point d'entrée universel
 *   - /content/view/sitemap/2 répond 200 partout → plan du site (rubriques)
 *   - les PDF sont en /contenu/telechargement/<node>/<id>/file/<nom>.pdf
 *
 * POLITESSE : crawl borné (profondeur + nb de pages), séquentiel, pause entre requêtes,
 * cache disque, User-Agent joignable. On ne martèle pas des serveurs de l'État.
 *
 * ⚠️ LEÇON PAYÉE LE 26/07/2026 — la plateforme *.gouv.fr bannit vite.
 * Un premier jet (400 ms de pause, 30 pages × 10 départements) a fait bannir l'IP en ~2 minutes :
 * connexion acceptée puis fermée sèchement (curl → 000 en 0,1 s), sur TOUS les sites préfectoraux
 * à la fois, alors que naviforest.ign.fr répondait toujours. Blocage plateforme, pas panne locale.
 * D'où les valeurs par défaut volontairement timides ci-dessous, et le disjoncteur de _http.js.
 * Règle de survie : UN département à la fois (--dep), pas les dix d'affilée.
 *
 * Sorties :
 *   data/veille-prefectures.json   — trouvailles courantes
 *   data/.veille-state.json        — URLs déjà vues (pour ne signaler que le neuf)
 *
 * Usage :
 *   node collectors/watch-prefectures.js                  # tous les départements suivis
 *   node collectors/watch-prefectures.js --dep 33         # un seul
 *   node collectors/watch-prefectures.js --fresh --pages 60
 */

const fs = require('fs');
const path = require('path');
const { getText, decodeEntities, writeJSON, sleep } = require('./_http');

const DATA = path.join(__dirname, '..', 'data');
const OUT = path.join(DATA, 'veille-prefectures.json');
const STATE = path.join(DATA, '.veille-state.json');
const CIBLES = require(path.join(DATA, 'prefectures.json'));

// Ce qui nous intéresse dans un titre de lien ou une URL.
const PERTINENT =
  /for[eê]ts?|massifs?|incendies?|\bfeux?\b|br[uû]lage|fr[eé]quentation|p[eé]n[eé]tration|d[eé]broussaill|DFCI|emploi\s+du\s+feu/i;
// Ce qui indique une mesure (et non une page d'information générale).
const MESURE = /arr[eê]t[eé]|interdi|restrict|r[eé]glement|ferm|suspend|autoris/i;

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

/** Extrait les liens de la zone de contenu principale (hors nav/partage/footer). */
function extraireLiens(html, baseUrl) {
  const i = html.indexOf('id="main"');
  const zone = i > -1 ? html.slice(i) : html;
  const out = [];
  for (const m of zone.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]{0,300}?)<\/a>/g)) {
    const href = m[1].trim();
    const texte = decodeEntities(m[2].replace(/<[^>]+>/g, ' '));
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) continue;
    if (/facebook|twitter\.com|linkedin|instagram|adobe\.|browsehappy|microsoft\.com/i.test(href)) continue;
    let url;
    try { url = new URL(href, baseUrl); } catch { continue; }
    url.hash = '';
    out.push({ url: url.href, texte, host: url.host, pdf: /\.pdf(\?|$)/i.test(url.pathname) });
  }
  return out;
}

/** Un lien mérite-t-il d'être suivi pendant le crawl ? */
function aSuivre(lien, hostRef) {
  if (lien.host !== hostRef || lien.pdf) return false;
  const p = decodeURIComponent(lien.url);
  // On reste dans la branche actualités / publications, et on ignore les vieilles années.
  if (!/\/(Actualites|Publications|Actions-de-l-Etat)/i.test(p)) return false;
  const annees = p.match(/\b(20\d{2})\b/g);
  if (annees && !annees.some((a) => +a >= new Date().getFullYear() - 1)) return false;
  return true;
}

async function crawlDepartement(cible, { maxPages, maxDepth, maxAgeMs, pause }) {
  const racine = `https://www.${cible.domaine}.gouv.fr`;
  const host = new URL(racine).host;
  const seeds = (cible.seeds || ['/Actualites']).map((s) => new URL(s, racine).href);

  const vues = new Set();
  const file = seeds.map((u) => ({ url: u, depth: 0 }));
  const trouvailles = [];
  const erreurs = [];
  let pages = 0;

  while (file.length && pages < maxPages) {
    const { url, depth } = file.shift();
    if (vues.has(url)) continue;
    vues.add(url);

    let html;
    try {
      html = await getText(url, { maxAgeMs });
      pages++;
    } catch (e) {
      erreurs.push({ url, erreur: e.message });
      // Disjoncteur ouvert : on abandonne ce département proprement plutôt que
      // d'empiler 20 échecs identiques et d'aggraver le bannissement.
      if (e.disjoncteur) { erreurs.push({ url: racine, erreur: 'ABANDON — ' + e.message }); break; }
      continue;
    }
    await sleep(pause);

    for (const lien of extraireLiens(html, url)) {
      const cible_txt = `${lien.texte} ${decodeURIComponent(lien.url)}`;
      const pertinent = PERTINENT.test(cible_txt) && (MESURE.test(cible_txt) || lien.pdf);

      if (pertinent && lien.texte.length > 8) {
        trouvailles.push({
          departement: cible.code,
          titre: lien.texte.slice(0, 200),
          url: lien.url,
          type: lien.pdf ? 'pdf' : 'page',
          trouve_sur: url,
        });
      }
      if (depth < maxDepth && aSuivre(lien, host)) file.push({ url: lien.url, depth: depth + 1 });
    }
  }

  // Dédoublonnage par URL, PDF prioritaire sur page.
  const parUrl = new Map();
  for (const t of trouvailles) if (!parUrl.has(t.url)) parUrl.set(t.url, t);

  return { pages, trouvailles: [...parUrl.values()], erreurs };
}

async function main() {
  const fresh = process.argv.includes('--fresh');
  const seulDep = arg('dep', null);
  // Défauts timides — cf. le bannissement du 26/07/2026 documenté en tête de fichier.
  const maxPages = Number(arg('pages', 8));
  const maxDepth = Number(arg('depth', 2));
  const pause = Number(arg('pause', 3000));
  const pauseDep = Number(arg('pause-dep', 20000)); // respiration entre deux départements
  const maxAgeMs = fresh ? 0 : 2 * 3600 * 1000;

  const cibles = CIBLES.departements.filter((d) => d.actif !== false && (!seulDep || d.code === seulDep));
  if (!cibles.length) throw new Error(`aucune cible (dep=${seulDep})`);

  const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { vues: {} };
  const rapport = [];
  let totalNeuf = 0;

  let premier = true;
  for (const cible of cibles) {
    if (!premier) await sleep(pauseDep);
    premier = false;
    process.stdout.write(`   ${cible.code} ${cible.nom.padEnd(22)} `);
    const r = await crawlDepartement(cible, { maxPages, maxDepth, maxAgeMs, pause });

    const neuf = r.trouvailles.filter((t) => !state.vues[t.url]);
    for (const t of r.trouvailles) state.vues[t.url] = state.vues[t.url] || new Date().toISOString();
    totalNeuf += neuf.length;

    rapport.push({ ...cible, pages_visitees: r.pages, trouvailles: r.trouvailles, nouvelles: neuf, erreurs: r.erreurs });
    console.log(`${String(r.pages).padStart(3)} pages · ${String(r.trouvailles.length).padStart(2)} trouvaille(s)` +
      (neuf.length ? ` · 🆕 ${neuf.length} NOUVELLE(S)` : '') +
      (r.erreurs.length ? ` · ⚠️ ${r.erreurs.length} erreur(s)` : ''));
  }

  writeJSON(STATE, state);
  writeJSON(OUT, {
    methode:
      "Crawl borné de la branche Actualités/Publications des sites préfectoraux (aucun RSS, " +
      "sitemap ou API n'existe sur ces sites — vérifié le 26/07/2026). Filtre par mots-clés " +
      'forêt/massif/incendie + mesure (arrêté, interdiction, restriction).',
    avertissement:
      "Détection heuristique, non exhaustive et non officielle. Un arrêté peut être manqué. " +
      "Seul l'arrêté préfectoral publié fait foi.",
    collecte: new Date().toISOString(),
    parametres: { maxPages, maxDepth, pause_ms: pause, pause_entre_departements_ms: pauseDep },
    stats: {
      departements: rapport.length,
      trouvailles: rapport.reduce((n, r) => n + r.trouvailles.length, 0),
      nouvelles: totalNeuf,
    },
    departements: rapport,
  });

  console.log(`\n${totalNeuf ? '🆕' : '✅'} ${totalNeuf} nouveauté(s) depuis le dernier passage → ${OUT}`);
  if (totalNeuf) {
    for (const r of rapport) for (const n of r.nouvelles) console.log(`   [${r.code}] ${n.titre.slice(0, 90)}\n        ${n.url}`);
  }
}

if (require.main === module) main().catch((e) => { console.error('❌', e.message); process.exit(1); });
module.exports = { extraireLiens, aSuivre, PERTINENT, MESURE };
