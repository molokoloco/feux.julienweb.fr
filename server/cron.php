<?php
/**
 * cron.php — régénération de data/arretes.json.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ CE SCRIPT N'INTERROGE JAMAIS UN SITE PRÉFECTORAL. JAMAIS.                 │
 * │ L'IP sortante de l'hébergement mutualisé OVH est partagée avec            │
 * │ julienweb.fr, le site professionnel de Julien. Le crawl des *.gouv.fr a   │
 * │ déjà valu un bannissement en 2 minutes le 26/07/2026 depuis le poste      │
 * │ local. Le refaire depuis le serveur mettrait en jeu un actif              │
 * │ professionnel pour zéro gain : la qualification des arrêtés est de toute  │
 * │ façon humaine (doctrine n°2). Cf SPEC.md § « Analyse de risque ».         │
 * │ Sources autorisées ici : liste blanche Feux::UPSTREAM + Feux::HOSTS_OK.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Exécution — CLI UNIQUEMENT (cron OVH) :
 *       /usr/local/php8.3/bin/php <docroot>/cron.php
 *       /usr/local/php8.3/bin/php <docroot>/cron.php --force
 *
 * Il n'existe AUCUN déclencheur web. Voir l'encadré ci-dessous.
 *
 * Sortie : data/arretes.json, écrit atomiquement (temporaire + rename).
 * Journal : <dossier-prive>/feux.log (HORS docroot).
 */

declare(strict_types=1);

define('FEUX_BOOT', true);
require __DIR__ . '/lib/feux.php';

Feux::durcirRuntime();
Feux::ensureDirs();

const CRON_INTERVAL_MIN = 3600;   // 1 h : plancher entre deux frappes amont

$estCli = (PHP_SAPI === 'cli');
$t0 = microtime(true);

// ──────────────────────────────────────────────────────── CLI uniquement, point

/*
 * Arbitrage du 28/07/2026 : AUCUN déclencheur web, et aucun secret.
 *
 * Une version précédente acceptait `cron.php?k=<secret>` si un fichier
 * `cron.secret` (≥ 32 octets, hors docroot) avait été déposé à la main.
 * Supprimé : le cron OVH mutualisé sait exécuter un script en CLI, donc ce
 * mode web ne servait qu'en dépannage — pour le prix d'un secret partagé de
 * plus à créer, stocker, faire tourner et ne pas fuiter.
 *
 * Un secret qui n'existe pas ne fuit pas. Ce fichier n'a plus aucune surface
 * d'authentification, donc plus rien à contourner par le web.
 *
 * Défense en profondeur : Apache refuse déjà l'accès à cron.php
 * (cf app/.htaccess). Ce garde-fou-ci est le second, au cas où la
 * directive Apache serait perdue lors d'une fusion de .htaccess.
 * On répond 404 et non 403 : on ne confirme pas l'existence du fichier.
 */
if (!$estCli) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex, nofollow');
    echo "Not Found\n";
    exit;
}

$force = in_array('--force', $argv ?? [], true);

// ────────────────────────────────────────────────────── verrou anti-concurrence

if (!Feux::verrouiller('cron')) {
    Feux::log('INFO', 'execution deja en cours — abandon');
    echo "occupe\n";
    exit(0);
}

// ─────────────────────────────────────────── limitation de débit (garde-fou)

/**
 * Si on est rappelé trop tôt, on ne frappe PAS l'amont : on laisse en place le
 * arretes.json existant (qui est déjà servi statiquement par Apache) et on sort.
 * Vaut autant contre un cron mal réglé que contre un déclenchement web répété.
 */
$stamp = Feux::varDir() . '/derniere-frappe';
$dernier = is_file($stamp) ? (int) filemtime($stamp) : 0;
$ecoule = time() - $dernier;

if (!$force && $dernier > 0 && $ecoule < CRON_INTERVAL_MIN) {
    Feux::log('INFO', 'trop tot — cache conserve', ['ecoule_s' => $ecoule]);
    echo "cache (dernier passage il y a {$ecoule}s)\n";
    exit(0);
}

