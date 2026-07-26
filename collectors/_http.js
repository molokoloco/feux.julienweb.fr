/**
 * _http.js — LIB PARTAGÉE : fetch poli + cache disque pour les collecteurs.
 *
 * Règles de politesse appliquées (on tape sur des serveurs de l'État) :
 *  - User-Agent descriptif et joignable (Overpass renvoie 406 sur un UA générique,
 *    leçon apprise sur feux-foret-carte)
 *  - un seul appel à la fois, avec pause entre deux hôtes
 *  - cache disque : re-run à volonté sans re-taper la source
 *  - retry borné, jamais de boucle infinie
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UA = 'feux-foret-fr/0.1 (+https://julienweb.fr/labs/feux-foret/ ; contact@julienweb.fr)';
const CACHE_DIR = path.join(__dirname, '..', '.cache');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * DISJONCTEUR — appris à nos dépens le 26/07/2026.
 * Un crawl à 400 ms de pause sur 10 sites préfectoraux a fait bannir l'IP en ~2 minutes :
 * la plateforme *.gouv.fr accepte alors la connexion et la ferme immédiatement
 * (curl → code 000 en 0,1 s ; Node → "fetch failed" / UND_ERR_SOCKET).
 * naviforest.ign.fr, lui, continuait de répondre → c'est bien un blocage côté plateforme
 * préfectorale, pas une panne réseau locale.
 *
 * Conséquence : à la 3e fermeture sèche sur un même hôte, on arrête TOUT pour cet hôte.
 * Insister ne fait qu'allonger le bannissement.
 */
const SEUIL_DISJONCTEUR = 3;
const disjoncteur = new Map(); // host → nb de fermetures sèches

const estFermetureSeche = (e) => {
  const s = `${e && e.message} ${e && e.cause && e.cause.message} ${e && e.cause && e.cause.code}`;
  return /UND_ERR_SOCKET|ECONNRESET|other side closed|socket hang up|fetch failed/i.test(s);
};

class HoteBloque extends Error {
  constructor(host) {
    super(
      `Hôte ${host} : ${SEUIL_DISJONCTEUR} fermetures sèches d'affilée → disjoncteur ouvert. ` +
        `Très probablement un blocage anti-crawl. Attendre (dizaines de minutes), ralentir, réduire le nombre de pages.`
    );
    this.host = host;
    this.disjoncteur = true;
  }
}

function cachePath(url, ext = '.bin') {
  const key = crypto.createHash('sha1').update(url).digest('hex').slice(0, 16);
  return path.join(CACHE_DIR, key + ext);
}

/**
 * Récupère une URL en buffer. `maxAgeMs` = 0 pour forcer le réseau.
 * Retourne { buf, fromCache, status }.
 */
async function get(url, { maxAgeMs = 6 * 3600 * 1000, retries = 2, ext = '.bin' } = {}) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cp = cachePath(url, ext);

  if (maxAgeMs > 0 && fs.existsSync(cp)) {
    const age = Date.now() - fs.statSync(cp).mtimeMs;
    if (age < maxAgeMs) return { buf: fs.readFileSync(cp), fromCache: true, status: 200 };
  }

  const host = new URL(url).host;
  if ((disjoncteur.get(host) || 0) >= SEUIL_DISJONCTEUR) throw new HoteBloque(host);

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    // Backoff exponentiel, pas linéaire : 3 s, 9 s, 27 s.
    if (attempt) await sleep(3000 * Math.pow(3, attempt - 1));
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: '*/*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
        // 404/403 : inutile d'insister, la ressource n'est pas là
        if (res.status === 404 || res.status === 403) break;
        // 429/503 : on nous demande de ralentir, on obtempère et on ouvre le disjoncteur
        if (res.status === 429 || res.status === 503) {
          disjoncteur.set(host, (disjoncteur.get(host) || 0) + 1);
          if ((disjoncteur.get(host) || 0) >= SEUIL_DISJONCTEUR) throw new HoteBloque(host);
        }
        continue;
      }
      disjoncteur.set(host, 0); // succès → on referme le disjoncteur
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(cp, buf);
      return { buf, fromCache: false, status: res.status };
    } catch (e) {
      if (e.disjoncteur) throw e;
      lastErr = e;
      if (estFermetureSeche(e)) {
        const n = (disjoncteur.get(host) || 0) + 1;
        disjoncteur.set(host, n);
        if (n >= SEUIL_DISJONCTEUR) throw new HoteBloque(host);
      }
    }
  }
  throw lastErr || new Error(`échec inconnu — ${url}`);
}

const getText = async (url, opts) => (await get(url, { ext: '.html', ...opts })).buf.toString('utf8');
const getJSON = async (url, opts) => JSON.parse((await get(url, { ext: '.json', ...opts })).buf.toString('utf8'));

/** Décode les entités HTML les plus courantes + normalise les espaces. */
function decodeEntities(s) {
  if (!s) return '';
  return s
    .replace(/&(?:nbsp|#160);/g, ' ')
    .replace(/&(?:amp|#38);/g, '&')
    .replace(/&(?:lt|#60);/g, '<')
    .replace(/&(?:gt|#62);/g, '>')
    .replace(/&(?:quot|#34);/g, '"')
    .replace(/&(?:apos|#39|rsquo|#8217);/g, "'")
    .replace(/&(?:eacute|#233);/g, 'é')
    .replace(/&(?:egrave|#232);/g, 'è')
    .replace(/&(?:ecirc|#234);/g, 'ê')
    .replace(/&(?:agrave|#224);/g, 'à')
    .replace(/&(?:acirc|#226);/g, 'â')
    .replace(/&(?:ccedil|#231);/g, 'ç')
    .replace(/&(?:ocirc|#244);/g, 'ô')
    .replace(/&(?:ugrave|#249);/g, 'ù')
    .replace(/&(?:icirc|#238);/g, 'î')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Écrit un JSON indenté, en créant l'arborescence si besoin. */
function writeJSON(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  return file;
}

module.exports = { UA, get, getText, getJSON, decodeEntities, writeJSON, sleep, HoteBloque, disjoncteur };
