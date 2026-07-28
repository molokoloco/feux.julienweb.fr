<?php
/**
 * api.php — chemin SECONDAIRE, hors chemin critique.
 *
 * ⚠️ Le contrat public du front, c'est le FICHIER STATIQUE `data/arretes.json`,
 *    servi par Apache. Le front fait `fetch('data/arretes.json')`, jamais
 *    `fetch('api.php')`. Argumentaire complet dans SPEC.md § « Statique vs PHP ».
 *
 * Ce script n'existe que pour deux usages où le fichier statique ne suffit pas :
 *   1. `?dep=NN`   — vue filtrée sur un département (utile à un tiers réutilisateur,
 *                    ou à une future page « /33 » ; évite de télécharger tout le flux) ;
 *   2. `?meta=1`   — entête seul (fraîcheur, dégradations) pour une sonde de supervision.
 *
 * Propriétés de sécurité :
 *   - AUCUNE écriture. Ce script ne crée, ne modifie, ne supprime rien.
 *   - AUCUNE entrée utilisateur ne touche le système de fichiers : le seul chemin
 *     lu est la constante Feux::OUT. `dep` sert uniquement de clé de comparaison
 *     en mémoire, après validation par liste blanche stricte.
 *   - Aucun include dynamique, aucun eval, aucun unserialize, aucun shell.
 *   - Erreurs muettes (code court), détail dans le log privé hors docroot.
 */

declare(strict_types=1);

define('FEUX_BOOT', true);
require __DIR__ . '/lib/feux.php';

Feux::durcirRuntime();

// Lecture seule, et rien d'autre que GET/HEAD.
$methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($methode !== 'GET' && $methode !== 'HEAD') {
    header('Allow: GET, HEAD');
    Feux::erreurPublique(405, 'methode');
}

$fichier = Feux::OUT;
if (!is_readable($fichier)) {
    // Le cron n'a jamais tourné, ou le socle est invalide : on ne fabrique rien
    // à la volée. Le front bascule silencieusement sur ses données embarquées.
    Feux::log('WARN', 'arretes.json absent a la lecture');
    Feux::erreurPublique(503, 'indisponible');
}

// ───────────────────────────────────────────────── validation des paramètres

/**
 * LISTE BLANCHE STRICTE. Deux barrières successives :
 *   1. forme  : codes de départements français uniquement (01–95, 2A, 2B, 971–976) ;
 *   2. fond   : le code doit exister dans les données déjà chargées.
 * Le paramètre n'est JAMAIS concaténé à un chemin, ni passé à une fonction
 * de fichier. Un `?dep[]=x` (tableau) est rejeté par le `is_string`.
 */
$dep = null;
if (isset($_GET['dep'])) {
    $brut = $_GET['dep'];
    if (!is_string($brut) || !preg_match('/^(?:0[1-9]|[1-8][0-9]|9[0-5]|2A|2B|97[1-6])$/', strtoupper($brut))) {
        Feux::erreurPublique(400, 'parametre');
    }
    $dep = strtoupper($brut);
}
$metaSeule = isset($_GET['meta']) && $_GET['meta'] === '1';

// ───────────────────────────────────────────────────────── cache / conditionnel

$mtime = (int) filemtime($fichier);
$taille = (int) filesize($fichier);
$etag = '"' . sha1($mtime . ':' . $taille . ':' . ($dep ?? '-') . ':' . ($metaSeule ? 'm' : 'f')) . '"';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('ETag: ' . $etag);
header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');
// Le bulletin change une fois par jour ; 15 min de cache + revalidation douce.
header('Cache-Control: public, max-age=900, stale-while-revalidate=3600');
// Donnée publique sous licence ouverte, sans cookie ni credential : CORS ouvert.
header('Access-Control-Allow-Origin: *');

$sinceEtag = $_SERVER['HTTP_IF_NONE_MATCH'] ?? '';
$sinceDate = $_SERVER['HTTP_IF_MODIFIED_SINCE'] ?? '';
if (
    ($sinceEtag !== '' && str_contains($sinceEtag, trim($etag, '"'))) ||
    ($sinceDate !== '' && @strtotime($sinceDate) >= $mtime)
) {
    http_response_code(304);
    exit;
}

if ($methode === 'HEAD') {
    exit;
}

// ─────────────────────────────────────────────────────────────── service

// Cas nominal : passe-plat brut. Aucun json_decode, aucune allocation inutile.
// C'est exactement ce que ferait Apache — d'où l'intérêt de servir le fichier
// statique directement plutôt que de passer par ici.
// (pas de Content-Length : mod_deflate recompresse la sortie et l'en-tête
//  deviendrait faux — Apache le recalcule très bien tout seul.)
if ($dep === null && !$metaSeule) {
    readfile($fichier);
    exit;
}

$brut = @file_get_contents($fichier);
if ($brut === false) {
    Feux::log('ERROR', 'lecture arretes.json impossible');
    Feux::erreurPublique(503, 'indisponible');
}
$data = json_decode($brut, true); // json_decode, jamais unserialize
if (!is_array($data)) {
    Feux::log('ERROR', 'arretes.json illisible');
    Feux::erreurPublique(503, 'indisponible');
}

// Entête commun — l'avertissement doctrinal et la fraîcheur suivent TOUJOURS la
// réponse, y compris filtrée. Une vue partielle ne perd jamais son avertissement.
$rep = [
    'version' => $data['version'] ?? null,
    'genere_le' => $data['genere_le'] ?? null,
    'avertissement' => $data['avertissement'] ?? null,
    'frais' => $data['frais'] ?? null,
    'degradations' => $data['degradations'] ?? [],
];

if ($metaSeule) {
    $rep['stats'] = [
        'bulletin_du' => $data['mdf']['bulletin_du'] ?? null,
        'departements_mdf' => $data['mdf']['stats']['departements'] ?? null,
        'arretes_navi' => $data['navi']['stats']['arretes_total'] ?? null,
        'zones_qualifiees' => is_array($data['interdits'] ?? null) ? count($data['interdits']) : null,
    ];
    echo Feux::jsonEncode($rep);
    exit;
}

// ── Filtre par département : comparaisons en mémoire, zéro accès disque ──
$filtre = static fn(array $liste, string $champ): array => array_values(array_filter(
    $liste,
    static fn($e) => is_array($e) && strtoupper((string) ($e[$champ] ?? '')) === $dep
));

$rep['departement'] = $dep;
$rep['mdf'] = [
    'bulletin_du' => $data['mdf']['bulletin_du'] ?? null,
    'avertissement' => $data['mdf']['avertissement'] ?? ($data['avertissement'] ?? null),
    'bulletin' => $filtre($data['mdf']['bulletin'] ?? [], 'departement'),
];
$rep['navi'] = [
    'avertissement' => $data['navi']['avertissement'] ?? null,
    'departements' => $filtre($data['navi']['departements'] ?? [], 'departement'),
];
// `interdits` conserve chaque zone INTÉGRALEMENT : confiance_dates, dérogations,
// note, source. Rien n'est élagué — une vue filtrée n'est pas une vue simplifiée.
$rep['interdits'] = $filtre($data['interdits'] ?? [], 'departement');
$rep['veille'] = ['departements' => $filtre($data['veille']['departements'] ?? [], 'code')];

// Barrière n°2 : le code est-il connu des données ? Si non, on le dit franchement
// au lieu de laisser croire à un département sans arrêté.
$rep['departement_connu'] = $rep['mdf']['bulletin'] !== [] || $rep['navi']['departements'] !== [];

echo Feux::jsonEncode($rep);
