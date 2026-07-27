/**
 * _sftp_op.js v2 — helper SFTP via WinSCP, script en %TEMP%, supprimé après.
 *
 * Usage :
 *   node _sftp_op.js [--target=<nom>] [--dry-run] <op> [args]
 *
 * Ops :
 *   ls <remote-rel>                  liste un dossier distant
 *   get <remote-rel> [<local>]       télécharge un fichier
 *   put <remote-rel> [<local>]       envoie un fichier
 *   rm <remote-rel>                  supprime (fichier ou dossier, récursif)
 *   mkdir <remote-rel>               crée un dossier distant
 *   preset <nom>                     envoie la liste de fichiers d'un preset
 *   sync <sous-dossier-local>        envoie récursivement un dossier local
 *   targets                          liste les cibles disponibles
 *
 * Config : `.deploy-ftp.json`, cherché dans l'ordre —
 *   1. --config=<chemin>
 *   2. $DEPLOY_FTP_CONFIG
 *   3. ./.deploy-ftp.json (cwd)
 *   4. ../Julienweb.fr-public/.deploy-ftp.json
 *   5. ../../Julienweb.fr-public/.deploy-ftp.json
 * Les chemins `local_base` sont résolus RELATIVEMENT AU DOSSIER DE LA CONFIG.
 *
 * Schéma v2 : connexion à la racine, cibles dans `targets`. Le schéma v1
 * (remote_base/local_base/presets à la racine) reste accepté → cible « www ».
 *
 * ⚠️ WinSCP parse mal les espaces dans les chemins absolus, même entre quotes.
 *    TOUJOURS `lcd "<dossier>"` puis `put "<basename>" "<remote/rel>"`.
 *    Le masque local ne peut pas contenir de sous-chemin → un `lcd` par dossier.
 * ⚠️ Git Bash : préfixer `MSYS_NO_PATHCONV=1` sinon `/home/UTILISATEUR-FTP/...` est
 *    réécrit en `C:/Program Files/Git/home/UTILISATEUR-FTP/...` avant d'atteindre Node.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const WINSCP = 'C:\\Program Files (x86)\\WinSCP\\WinSCP.com';
const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.svgz',
  '.zip', '.gz', '.tgz', '.pdf', '.woff', '.woff2', '.ttf', '.eot',
  '.mp3', '.mp4', '.webm', '.glb', '.wpress',
]);

// ---------------------------------------------------------------- args

const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (const a of argv) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
  else positional.push(a);
}
const op = positional[0];

const USAGE = `Usage: node _sftp_op.js [--target=<nom>] [--dry-run] <ls|get|put|rm|mkdir|preset|sync|targets> [args]`;

// ---------------------------------------------------------------- config

function findConfig() {
  const candidates = [];
  if (flags.config) candidates.push(path.resolve(String(flags.config)));
  if (process.env.DEPLOY_FTP_CONFIG) candidates.push(path.resolve(process.env.DEPLOY_FTP_CONFIG));
  candidates.push(path.resolve('.deploy-ftp.json'));
  candidates.push(path.resolve('..', 'Julienweb.fr-public', '.deploy-ftp.json'));
  candidates.push(path.resolve('..', '..', 'Julienweb.fr-public', '.deploy-ftp.json'));
  for (const c of candidates) if (fs.existsSync(c)) return c;
  console.error('Config .deploy-ftp.json introuvable. Cherché :\n  ' + candidates.join('\n  '));
  process.exit(2);
}

const configPath = findConfig();
const configDir = path.dirname(configPath);
const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// v1 (plat) → v2 (targets)
const targets = raw.targets || { www: raw };
const targetName = String(flags.target || raw.default_target || Object.keys(targets)[0]);

if (op === 'targets') {
  console.log(`Config : ${configPath}`);
  for (const [name, t] of Object.entries(targets)) {
    const star = name === targetName ? '*' : ' ';
    console.log(`${star} ${name.padEnd(10)} ${t.remote_base}  ←  ${t.local_base}`);
    for (const p of Object.keys(t.presets || {})) {
      console.log(`      preset ${p} : ${t.presets[p].join(', ')}`);
    }
  }
  process.exit(0);
}

if (!op) { console.error(USAGE); process.exit(2); }

const target = targets[targetName];
if (!target) {
  console.error(`Cible « ${targetName} » inconnue. Disponibles : ${Object.keys(targets).join(', ')}`);
  process.exit(2);
}

// connexion : racine de la config, surchargeable par cible
const conn = {
  host: target.host || raw.host,
  port: target.port || raw.port || 22,
  user: target.user || raw.user,
  password: target.password || raw.password,
  hostkey: target.hostkey || raw.hostkey || '*',
};
for (const k of ['host', 'user', 'password']) {
  if (!conn[k]) { console.error(`Config incomplète : ${k} manquant`); process.exit(2); }
}

const remoteBase = target.remote_base;
const localBase = path.resolve(configDir, target.local_base || '.');

// ---------------------------------------------------------------- helpers

const mask = (s) => String(s == null ? '' : s).split(conn.password).join('***');
const mode = (p) => (BINARY_EXT.has(path.extname(p).toLowerCase()) ? 'binary' : 'ascii');
const toRemote = (p) => p.split(path.sep).join('/').replace(/^\.\//, '');

/** Regroupe des chemins relatifs par dossier local → [{ dir, files:[{base, remote}] }] */
function groupByDir(relPaths) {
  const groups = new Map();
  for (const rel of relPaths) {
    const abs = path.resolve(localBase, rel);
    const dir = path.dirname(abs).replace(/\\/g, '/');
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push({ base: path.basename(abs), remote: toRemote(rel), abs });
  }
  return [...groups.entries()].map(([dir, files]) => ({ dir, files }));
}

