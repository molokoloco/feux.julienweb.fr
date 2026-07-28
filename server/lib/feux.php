<?php
/**
 * lib/feux.php — socle commun (chemins, log, HTTP amont, écriture atomique, verrou).
 *
 * Aucune dépendance Composer. PHP >= 8.0.
 *
 * CE FICHIER NE PRODUIT AUCUNE SORTIE. Il est inclus par api.php et cron.php.
 * Il n'est jamais appelable directement (garde en tête de fichier + .htaccess).
 *
 * DOCTRINE (cf CLAUDE.md du projet, section « Doctrine ») :
 *   - `avertissement` et `confiance_dates` sont propagés VERBATIM, jamais retirés,
 *     jamais reformulés. `assertSocleValide()` refuse de publier si un seul y manque.
 *   - aucune date d'arrêté n'est déduite, extraite ou devinée ici. Le PHP ne lit
 *     aucun PDF. Il recopie ce qu'un humain a saisi dans zones-interdites.json.
 */

declare(strict_types=1);

// Garde : ce fichier n'est pas un point d'entrée web.
if (!defined('FEUX_BOOT')) {
    http_response_code(404);
    exit;
}

final class Feux
{
    /** Racine publique (docroot). Contient index.html et data/. */
    public const ROOT = __DIR__ . '/..';

    /** Dossier public des données servies. */
    public const DATA_DIR = self::ROOT . '/data';

    /** Le seul fichier public produit. Nom de contrat, figé côté front. */
    public const OUT = self::DATA_DIR . '/arretes.json';

    /**
     * Socle humain, poussé par SFTP depuis le poste de Julien, JAMAIS écrit par PHP.
     * Vit dans data/ pour rester dans la portée du helper SFTP, et est interdit
     * d'accès public par le .htaccess (le contrat public, c'est arretes.json).
     */
    public const SOCLE = self::DATA_DIR . '/socle.json';

    /**
     * URLs amont — LISTE BLANCHE EN DUR. Jamais construite depuis une entrée,
     * jamais concaténée avec un paramètre. Anti-SSRF, point n°1.
     */
    public const UPSTREAM = [
        'datagouv' => 'https://www.data.gouv.fr/api/1/datasets/archives-de-la-meteo-des-forets/',
        'naviforest' => 'https://naviforest.ign.fr/arretes-prefectoraux-acces-massifs-forestiers',
    ];

    /**
     * Hôtes autorisés — anti-SSRF, point n°2.
     * Indispensable : l'URL du CSV Météo-France n'est PAS en dur, elle est lue dans
     * la réponse JSON de data.gouv.fr. C'est de la donnée distante : un data.gouv
     * compromis ou une resource éditée pointerait où il veut. On revalide donc
     * l'hôte de l'URL résolue ET l'hôte final après redirections.
     */
    public const HOSTS_OK = [
        'www.data.gouv.fr',
        'static.data.gouv.fr',
        'object.data.gouv.fr',
        'meteofrance.s3.sbg.io.cloud.ovh.net',
        'naviforest.ign.fr',
    ];

    /** UA descriptif et joignable — même doctrine que collectors/_http.js. */
    public const UA = 'feux-foret-fr/0.4 (+https://feux.julienweb.fr/ ; contact@julienweb.fr)';

    /** Garde-fous de taille (anti zip-bomb / réponse aberrante). */
    public const MAX_DOWNLOAD = 12 * 1024 * 1024;   // 12 Mo compressés
    public const MAX_INFLATED = 64 * 1024 * 1024;   // 64 Mo décompressés

    public const LIBELLES = [1 => 'faible', 2 => 'modéré', 3 => 'élevé', 4 => 'très élevé'];
    public const COULEURS = [1 => 'vert', 2 => 'jaune', 3 => 'orange', 4 => 'rouge'];

    /**
     * Dossier privé, HORS DOCROOT.
     * <docroot>  →  <dossier-prive>
     * Contient : feux.log, var/ (verrou, cache amont, horodatage).
     */
    public static function privateDir(): string
    {
        $env = getenv('FEUX_PRIVATE_DIR');
        if (is_string($env) && $env !== '') {
            return rtrim($env, '/');
        }
        return dirname(realpath(self::ROOT) ?: self::ROOT) . '/.feux';
    }

    public static function varDir(): string
    {
        return self::privateDir() . '/var';
    }

    public static function ensureDirs(): void
    {
        foreach ([self::privateDir(), self::varDir(), self::varDir() . '/cache'] as $d) {
            if (!is_dir($d)) {
                @mkdir($d, 0750, true);
            }
        }
    }