// ─────────────────────────────────────────────────────────── socle humain (SFTP)

/**
 * Le socle est produit sur le poste de Julien (ops/build-socle.js) et poussé par
 * SFTP. Il porte tout ce que le serveur n'a PAS le droit de produire :
 * zones-interdites qualifiées à la main, registre des massifs, veille
 * préfectorale, avertissements. PHP ne l'écrit jamais.
 */
if (!is_readable(Feux::SOCLE)) {
    Feux::log('ERROR', 'socle absent — publication refusee');
    sortie(1, "socle absent");
}
$socle = json_decode((string) file_get_contents(Feux::SOCLE), true);
if (!is_array($socle)) {
    Feux::log('ERROR', 'socle illisible — publication refusee');
    sortie(1, "socle illisible");
}
Feux::assertSocleValide($socle); // fail closed : voir lib/feux.php

// ───────────────────────────────────────────────────────── collecte amont

$degradations = [];

$mdf = etape('mdf', static function (): array {
    // 1. Résolution de l'URL du CSV via l'API data.gouv (pas d'URL en dur…)
    $annee = (int) date('Y');
    $csvUrl = null;
    $licence = null;
    $majDataset = null;
    try {
        $r = Feux::fetch(Feux::UPSTREAM['datagouv'], 'datagouv', 20);
        $ds = json_decode($r['corps'], true);
        if (is_array($ds) && isset($ds['resources']) && is_array($ds['resources'])) {
            $licence = $ds['license'] ?? null;
            $majDataset = $ds['last_update'] ?? null;
            foreach ($ds['resources'] as $res) {
                $t = (string) ($res['title'] ?? '');
                $u = (string) ($res['url'] ?? '');
                if ($t === "mdf.$annee" || str_contains($u, "mdf_{$annee}.csv.gz")) {
                    $csvUrl = $u;
                    break;
                }
            }
        }
    } catch (Throwable $e) {
        Feux::log('WARN', 'data.gouv indisponible, repli sur URL connue', ['msg' => $e->getMessage()]);
    }
    // 2. …mais repli sur l'URL S3 connue si data.gouv est muet.
    //    Dans les deux cas l'hôte est revérifié contre la liste blanche (anti-SSRF :
    //    l'URL vient d'une réponse distante, donc c'est de la donnée, pas de la config).
    if ($csvUrl === null) {
        $csvUrl = sprintf('https://meteofrance.s3.sbg.io.cloud.ovh.net/data/BULLETIN/MDF/mdf_%d.csv.gz', $annee);
    }
    Feux::assertHoteAutorise($csvUrl);

    $r = Feux::fetch($csvUrl, 'mdf-csv', 60, true);
    $out = Feux::parseMdf(Feux::gunzipBorne($r['corps']));
    $out['fichier_amont'] = $csvUrl;
    $out['licence'] = $licence;
    $out['maj_dataset'] = $majDataset;
    return $out;
}, $degradations);

$navi = etape('navi', static function (): array {
    $r = Feux::fetch(Feux::UPSTREAM['naviforest'], 'naviforest', 30);
    return Feux::parseNaviforest($r['corps']);
}, $degradations);

// Si les DEUX sources sont mortes et qu'aucun instantané n'existe, on ne publie
// rien du tout : mieux vaut le fichier d'hier que la moitié d'un fichier.
if ($mdf === null && $navi === null) {
    Feux::log('ERROR', 'aucune source disponible — arretes.json laisse en place');
    sortie(1, "amont indisponible");
}

// ───────────────────────────────────────────────────────────── fusion