/** Exécute un script WinSCP. `batch` : 'on' (abort au 1er échec) ou 'continue'. */
function runScript(bodyLines, { batch = 'on', label = '' } = {}) {
  const ts = Date.now();
  const scriptPath = path.join(os.tmpdir(), `sftp-${ts}.txt`);
  const logPath = path.join(os.tmpdir(), `sftp-${ts}.log`);
  const lines = [
    `option batch ${batch}`,
    'option confirm off',
    `open sftp://${conn.host}:${conn.port}/ -username="${conn.user}" -password="${conn.password}" -hostkey="${conn.hostkey}" -timeout=25`,
    `cd ${remoteBase}`,
    ...bodyLines,
    'close',
    'exit',
  ];

  if (flags['dry-run']) {
    console.log(`--- DRY RUN${label ? ' [' + label + ']' : ''} ---`);
    console.log(mask(lines.join('\n')));
    return 0;
  }

  fs.writeFileSync(scriptPath, lines.join('\r\n'), 'ascii');
  let exit = 0;
  try {
    const out = execFileSync(WINSCP, [`/script=${scriptPath}`, `/log=${logPath}`], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    console.log(mask(out));
  } catch (e) {
    exit = e.status || 1;
    console.error('SFTP error:');
    console.error(mask((e.stdout || '') + (e.stderr || '')));
    if (fs.existsSync(logPath)) {
      console.log('\n--- LOG TAIL ---');
      console.log(mask(fs.readFileSync(logPath, 'utf-8').slice(-2000)));
    }
  } finally {
    // TOUJOURS supprimer le script tmp : il contient le mot de passe
    try { fs.unlinkSync(scriptPath); } catch (_) {}
    try { fs.unlinkSync(logPath); } catch (_) {}
  }
  return exit;
}

/** Envoie une liste de chemins relatifs à local_base. */
function putMany(relPaths, remoteDirsToCreate = []) {
  const missing = relPaths.filter((r) => !fs.existsSync(path.resolve(localBase, r)));
  if (missing.length) {
    console.error(`Fichiers locaux absents (local_base=${localBase}) :\n  ` + missing.join('\n  '));
    return 1;
  }

  // Les dossiers distants doivent exister avant le put : passe séparée,
  // en batch continue (un « déjà existant » ne doit pas tuer le script).
  const dirs = [...new Set(remoteDirsToCreate)].filter((d) => d && d !== '.' && d !== '/');
  if (dirs.length) {
    dirs.sort((a, b) => a.split('/').length - b.split('/').length);
    runScript(dirs.map((d) => `mkdir "${d}"`), { batch: 'continue', label: 'mkdir' });
  }

  const body = [];
  for (const g of groupByDir(relPaths)) {
    body.push(`lcd "${g.dir}"`);
    for (const f of g.files) body.push(`put -transfer=${mode(f.base)} "${f.base}" "${f.remote}"`);
  }
  console.log(`→ ${relPaths.length} fichier(s) vers ${targetName} (${remoteBase})`);
  return runScript(body, { label: 'put' });
}

/** Liste récursivement les fichiers d'un dossier, en chemins relatifs à local_base. */
function walk(absDir) {
  const out = [];
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (entry.name === 'desktop.ini' || entry.name.startsWith('.tmp.drive')) continue;
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs));
    else out.push(path.relative(localBase, abs));
  }
  return out;
}

