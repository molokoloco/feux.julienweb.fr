#!/usr/bin/env node
/**
 * build-texture.js — produit app/foret-france.png, le masque des massifs
 * forestiers drapé sous la carte 2.5D.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CE SCRIPT TOURNE SUR LE POSTE DE JULIEN, JAMAIS SUR LE SERVEUR.           │
 * │ Il produit un ARTEFACT DE BUILD, commité au dépôt : la page n'interroge   │
 * │ jamais l'IGN à l'exécution. Un clone frais a l'image ; un visiteur ne     │
 * │ déclenche aucune requête tierce.                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Source : BD Forêt V2 (IGN) via le WMS Géoplateforme, demandé DIRECTEMENT en
 * EPSG:2154 — l'IGN reprojette côté serveur. Pas de GDAL, pas de tuiles, pas de
 * reprojection à écrire ici. Licence Ouverte 2.0 (cf LICENSE-DONNEES.md).
 *
 * Pourquoi un MASQUE et pas une texture couleur : la teinte des faces porte
 * déjà le niveau de danger de la Météo des forêts. Une texture colorée se
 * battrait avec cette échelle et abîmerait la seule couche indicative de la
 * page. On ne garde donc QUE le canal alpha — « y a-t-il de la forêt ici » —
 * et le front le remplit d'un vert unique de la charte, à l'opacité qu'il veut.
 *
 * Pourquoi c'est FLOU, exprès : à 1 143 m par pixel SVG, BD Forêt est du bruit —
 * des milliers de taches de quelques pixels. Illisible comme motif, et coûteux :
 * 1,4 Mo en PNG, 536 Ko en WebP. Ce qu'on veut n'est pas la limite parcellaire
 * d'un bois de 3 ha, c'est une DENSITÉ forestière. Le lissage la fait apparaître
 * et divise le poids par huit. La couche opposable, elle, reste vectorielle et
 * nette — c'est celle-là qui doit être exacte, pas le fond.
 *
 * Traitement des pixels en Node pur (zlib seul). Seul l'encodage WebP final
 * emprunte le sharp de l'app img-optim, déjà installée sur le poste : c'est un
 * outil de build, la page livrée n'a toujours aucune dépendance. Sans sharp, le
 * script écrit le PNG et le dit.
 *
 *   node ops/build-texture.js [--largeur 1400] [--flou 2] [--garder-source]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const RACINE = path.resolve(__dirname, '..');
const SORTIE_WEBP = path.join(RACINE, 'app', 'foret-france.webp');
const SORTIE_PNG = path.join(RACINE, 'app', 'foret-france.png');

// sharp n'est pas une dépendance de ce dépôt : on emprunte celui de l'app
// img-optim, sur ce poste. Absent → repli PNG, jamais d'échec.
const SHARP = 'D:/Google Drive/_Claude/Apps/img-optim/node_modules/sharp';

const WMS = 'https://data.geopf.fr/wms-r/wms';
const COUCHE = 'LANDCOVER.FORESTINVENTORY.V2';
const UA = 'feux-foret-fr/0.4 (+https://feux.julienweb.fr/ ; contact@julienweb.fr)';

// Marge d'ajustement tolérée entre feux-geo.js et le GeoJSON reprojeté.
// Au-delà, on refuse de produire : voir l'encadré dans calibrer().
const ECART_MAX_PX = 3;

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
const LARGEUR = Math.max(500, Math.min(4000, parseInt(opt('largeur', '1400'), 10)));
const FLOU = Math.max(0, Math.min(8, parseFloat(opt('flou', '2'))));
// On demande TOUJOURS 2000 px à l'IGN : le sous-échantillonnage par moyenne se
// fait ici, et c'est lui qui transforme le moucheté en densité. Demander
// directement 1400 px laisserait l'aliasing du serveur décider à notre place.
const LARGEUR_WMS = 2000;
const GARDER_SOURCE = args.includes('--garder-source');

// ───────────────────────────────────────────────────── projection EPSG:2154

/**
 * Lambert-93 exact : conique conforme sécante sur GRS80.
 * lat0 46.5 · lon0 3 · parallèles 44 et 49 · faux est 700000 · faux nord 6600000
 */