    // ───────────────────────────────────────────────────────────── log

    /**
     * Journal détaillé, HORS DOCROOT, rotation à 1 Mo.
     * Rien de ce qui passe ici ne doit jamais atterrir dans une réponse HTTP.
     */
    public static function log(string $niveau, string $message, array $ctx = []): void
    {
        self::ensureDirs();
        $f = self::privateDir() . '/feux.log';
        if (is_file($f) && filesize($f) > 1024 * 1024) {
            @rename($f, $f . '.1');
        }
        $ligne = sprintf(
            "%s [%s] %s%s\n",
            gmdate('Y-m-d\TH:i:s\Z'),
            $niveau,
            $message,
            $ctx ? ' ' . json_encode($ctx, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : ''
        );
        @file_put_contents($f, $ligne, FILE_APPEND | LOCK_EX);
    }

    /**
     * Réponse d'erreur publique MUETTE : pas de chemin, pas de trace, pas de
     * nom de fichier serveur. Le détail est déjà dans le log privé.
     */
    public static function erreurPublique(int $code, string $codeCourt): void
    {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode(['erreur' => $codeCourt], JSON_UNESCAPED_SLASHES) . "\n";
        exit;
    }

    /**
     * Installe les gardes PHP : rien ne s'affiche, tout part au log privé.
     * À appeler en tête de chaque point d'entrée.
     */
    public static function durcirRuntime(): void
    {
        @ini_set('display_errors', '0');
        @ini_set('display_startup_errors', '0');
        @ini_set('log_errors', '0'); // on journalise nous-mêmes, hors docroot
        error_reporting(E_ALL);

        set_error_handler(static function (int $no, string $str): bool {
            Feux::log('WARN', 'php', ['no' => $no, 'msg' => $str]);
            return true; // avalé : jamais affiché
        });

        // Les erreurs fatales échappent à set_error_handler ET à set_exception_handler.
        // Sans ce filet, un OOM ou un timeout ne laisserait aucune trace exploitable.
        register_shutdown_function(static function (): void {
            $e = error_get_last();
            if ($e !== null && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
                Feux::log('FATAL', 'arret brutal', ['msg' => $e['message'], 'in' => basename((string) $e['file']) . ':' . $e['line']]);
            }
        });

        set_exception_handler(static function (Throwable $e): void {
            Feux::log('ERROR', 'exception', ['msg' => $e->getMessage(), 'in' => basename($e->getFile()) . ':' . $e->getLine()]);
            if (PHP_SAPI === 'cli') {
                fwrite(STDERR, "echec (detail dans le log prive)\n");
                exit(1);
            }
            Feux::erreurPublique(500, 'interne');
        });
    }

    // ───────────────────────────────────────────────────────────── verrou

    /** @var resource|null */
    private static $lockHandle = null;

    /**
     * Verrou exclusif non bloquant. Retourne false si une autre exécution tourne.
     * flock() suffit sur le NFS OVH pour ce cas (un seul processus écrivain).
     */
    public static function verrouiller(string $nom = 'cron'): bool
    {
        self::ensureDirs();
        $f = self::varDir() . '/' . $nom . '.lock';
        $fh = @fopen($f, 'c');
        if ($fh === false) {
            return false;
        }
        if (!flock($fh, LOCK_EX | LOCK_NB)) {
            fclose($fh);
            return false;
        }
        ftruncate($fh, 0);
        fwrite($fh, (string) getmypid());
        fflush($fh);
        self::$lockHandle = $fh; // gardé ouvert jusqu'à la fin du process
        return true;
    }

    // ───────────────────────────────────────────────────── écriture atomique

    /**
     * Écriture atomique : fichier temporaire dans LE MÊME dossier (obligatoire
     * pour que rename() soit atomique — même système de fichiers), fsync, puis
     * rename(). Le fichier servi n'est JAMAIS ouvert en écriture : un visiteur
     * lit soit l'ancienne version complète, soit la nouvelle. Jamais un tronçon.
     */
    public static function ecrireAtomique(string $cible, string $contenu): bool
    {
        $dir = dirname($cible);
        if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
            self::log('ERROR', 'dossier de sortie absent');
            return false;
        }
        $tmp = $dir . '/.' . basename($cible) . '.tmp.' . bin2hex(random_bytes(6));
        $fh = @fopen($tmp, 'wb');
        if ($fh === false) {
            self::log('ERROR', 'ouverture temporaire impossible');
            return false;
        }
        $ok = fwrite($fh, $contenu) === strlen($contenu);
        if ($ok) {
            fflush($fh);
            if (function_exists('fsync')) {
                @fsync($fh); // PHP 8.1+
            }
        }
        fclose($fh);
        if (!$ok) {
            @unlink($tmp);
            self::log('ERROR', 'ecriture temporaire incomplete');
            return false;
        }
        @chmod($tmp, 0644);
        if (!@rename($tmp, $cible)) { // atomique sur POSIX, écrase la cible
            @unlink($tmp);
            self::log('ERROR', 'rename atomique refuse');
            return false;
        }
        return true;
    }