// ---------------------------------------------------------------- ops

let exitCode = 0;
const arg1 = positional[1];
const arg2 = positional[2];

switch (op) {
  case 'ls': {
    exitCode = runScript([`ls ${arg1 || '.'}`]);
    break;
  }

  case 'get': {
    if (!arg1) { console.error(USAGE); process.exit(2); }
    const dest = path.resolve(arg2 ? path.resolve(arg2) : path.join(localBase, arg1));
    const destDir = path.dirname(dest).replace(/\\/g, '/');
    if (!flags['dry-run']) fs.mkdirSync(destDir, { recursive: true });
    exitCode = runScript([`lcd "${destDir}"`, `get -transfer=${mode(arg1)} "${arg1}" "${path.basename(dest)}"`]);
    if (!exitCode && fs.existsSync(dest)) {
      console.log(`\n--- LOCAL : ${dest} (${fs.statSync(dest).size} octets) ---`);
    }
    break;
  }

  case 'put': {
    if (!arg1) { console.error(USAGE); process.exit(2); }
    if (arg2) {
      const abs = path.resolve(arg2);
      const dir = path.dirname(abs).replace(/\\/g, '/');
      exitCode = runScript([`lcd "${dir}"`, `put -transfer=${mode(abs)} "${path.basename(abs)}" "${toRemote(arg1)}"`]);
    } else {
      exitCode = putMany([arg1], [path.posix.dirname(toRemote(arg1))]);
    }
    break;
  }

  case 'rm': {
    if (!arg1) { console.error(USAGE); process.exit(2); }
    exitCode = runScript([`rm "${arg1}"`]);
    break;
  }

  case 'mkdir': {
    if (!arg1) { console.error(USAGE); process.exit(2); }
    exitCode = runScript([`mkdir "${arg1}"`], { batch: 'continue' });
    break;
  }

  case 'preset': {
    const list = (target.presets || {})[arg1];
    if (!list) {
      console.error(`Preset « ${arg1} » inconnu pour la cible ${targetName}. Disponibles : ${Object.keys(target.presets || {}).join(', ') || '(aucun)'}`);
      process.exit(2);
    }
    exitCode = putMany(list, list.map((r) => path.posix.dirname(toRemote(r))));
    break;
  }

  case 'sync': {
    const sub = arg1 || '.';
    const absDir = path.resolve(localBase, sub);
    if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
      console.error(`Dossier local introuvable : ${absDir}`);
      process.exit(2);
    }
    const rels = walk(absDir);
    if (!rels.length) { console.error(`Aucun fichier dans ${absDir}`); process.exit(2); }
    // sync n'efface JAMAIS côté distant — ajout/écrasement seulement.
    exitCode = putMany(rels, rels.map((r) => path.posix.dirname(toRemote(r))));
    break;
  }

  default:
    console.error(USAGE);
    process.exit(2);
}

process.exit(exitCode);