const RAD = Math.PI / 180;
const A = 6378137;
const E = Math.sqrt(2 / 298.257222101 - (1 / 298.257222101) ** 2);
const m = (p) => Math.cos(p) / Math.sqrt(1 - E * E * Math.sin(p) ** 2);
const t = (p) => Math.tan(Math.PI / 4 - p / 2) / ((1 - E * Math.sin(p)) / (1 + E * Math.sin(p))) ** (E / 2);
const P1 = 44 * RAD, P2 = 49 * RAD, P0 = 46.5 * RAD, L0 = 3 * RAD;
const N = Math.log(m(P1) / m(P2)) / Math.log(t(P1) / t(P2));
const F = m(P1) / (N * t(P1) ** N);
const R0 = A * F * t(P0) ** N;

function versL93(lon, lat) {
  const r = A * F * t(lat * RAD) ** N;
  const th = N * (lon * RAD - L0);
  return [700000 + r * Math.sin(th), 6600000 + R0 - r * Math.cos(th)];
}

// ──────────────────────────────────────────────────────────── calibration

/**
 * Retrouve la transformation affine qui mène des mètres Lambert-93 aux
 * coordonnées de la viewBox de feux-geo.js.
 *
 * ⚠️ Ce n'est PAS une constante recopiée : elle est REMESURÉE à chaque passage,
 * en réajustant les départements de feux-geo.js sur app/departements.geojson
 * reprojeté. Motif : feux-geo.js est produit par Claude Design, hors de ce
 * dépôt. Le jour où il revient dans une autre projection — ou simplement
 * recadré — une constante en dur produirait une texture décalée EN SILENCE,
 * sur une carte où l'alignement dit quel massif est fermé. Ici, l'écart
 * d'ajustement explose et le script refuse de produire.
 */
function calibrer() {
  const geo = JSON.parse(fs.readFileSync(path.join(RACINE, 'app', 'departements.geojson'), 'utf8'));
  const src = fs.readFileSync(path.join(RACINE, 'app', 'feux-geo.js'), 'utf8');
  const G = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));

  const parCode = {};
  for (const f of geo.features) parCode[f.properties.code] = f;

  const sommetsSvg = (d) => {
    const out = []; const re = /([ML])\s*(-?[\d.]+)[ ,](-?[\d.]+)/g; let x;
    while ((x = re.exec(d))) out.push([+x[2], +x[3]]);
    return out;
  };
  const sommetsGeo = (f) => {
    const out = []; const w = (c) => { if (typeof c[0] === 'number') out.push(c); else c.forEach(w); };
    w(f.geometry.coordinates); return out;
  };
  const mediane = (a) => { const s = [...a].sort((u, v) => u - v); return s[s.length >> 1]; };

  const paires = [];
  for (const dep of G.deps) {
    const f = parCode[dep.c]; if (!f) continue;
    const sv = sommetsSvg(dep.d); if (sv.length < 20) continue;
    const px = sommetsGeo(f).map((c) => versL93(c[0], c[1]));
    const bb = (a, i) => [Math.min(...a.map((p) => p[i])), Math.max(...a.map((p) => p[i]))];
    const [gx0, gx1] = bb(px, 0), [gy0, gy1] = bb(px, 1);
    const [sx0, sx1] = bb(sv, 0), [sy0, sy1] = bb(sv, 1);
    paires.push({
      code: dep.c, nom: dep.n,
      kx: (sx1 - sx0) / (gx1 - gx0), ky: (sy1 - sy0) / (gy1 - gy0),
      gcx: (gx0 + gx1) / 2, gcy: (gy0 + gy1) / 2,
      scx: (sx0 + sx1) / 2, scy: (sy0 + sy1) / 2,
    });
  }
  if (paires.length < 80) throw new Error(`calibration impossible : ${paires.length} département(s) appariés`);

  // Échelle : médiane sur les deux axes réunis. Une conique conforme est
  // isotrope — si kx et ky divergeaient, la projection ne serait pas celle-ci.
  const k = mediane(paires.flatMap((p) => [p.kx, p.ky]));
  const anisotropie = Math.abs(mediane(paires.map((p) => p.kx)) / mediane(paires.map((p) => p.ky)) - 1);
  const ox = mediane(paires.map((p) => p.scx - k * p.gcx));
  const oy = mediane(paires.map((p) => p.scy + k * p.gcy));

  let pire = 0, pireNom = '';
  for (const p of paires) {
    const d = Math.hypot(p.scx - (k * p.gcx + ox), p.scy - (oy - k * p.gcy));
    if (d > pire) { pire = d; pireNom = `${p.code} ${p.nom}`; }
  }

  return { k, ox, oy, w: G.w, h: G.h, n: paires.length, pire, pireNom, anisotropie };
}