$paquet = [
    'version' => (string) ($socle['version'] ?? '0.0.0'),
    'genere_le' => gmdate('c'),
    'genere_par' => 'cron.php',
    'socle_genere_le' => $socle['genere_le'] ?? null,

    // DOCTRINE — avertissement global, recopié verbatim du socle, jamais réécrit.
    'avertissement' => $socle['avertissement'],

    'mdf' => $mdf === null ? null : [
        'bulletin_du' => $mdf['bulletin_du'],
        'bulletin' => $mdf['bulletin'],
        'stats' => $mdf['stats'],
        'licence' => $mdf['licence'] ?? null,
        'maj_dataset' => $mdf['maj_dataset'] ?? null,
        'fichier_amont' => $mdf['fichier_amont'] ?? null,
        'producteur' => 'Météo-France — Météo des forêts',
        // Avertissement propre à la source, verbatim depuis le socle.
        'avertissement' => $socle['avertissements']['mdf'] ?? $socle['avertissement'],
    ],

    'navi' => $navi === null ? null : [
        'departements' => $navi['departements'],
        'stats' => $navi['stats'],
        'source' => Feux::UPSTREAM['naviforest'],
        'producteur' => 'IGN + FCBA (NaviForest)',
        'avertissement' => $socle['avertissements']['navi'] ?? $socle['avertissement'],
    ],

    // Zones qualifiées à la main : recopiées TELLES QUELLES, sans aucune
    // déduction serveur. Le statut est recalculé par le front à l'ouverture —
    // une seule implémentation de cette règle. Cf lib/feux.php, encadré
    // « Pas de statut_calcule côté serveur ».
    'interdits' => $socle['interdits'],

    'massifs' => $socle['massifs'] ?? null,
    'veille' => $socle['veille'] ?? ['stats' => [], 'departements' => []],

    'degradations' => $degradations,
    'frais' => $degradations === [],
];

if (!Feux::ecrireAtomique(Feux::OUT, Feux::jsonEncode($paquet))) {
    Feux::log('ERROR', 'ecriture atomique echouee — ancien fichier conserve');
    sortie(1, "ecriture impossible");
}

@touch($stamp);

Feux::log('INFO', 'publication ok', [
    'bulletin_du' => $mdf['bulletin_du'] ?? null,
    'arretes_navi' => $navi['stats']['arretes_total'] ?? null,
    'zones' => count($paquet['interdits']),
    'degradations' => count($degradations),
    'ms' => (int) ((microtime(true) - $t0) * 1000),
]);

sortie(0, sprintf(
    "ok — bulletin %s · %d zone(s) · %d degradation(s)",
    $mdf['bulletin_du'] ?? 'n/a',
    count($paquet['interdits']),
    count($degradations)
));

// ─────────────────────────────────────────────────────────────── helpers

/**
 * Exécute une étape de collecte en mode « fail soft » :
 *   - succès       → instantané normalisé conservé pour la prochaine panne
 *   - échec        → on rejoue le dernier instantané connu, et on trace la
 *                    dégradation DANS le JSON servi (le front doit pouvoir dire
 *                    « donnée du 26/07, amont muet depuis » plutôt que mentir)
 *   - jamais de retry en boucle : une seule tentative par passage de cron.
 */
function etape(string $cle, callable $fn, array &$degradations): ?array
{
    $snap = Feux::varDir() . '/snap-' . $cle . '.json';

    // Le garde-fou « budget temps web épuisé » a disparu avec le mode web
    // (arbitrage du 28/07/2026) : en CLI, le cron a tout son temps, et chaque
    // appel amont porte déjà son propre timeout dans Feux::fetch().
    try {
        $out = $fn();
        @file_put_contents($snap, Feux::jsonEncode(['le' => gmdate('c'), 'data' => $out]), LOCK_EX);
        return $out;
    } catch (Throwable $e) {
        Feux::log('WARN', 'source en echec', ['cle' => $cle, 'msg' => $e->getMessage()]);
        $degradations[] = ['source' => $cle, 'raison' => 'amont indisponible'];
        return relire($snap, $cle, $degradations);
    }
}

function relire(string $snap, string $cle, array &$degradations): ?array
{
    if (!is_readable($snap)) {
        return null;
    }
    $j = json_decode((string) file_get_contents($snap), true);
    if (!is_array($j) || !isset($j['data']) || !is_array($j['data'])) {
        return null;
    }
    $degradations[count($degradations) - 1]['repli_du'] = $j['le'] ?? null;
    return $j['data'];
}

function sortie(int $code, string $message): void
{
    // Message court, sans chemin ni trace : le détail est dans le log privé.
    echo $message . "\n";
    exit($code);
}