    // ───────────────────────────────────────────────────────────── HTTP amont

    /**
     * GET d'une URL de la liste blanche, avec :
     *   - vérification d'hôte AVANT et APRÈS redirections (anti-SSRF)
     *   - https imposé, 3 redirections max
     *   - timeouts stricts (connexion 10 s, total $timeout)
     *   - plafond de taille, coupure en vol si dépassement
     *   - requête conditionnelle (ETag / If-Modified-Since) → 304 = zéro octet
     *
     * @return array{statut:int, corps:string, depuis_cache:bool}
     * @throws RuntimeException
     */
    public static function fetch(string $url, string $cle, int $timeout = 45, bool $identity = false): array
    {
        self::assertHoteAutorise($url);
        self::ensureDirs();

        $cacheCorps = self::varDir() . '/cache/' . self::cleSure($cle) . '.bin';
        $cacheMeta  = self::varDir() . '/cache/' . self::cleSure($cle) . '.meta.json';
        $meta = is_file($cacheMeta) ? (json_decode((string) file_get_contents($cacheMeta), true) ?: []) : [];

        $entetes = ['Accept: */*'];
        if ($identity) {
            $entetes[] = 'Accept-Encoding: identity';
        }
        if (!empty($meta['etag']) && is_file($cacheCorps)) {
            $entetes[] = 'If-None-Match: ' . $meta['etag'];
        }
        if (!empty($meta['last_modified']) && is_file($cacheCorps)) {
            $entetes[] = 'If-Modified-Since: ' . $meta['last_modified'];
        }

        if (!function_exists('curl_init')) {
            return self::fetchStream($url, $entetes, $timeout);
        }

        $ch = curl_init();
        $recu = '';
        $entetesRecus = [];

        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_HTTPHEADER => $entetes,
            CURLOPT_USERAGENT => self::UA,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_NOPROGRESS => false,
            CURLOPT_WRITEFUNCTION => static function ($ch, string $chunk) use (&$recu): int {
                $recu .= $chunk;
                if (strlen($recu) > Feux::MAX_DOWNLOAD) {
                    return 0; // coupe la connexion
                }
                return strlen($chunk);
            },
            CURLOPT_HEADERFUNCTION => static function ($ch, string $ligne) use (&$entetesRecus): int {
                $p = strpos($ligne, ':');
                if ($p !== false) {
                    $entetesRecus[strtolower(trim(substr($ligne, 0, $p)))] = trim(substr($ligne, $p + 1));
                }
                return strlen($ligne);
            },
            CURLOPT_XFERINFOFUNCTION => static function ($ch, $dlTotal, $dlNow): int {
                return ($dlTotal > Feux::MAX_DOWNLOAD || $dlNow > Feux::MAX_DOWNLOAD) ? 1 : 0;
            },
        ]);
        // https uniquement, y compris après redirection
        if (defined('CURLOPT_PROTOCOLS_STR')) {
            curl_setopt($ch, CURLOPT_PROTOCOLS_STR, 'https');
            curl_setopt($ch, CURLOPT_REDIR_PROTOCOLS_STR, 'https');
        } elseif (defined('CURLPROTO_HTTPS')) {
            curl_setopt($ch, CURLOPT_PROTOCOLS, CURLPROTO_HTTPS);
            curl_setopt($ch, CURLOPT_REDIR_PROTOCOLS, CURLPROTO_HTTPS);
        }

        $ok = curl_exec($ch);
        $statut = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $finale = (string) curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
        $err = curl_error($ch);
        curl_close($ch);

        if ($ok === false && $statut === 0) {
            throw new RuntimeException('reseau: ' . ($err ?: 'echec'));
        }
        // La coupure en vol (WRITEFUNCTION → 0) laisse un corps déjà trop gros :
        // on le jette explicitement plutôt que de le mettre en cache.
        if (strlen($recu) > self::MAX_DOWNLOAD) {
            throw new RuntimeException('reponse trop volumineuse');
        }
        // L'URL finale après redirections doit elle aussi être sur un hôte autorisé.
        self::assertHoteAutorise($finale);

        if ($statut === 304 && is_file($cacheCorps)) {
            self::log('INFO', 'amont inchange (304)', ['cle' => $cle]);
            return ['statut' => 304, 'corps' => (string) file_get_contents($cacheCorps), 'depuis_cache' => true];
        }
        if ($statut < 200 || $statut >= 300) {
            throw new RuntimeException('http ' . $statut);
        }
        if ($recu === '') {
            throw new RuntimeException('reponse vide');
        }

        @file_put_contents($cacheCorps, $recu, LOCK_EX);
        @file_put_contents($cacheMeta, json_encode([
            'etag' => $entetesRecus['etag'] ?? null,
            'last_modified' => $entetesRecus['last-modified'] ?? null,
            'le' => gmdate('c'),
        ]), LOCK_EX);

        return ['statut' => $statut, 'corps' => $recu, 'depuis_cache' => false];
    }

    /** Repli sans cURL (peu probable sur OVH, mais on ne suppose rien). */
    private static function fetchStream(string $url, array $entetes, int $timeout): array
    {
        $ctx = stream_context_create(['http' => [
            'method' => 'GET',
            'header' => implode("\r\n", $entetes) . "\r\nUser-Agent: " . self::UA,
            'timeout' => $timeout,
            'follow_location' => 1,
            'max_redirects' => 3,
            'ignore_errors' => true,
        ], 'ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);

        $fh = @fopen($url, 'rb', false, $ctx);
        if ($fh === false) {
            throw new RuntimeException('reseau: ouverture impossible');
        }
        $corps = (string) stream_get_contents($fh, self::MAX_DOWNLOAD + 1);
        fclose($fh);
        if (strlen($corps) > self::MAX_DOWNLOAD) {
            throw new RuntimeException('reponse trop volumineuse');
        }
        $statut = 0;
        foreach ($http_response_header ?? [] as $h) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) {
                $statut = (int) $m[1];
            }
        }
        if ($statut < 200 || $statut >= 300) {
            throw new RuntimeException('http ' . $statut);
        }
        return ['statut' => $statut, 'corps' => $corps, 'depuis_cache' => false];
    }

    /** Anti-SSRF : schéma https + hôte dans la liste blanche, sinon on refuse. */
    public static function assertHoteAutorise(string $url): void
    {
        $p = parse_url($url);
        if (!is_array($p) || ($p['scheme'] ?? '') !== 'https' || empty($p['host'])) {
            throw new RuntimeException('url amont refusee (schema)');
        }
        if (!in_array(strtolower($p['host']), self::HOSTS_OK, true)) {
            self::log('ERROR', 'hote amont hors liste blanche', ['hote' => $p['host']]);
            throw new RuntimeException('url amont refusee (hote)');
        }
    }

    /** Clé de cache : jamais dérivée d'une entrée, et de toute façon assainie. */
    private static function cleSure(string $cle): string
    {
        return preg_replace('/[^a-z0-9_-]/', '', strtolower($cle)) ?: 'x';
    }

    /**
     * Décompression gzip en flux, plafonnée. `gzdecode()` alloue tout d'un coup :
     * une archive piégée ferait exploser la mémoire du process PHP mutualisé.
     */
    public static function gunzipBorne(string $gz): string
    {
        if (!function_exists('inflate_init')) {
            $out = @gzdecode($gz);
            if ($out === false || strlen($out) > self::MAX_INFLATED) {
                throw new RuntimeException('gunzip refuse');
            }
            return $out;
        }
        $ctx = inflate_init(ZLIB_ENCODING_GZIP);
        if ($ctx === false) {
            throw new RuntimeException('gunzip init');
        }
        $out = '';
        $taille = 8192;
        for ($i = 0; $i < strlen($gz); $i += $taille) {
            $bout = inflate_add($ctx, substr($gz, $i, $taille), ZLIB_NO_FLUSH);
            if ($bout === false) {
                throw new RuntimeException('gunzip corrompu');
            }
            $out .= $bout;
            if (strlen($out) > self::MAX_INFLATED) {
                throw new RuntimeException('gunzip: plafond depasse');
            }
        }
        $out .= (string) inflate_add($ctx, '', ZLIB_FINISH);
        return $out;
    }

    // ─────────────────────────────────────────────── parseurs amont (portés de Node)

    /**
     * CSV Météo des forêts. Schéma amont : date;num_dep;niveau_j1;niveau_j2;nom_dep
     * Portage fidèle de collectors/meteo-forets.js — si une colonne disparaît, on
     * lève : mieux vaut un bulletin périmé qu'un bulletin faux.
     */
    public static function parseMdf(string $csv): array
    {
        $lignes = preg_split('/\r?\n/', $csv) ?: [];
        $lignes = array_values(array_filter($lignes, static fn($l) => $l !== ''));
        if (count($lignes) < 2) {
            throw new RuntimeException('csv mdf vide');
        }
        $entete = array_map('trim', explode(';', $lignes[0]));
        $idx = array_flip($entete);
        foreach (['date', 'num_dep', 'niveau_j1', 'niveau_j2', 'nom_dep'] as $c) {
            if (!isset($idx[$c])) {
                throw new RuntimeException('schema mdf modifie: colonne ' . $c . ' absente');
            }
        }

        $parJour = [];
        for ($i = 1, $n = count($lignes); $i < $n; $i++) {
            $c = explode(';', $lignes[$i]);
            $jour = substr((string) ($c[$idx['date']] ?? ''), 0, 10);
            if ($jour === '') {
                continue;
            }
            $parJour[$jour][] = [
                'departement' => (string) ($c[$idx['num_dep']] ?? ''),
                'nom' => (string) ($c[$idx['nom_dep']] ?? ''),
                'j1' => (int) ($c[$idx['niveau_j1']] ?? 0),
                'j2' => (int) ($c[$idx['niveau_j2']] ?? 0),
            ];
        }
        if (!$parJour) {
            throw new RuntimeException('csv mdf sans ligne exploitable');
        }
        $jours = array_keys($parJour);
        sort($jours);
        $dernier = end($jours);

        $bulletin = [];
        foreach ($parJour[$dernier] as $r) {
            $bulletin[] = [
                'departement' => $r['departement'],
                'nom' => $r['nom'],
                'j1' => ['niveau' => $r['j1'], 'libelle' => self::LIBELLES[$r['j1']] ?? null, 'couleur' => self::COULEURS[$r['j1']] ?? null],
                'j2' => ['niveau' => $r['j2'], 'libelle' => self::LIBELLES[$r['j2']] ?? null, 'couleur' => self::COULEURS[$r['j2']] ?? null],
            ];
        }
        usort($bulletin, static fn($a, $b) => strcmp($a['departement'], $b['departement']));

        $alerte = 0;
        foreach ($bulletin as $d) {
            if ($d['j1']['niveau'] >= 3) {
                $alerte++;
            }
        }

        return [
            'bulletin_du' => $dernier,
            'bulletin' => $bulletin,
            'stats' => [
                'departements' => count($bulletin),
                'jours_disponibles' => count($jours),
                'premier_jour' => $jours[0],
                'departements_niveau_3_ou_4_j1' => $alerte,
            ],
        ];
    }

    /** Page NaviForest — portage fidèle de collectors/naviforest.js. */
    public static function parseNaviforest(string $html): array
    {
        $base = 'https://naviforest.ign.fr';
        $blocs = preg_split('/<tr\s+data-id="/', $html) ?: [];
        array_shift($blocs);

        $deps = [];
        foreach ($blocs as $raw) {
            $dep = strtoupper(substr($raw, 0, 2));
            if (!preg_match('/^[0-9][0-9AB]$/', $dep)) {
                continue;
            }
            if (!isset($deps[$dep])) {
                $deps[$dep] = ['departement' => $dep, 'nom' => null, 'arretes' => []];
            }
            if (preg_match('/class="grid-name"\s*>(.*?)<\/td>/s', $raw, $m) && $deps[$dep]['nom'] === null) {
                $deps[$dep]['nom'] = preg_replace('/^\d{2}\s*-\s*/', '', self::decodeEntities($m[1]));
            }
            $re = '/<td class="decree-name".*?href="([^"]+)".*?>([^<]*)<\/a>.*?<td class="decree-date"\s*>(.*?)<\/td>/s';
            if (preg_match_all($re, $raw, $ms, PREG_SET_ORDER)) {
                foreach ($ms as $m) {
                    $href = trim($m[1]);
                    $dateTxt = self::decodeEntities($m[3]);
                    $deps[$dep]['arretes'][] = [
                        'fichier' => self::decodeEntities($m[2]),
                        'url' => str_starts_with($href, 'http') ? $href : $base . $href,
                        'validite_texte' => $dateTxt !== '' ? $dateTxt : null,
                        // Recopie d'une date IMPRIMÉE sur la page amont, pas une déduction.
                        'valide_jusqu_au' => preg_match('/(\d{2})-(\d{2})-(\d{4})/', $dateTxt, $d)
                            ? $d[3] . '-' . $d[2] . '-' . $d[1] : null,
                    ];
                }
            }
        }
        if (!$deps) {
            throw new RuntimeException('naviforest: aucune ligne (structure amont modifiee ?)');
        }
        // SORT_STRING impératif : '01'…'19', '2A', '2B', '21'… Un tri numérique
        // classerait 2A/2B n'importe où (même ordre que le localeCompare du Node).
        ksort($deps, SORT_STRING);
        $deps = array_values($deps);

        $avec = 0;
        $total = 0;
        foreach ($deps as $d) {
            $total += count($d['arretes']);
            if ($d['arretes']) {
                $avec++;
            }
        }
        return [
            'departements' => $deps,
            'stats' => [
                'departements_listes' => count($deps),
                'departements_avec_arrete' => $avec,
                'departements_sans_arrete' => count($deps) - $avec,
                'arretes_total' => $total,
            ],
        ];
    }

    public static function decodeEntities(string $s): string
    {
        $s = html_entity_decode($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $s = str_replace("\xC2\xA0", ' ', $s);
        return trim((string) preg_replace('/\s+/u', ' ', $s));
    }

    // ───────────────────────────────────────────── validation doctrinale du socle

    /**
     * FAIL CLOSED. On refuse de publier plutôt que de publier une zone amputée
     * de son `confiance_dates` ou de son `avertissement` : c'est exactement la
     * confusion que la doctrine du projet interdit (règles 1 et 3 de CLAUDE.md).
     *
     * @throws RuntimeException
     */
    public static function assertSocleValide(array $socle): void
    {
        if (!isset($socle['avertissement']) || !is_string($socle['avertissement']) || $socle['avertissement'] === '') {
            throw new RuntimeException('socle: avertissement global absent — publication refusee');
        }
        if (!isset($socle['interdits']) || !is_array($socle['interdits'])) {
            throw new RuntimeException('socle: zones interdites absentes — publication refusee');
        }
        foreach ($socle['interdits'] as $i => $z) {
            if (!is_array($z) || !array_key_exists('confiance_dates', $z) || !is_string($z['confiance_dates'] ?? null)) {
                throw new RuntimeException('socle: confiance_dates absente sur la zone #' . (int) $i . ' — publication refusee');
            }
            if (!in_array($z['confiance_dates'], ['verifiee', 'partielle', 'inconnue'], true)) {
                throw new RuntimeException('socle: confiance_dates hors nomenclature sur la zone #' . (int) $i);
            }
            if (!array_key_exists('fin', $z) || !array_key_exists('statut', $z)) {
                throw new RuntimeException('socle: zone #' . (int) $i . ' incomplete (fin/statut)');
            }
        }
    }

    /*
     * ─── Pas de `statut_calcule` côté serveur — arbitrage du 28/07/2026 ───
     *
     * Une méthode `annoterStatut()` existait ici : elle comparait la date de fin
     * saisie par un humain à l'horloge et ajoutait un `statut_calcule` à côté du
     * `statut` constaté. Retirée volontairement.
     *
     * Motif : **le front recalcule déjà le statut à chaque ouverture de page**,
     * c'est la doctrine du projet et c'est implémenté. Porter la même règle ici
     * en aurait fait DEUX implémentations, dans deux langages, d'un calcul dont
     * le résultat conditionne une amende. Le jour où l'une évolue et pas l'autre,
     * la page et le flux se contredisent — sur « ce massif est-il fermé ? ».
     *
     * Le serveur transporte donc les zones **telles que l'humain les a saisies**
     * (`statut`, `debut`, `fin`, `fin_condition`, `confiance_dates`, `abroge_par`)
     * et laisse le consommateur trancher. C'est aussi ce qui rend le flux
     * réutilisable : un tiers applique sa propre règle sur des faits bruts, pas
     * sur notre interprétation.
     *
     * Si ce calcul devait un jour revenir côté serveur, il faudrait d'abord
     * RETIRER celui du front — pas l'ajouter à côté.
     */

    public static function jsonEncode(array $data): string
    {
        $s = json_encode(
            $data,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION | JSON_THROW_ON_ERROR
        );
        return $s . "\n";
    }
}