// ────────────────────────────────────────────────────────────── PNG (zlib)

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return (buf) => { let c = -1; for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ -1) >>> 0; };
})();

/** Décodeur PNG minimal : 8 bits, non entrelacé, couleur RGB ou RGBA. */
function decoderPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504E47) throw new Error('signature PNG absente');
  let o = 8, ihdr = null; const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), typ = buf.toString('latin1', o + 4, o + 8);
    if (typ === 'IHDR') {
      ihdr = { w: buf.readUInt32BE(o + 8), h: buf.readUInt32BE(o + 12), depth: buf[o + 16], type: buf[o + 17], entrelace: buf[o + 20] };
    } else if (typ === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len));
    else if (typ === 'IEND') break;
    o += 12 + len;
  }
  if (!ihdr) throw new Error('IHDR absent');
  if (ihdr.depth !== 8 || ihdr.entrelace !== 0 || (ihdr.type !== 6 && ihdr.type !== 2)) {
    throw new Error(`PNG non géré : depth=${ihdr.depth} type=${ihdr.type} entrelace=${ihdr.entrelace}`);
  }
  const canaux = ihdr.type === 6 ? 4 : 3;
  const brut = zlib.inflateSync(Buffer.concat(idat));
  const ligne = ihdr.w * canaux;
  const px = Buffer.alloc(ihdr.h * ligne);

  // Défiltrage PNG (RFC 2083 § 6) : chaque scanline porte son filtre en tête.
  for (let y = 0; y < ihdr.h; y++) {
    const f = brut[y * (ligne + 1)];
    const src = brut.subarray(y * (ligne + 1) + 1, y * (ligne + 1) + 1 + ligne);
    const dst = px.subarray(y * ligne, (y + 1) * ligne);
    const haut = y > 0 ? px.subarray((y - 1) * ligne, y * ligne) : null;
    for (let i = 0; i < ligne; i++) {
      const a = i >= canaux ? dst[i - canaux] : 0;
      const b = haut ? haut[i] : 0;
      const c = haut && i >= canaux ? haut[i - canaux] : 0;
      let v = src[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      } else if (f !== 0) throw new Error(`filtre PNG inconnu : ${f}`);
      dst[i] = v & 0xFF;
    }
  }
  return { ...ihdr, canaux, px };
}

/** Encodeur PNG 8 bits niveaux de gris (color type 0), filtrage adaptatif. */
function encoderGris(gris, w, h) {
  const brut = Buffer.alloc(h * (w + 1));
  for (let y = 0; y < h; y++) {
    const src = gris.subarray(y * w, (y + 1) * w);
    const haut = y > 0 ? gris.subarray((y - 1) * w, y * w) : null;
    // Choix du filtre par somme des valeurs absolues (heuristique de la spec).
    const cands = [
      { f: 0, d: Buffer.from(src) },
      { f: 1, d: Buffer.from(src.map((v, i) => (v - (i ? src[i - 1] : 0)) & 0xFF)) },
      { f: 2, d: Buffer.from(src.map((v, i) => (v - (haut ? haut[i] : 0)) & 0xFF)) },
    ];
    let best = cands[0], bestScore = Infinity;
    for (const c of cands) {
      let s = 0; for (let i = 0; i < w; i++) s += c.d[i] < 128 ? c.d[i] : 256 - c.d[i];
      if (s < bestScore) { bestScore = s; best = c; }
    }
    brut[y * (w + 1)] = best.f;
    best.d.copy(brut, y * (w + 1) + 1);
  }
  const chunk = (typ, data) => {
    const b = Buffer.alloc(8 + data.length + 4);
    b.writeUInt32BE(data.length, 0);
    b.write(typ, 4, 'latin1');
    data.copy(b, 8);
    b.writeUInt32BE(CRC(b.subarray(4, 8 + data.length)), 8 + data.length);
    return b;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 0; // 8 bits, niveaux de gris
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(brut, { level: 9, memLevel: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ───────────────────────────────────────────────────────── densité forestière

/** Sous-échantillonnage par moyenne de boîte : c'est l'étape « densité ». */
function reduire(src, w, h, wc) {
  const hc = Math.round(h * wc / w);
  const out = Buffer.alloc(wc * hc);
  const sx = w / wc, sy = h / hc;
  for (let y = 0; y < hc; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < wc; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let s = 0, n = 0;
      for (let j = y0; j < y1 && j < h; j++) for (let i = x0; i < x1 && i < w; i++) { s += src[j * w + i]; n++; }
      out[y * wc + x] = n ? Math.round(s / n) : 0;
    }
  }
  return { px: out, w: wc, h: hc };
}

/** Trois passes de boîte séparable ≈ gaussienne (σ ≈ r·√2). Bords répliqués. */
function flouter(src, w, h, sigma) {
  if (sigma <= 0) return src;
  const r = Math.max(1, Math.round(sigma / Math.SQRT2));
  let buf = Buffer.from(src);
  const passe = (inp, W, H, horizontal) => {
    const out = Buffer.alloc(W * H);
    for (let a = 0; a < (horizontal ? H : W); a++) {
      const lim = horizontal ? W : H;
      const get = (b) => inp[horizontal ? a * W + b : b * W + a];
      let somme = 0;
      for (let b = -r; b <= r; b++) somme += get(Math.min(lim - 1, Math.max(0, b)));
      for (let b = 0; b < lim; b++) {
        const v = Math.round(somme / (2 * r + 1));
        if (horizontal) out[a * W + b] = v; else out[b * W + a] = v;
        somme += get(Math.min(lim - 1, b + r + 1)) - get(Math.max(0, b - r));
      }
    }
    return out;
  };
  for (let p = 0; p < 3; p++) { buf = passe(buf, w, h, true); buf = passe(buf, w, h, false); }
  return buf;
}

// ──────────────────────────────────────────────────────────────── principal

(async () => {
  const cal = calibrer();
  const mParPx = 1 / cal.k;

  console.log('calibration remesurée sur %d départements', cal.n);
  console.log('  échelle    %s px/m  (%s m par pixel SVG)', cal.k.toExponential(6), mParPx.toFixed(2));
  console.log('  anisotropie %s %%  (une conique conforme est isotrope)', (cal.anisotropie * 100).toFixed(3));
  console.log('  pire écart %s px SVG  (%s)', cal.pire.toFixed(2), cal.pireNom);

  if (cal.pire > ECART_MAX_PX) {
    console.error(`\nREFUS : écart d'ajustement de ${cal.pire.toFixed(2)} px > ${ECART_MAX_PX} px.`);
    console.error("app/feux-geo.js n'est plus dans la projection attendue (EPSG:2154), ou a été");
    console.error('recadré. Produire la texture maintenant la poserait de travers sur la carte.');
    console.error('→ recalibrer AVANT de régénérer. Ne pas relever ECART_MAX_PX pour passer outre.');
    process.exit(1);
  }

  // Emprise de la viewBox en mètres Lambert-93.
  const xmin = (0 - cal.ox) / cal.k;
  const xmax = (cal.w - cal.ox) / cal.k;
  const ymin = (cal.oy - cal.h) / cal.k;
  const ymax = (cal.oy - 0) / cal.k;

  // La hauteur suit le rapport de l'emprise, pas celui de la viewBox : c'est le
  // WMS qui décide du cadrage, on ne lui impose pas un pixel non carré.
  const larg = LARGEUR_WMS;
  const haut = Math.round(larg * (ymax - ymin) / (xmax - xmin));

  console.log('\nemprise viewBox 0 0 %s %s → EPSG:2154', cal.w, cal.h);
  console.log('  X %s → %s   Y %s → %s', xmin.toFixed(1), xmax.toFixed(1), ymin.toFixed(1), ymax.toFixed(1));
  console.log('  %s × %s km · demande WMS %d × %d px', ((xmax - xmin) / 1000).toFixed(1), ((ymax - ymin) / 1000).toFixed(1), larg, haut);

  const url = `${WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${COUCHE}`
    + `&STYLES=&CRS=EPSG:2154&BBOX=${xmin.toFixed(1)},${ymin.toFixed(1)},${xmax.toFixed(1)},${ymax.toFixed(1)}`
    + `&WIDTH=${larg}&HEIGHT=${haut}&FORMAT=image/png&TRANSPARENT=TRUE`;

  console.log('\nrequête IGN…');
  const rep = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/png' } });
  const ct = rep.headers.get('content-type') || '';
  const corps = Buffer.from(await rep.arrayBuffer());
  if (!rep.ok || !ct.startsWith('image/')) {
    throw new Error(`WMS : HTTP ${rep.status} ${ct}\n${corps.toString('utf8').slice(0, 400)}`);
  }
  console.log('  reçu %s Ko (%s)', (corps.length / 1024).toFixed(0), ct);

  if (GARDER_SOURCE) {
    const brut = path.join(RACINE, 'app', 'foret-france.source.png');
    fs.writeFileSync(brut, corps);
    console.log('  source conservée : %s', brut);
  }

  const img = decoderPng(corps);
  if (img.w !== larg || img.h !== haut) console.log('  ⚠ le WMS a rendu %d × %d', img.w, img.h);

  // Seul le canal alpha nous intéresse : BD Forêt dessine les massifs et laisse
  // le reste transparent. Les couleurs d'essences sont jetées ici, exprès.
  const gris = Buffer.alloc(img.w * img.h);
  let couverts = 0;
  if (img.canaux === 4) {
    for (let i = 0, j = 3; i < gris.length; i++, j += 4) { gris[i] = img.px[j]; if (img.px[j] > 8) couverts++; }
  } else {
    // Pas d'alpha : on retombe sur « ce qui n'est pas blanc est forêt ».
    for (let i = 0, j = 0; i < gris.length; i++, j += 3) {
      const v = 255 - Math.min(img.px[j], img.px[j + 1], img.px[j + 2]);
      gris[i] = v; if (v > 8) couverts++;
    }
  }
  // Moucheté → densité : moyenne de boîte, puis lissage.
  const red = reduire(gris, img.w, img.h, LARGEUR);
  const dens = flouter(red.px, red.w, red.h, FLOU);
  console.log('  densité : %d × %d px, lissage σ≈%s · %s %% de couverture forestière',
    red.w, red.h, FLOU, (100 * couverts / gris.length).toFixed(1));

  const png = encoderGris(dens, red.w, red.h);

  // Encodage final. WebP si sharp est joignable, PNG sinon — jamais d'échec.
  let ecrit = SORTIE_PNG, taille = png.length, format = 'PNG niveaux de gris';
  try {
    const sharp = require(SHARP);
    const webp = await sharp(png).webp({ quality: 70, effort: 6 }).toBuffer();
    fs.writeFileSync(SORTIE_WEBP, webp);
    if (fs.existsSync(SORTIE_PNG)) fs.unlinkSync(SORTIE_PNG); // pas deux artefacts du même fait
    ecrit = SORTIE_WEBP; taille = webp.length; format = 'WebP q70';
  } catch (e) {
    fs.writeFileSync(SORTIE_PNG, png);
    console.log('\n  ⚠ sharp injoignable (%s) — repli PNG, plus lourd.', e.code || e.message);
    console.log('    sharp attendu ici : %s', SHARP);
  }

  console.log('\nécrit  %s', ecrit);
  console.log('  %d × %d px · %s · %s Ko', red.w, red.h, format, (taille / 1024).toFixed(1));

  const nom = path.basename(ecrit);
  console.log('\nà transmettre au design — l\'image se pose SANS calcul de coins :');
  console.log('  <image href="%s" x="0" y="0" width="%s" height="%s"', nom, cal.w, cal.h);
  console.log('         preserveAspectRatio="none" />   dans le groupe couche-relief');
  console.log('  masque de luminance : blanc = forêt, noir = pas de forêt.');
})().catch((e) => { console.error('\néchec :', e.message); process.exit(1); });
