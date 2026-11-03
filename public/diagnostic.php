<?php
/**
 * Lumko website — diagnostic lead handler.
 *
 * Receives a JSON POST from the diagnostics (src/lib/diagnostics/client.ts),
 * validates it against the build-time schema (/diagnostics/schema.json),
 * recalculates flags and Process metrics server-side, and emails a
 * structured lead notification (plain text + JSON attachment) to Lumko.
 *
 *   200 {ok:true, ref}                         sent (or silently dropped bot)
 *   422 {ok:false, error:'fields', fields:[]}   contact details need fixing
 *   4xx/5xx {ok:false, error:'...'}             rejected / unavailable
 *
 * No database: if persistent storage or a CRM is added later, set
 * LUMKO_CRM_WEBHOOK to receive the same JSON record (see forward_to_crm).
 *
 * Local testing: LUMKO_CONTACT_DRYRUN=1 writes the email to the system temp
 * directory (lumko-diagnostic-last.txt) instead of sending it.
 *
 * The existing contact form (contact.php) is separate and unchanged.
 * Keep cond_eval() and process_metrics() in step with
 * src/lib/diagnostics/conditions.ts and process-metrics.ts.
 */

declare(strict_types=1);

const TO_ADDRESS   = 'info@lumko.cloud';
const FROM_ADDRESS = 'website@lumko.cloud';
const FROM_NAME    = 'Lumko diagnostics';
const MIN_SECONDS  = 4;       // lead form submitted faster than this: bot
const MAX_AGE      = 604800;  // form timestamp older than 7 days: stale
const RATE_LIMIT   = 5;       // submissions per IP ...
const RATE_WINDOW  = 3600;    // ... per hour
const MAX_BODY     = 65536;   // bytes

/* -------------------------------------------------------------------------- */
/* Response helpers                                                            */
/* -------------------------------------------------------------------------- */

function respond(int $status, array $data): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex, nofollow');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/** Trim, drop control characters, cap length (same rules as contact.php). */
function clean($v, int $max): string
{
    if (!is_string($v) && !is_int($v) && !is_float($v)) return '';
    $v = preg_replace('/\p{C}/u', '', (string) $v);
    return mb_substr(trim((string) $v), 0, $max);
}

function one_line(string $s): string
{
    return str_replace(["\r", "\n"], ' ', $s);
}

/* -------------------------------------------------------------------------- */
/* Request checks                                                              */
/* -------------------------------------------------------------------------- */

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'error' => 'method']);
}

$ctype = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? ''));
if (strpos($ctype, 'application/json') !== 0) {
    // Requiring JSON blocks plain cross-site form posts (no CORS preflight bypass).
    respond(415, ['ok' => false, 'error' => 'type']);
}

// Same-origin check: browsers send Origin on fetch POSTs; fall back to Referer.
$host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
$origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
$referer = (string) ($_SERVER['HTTP_REFERER'] ?? '');
$sourceHost = strtolower((string) parse_url($origin !== '' ? $origin : $referer, PHP_URL_HOST));
$sourcePort = parse_url($origin !== '' ? $origin : $referer, PHP_URL_PORT);
if ($sourcePort) $sourceHost .= ':' . $sourcePort;
if ($host === '' || $sourceHost === '' || $sourceHost !== $host) {
    respond(403, ['ok' => false, 'error' => 'origin']);
}

$raw = (string) file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
if (strlen($raw) > MAX_BODY) respond(413, ['ok' => false, 'error' => 'size']);
$in = json_decode($raw, true);
if (!is_array($in)) respond(400, ['ok' => false, 'error' => 'json']);

// ---- Bot filtering (silent: bots are told it worked) ----------------------
if (!empty($in['website'])) respond(200, ['ok' => true, 'ref' => 'LD-0']);
$ts = is_int($in['ts'] ?? null) ? $in['ts'] : 0;
$age = time() - $ts;
if ($ts <= 0 || $age < MIN_SECONDS || $age > MAX_AGE) respond(200, ['ok' => true, 'ref' => 'LD-0']);

// ---- Rate limit per IP --------------------------------------------------------
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'lumko-diag-' . hash('sha256', $ip) . '.json';
$now = time();
$hits = [];
if (is_file($rateFile)) {
    $hits = array_values(array_filter(
        (array) json_decode((string) @file_get_contents($rateFile), true),
        static function ($t) use ($now) { return is_int($t) && ($now - $t) < RATE_WINDOW; }
    ));
}
if (count($hits) >= RATE_LIMIT) respond(429, ['ok' => false, 'error' => 'limit']);

// ---- Schema ---------------------------------------------------------------------
$schemaFile = __DIR__ . DIRECTORY_SEPARATOR . 'diagnostics' . DIRECTORY_SEPARATOR . 'schema.json';
$schema = is_file($schemaFile) ? json_decode((string) file_get_contents($schemaFile), true) : null;
if (!is_array($schema) || !isset($schema['diagnostics'])) respond(503, ['ok' => false, 'error' => 'unavailable']);

$diagId = clean($in['diagnostic']['id'] ?? '', 40);
$cfg = $schema['diagnostics'][$diagId] ?? null;
if (!is_array($cfg)) respond(400, ['ok' => false, 'error' => 'diagnostic']);
if ((int) ($in['diagnostic']['version'] ?? 0) !== (int) $cfg['version']) respond(409, ['ok' => false, 'error' => 'version']);

/* -------------------------------------------------------------------------- */
/* Contact details                                                             */
/* -------------------------------------------------------------------------- */

$c = is_array($in['contact'] ?? null) ? $in['contact'] : [];
$values = static function (array $opts): array { return array_map(static function ($o) { return $o['value']; }, $opts); };
$contact = [
    'name'         => clean($c['name'] ?? '', 120),
    'email'        => clean($c['email'] ?? '', 254),
    'phone'        => clean($c['phone'] ?? '', 40),
    'organisation' => clean($c['organisation'] ?? '', 160),
    'role'         => clean($c['role'] ?? '', 120),
    'org_type'     => clean($c['org_type'] ?? '', 40),
    'industry'     => clean($c['industry'] ?? '', 60),
    'org_size'     => clean($c['org_size'] ?? '', 20),
    'region'       => clean($c['region'] ?? '', 40),
];
$consent = [
    'contact'   => (($in['consent']['contact'] ?? false) === true),
    'marketing' => (($in['consent']['marketing'] ?? false) === true),
];

$bad = [];
if (mb_strlen($contact['name']) < 2) $bad[] = 'name';
if (!filter_var($contact['email'], FILTER_VALIDATE_EMAIL)) $bad[] = 'email';
if (mb_strlen($contact['organisation']) < 2) $bad[] = 'organisation';
if (mb_strlen($contact['role']) < 2) $bad[] = 'role';
if ($contact['phone'] !== '' && !preg_match('/^[+()\d\s-]{7,20}$/', $contact['phone'])) $bad[] = 'phone';
foreach (['org_type', 'industry', 'org_size'] as $k) {
    if (!in_array($contact[$k], $values($schema['lead'][$k] ?? []), true)) $bad[] = $k;
}
if ($contact['region'] !== '' && !in_array($contact['region'], $values($schema['lead']['region'] ?? []), true)) $contact['region'] = '';
if (!$consent['contact']) $bad[] = 'contact_consent';
if ($bad) respond(422, ['ok' => false, 'error' => 'fields', 'fields' => $bad]);

/* -------------------------------------------------------------------------- */
/* Answers: allow-list against the schema, then prune hidden branches          */
/* -------------------------------------------------------------------------- */

$questions = [];
foreach ($cfg['steps'] as $s) foreach ($s['questions'] as $q) $questions[$q['id']] = $q;

/** Allowed option values for a choice question (resolves optionsFrom). */
function allowed_options(array $q, array $questions): array
{
    if (!empty($q['optionsFrom'])) {
        $src = $questions[$q['optionsFrom']['q']] ?? ['options' => []];
        $out = $src['options'] ?? [];
        foreach ($q['optionsFrom']['extra'] ?? [] as $e) $out[] = $e['option'];
        return $out;
    }
    return $q['options'] ?? [];
}

$rawAnswers = is_array($in['answers'] ?? null) ? $in['answers'] : [];
$answers = [];
$dropped = 0;
foreach ($rawAnswers as $id => $v) {
    $q = $questions[$id] ?? null;
    if (!$q) { $dropped++; continue; }
    $type = $q['type'];
    if ($type === 'single') {
        $allowed = array_column(allowed_options($q, $questions), 'value');
        if (is_string($v) && in_array($v, $allowed, true)) $answers[$id] = $v; else $dropped++;
    } elseif ($type === 'multi') {
        $allowed = array_column($q['options'] ?? [], 'value');
        if (!is_array($v)) { $dropped++; continue; }
        $vals = array_values(array_unique(array_filter($v, static function ($x) use ($allowed) { return is_string($x) && in_array($x, $allowed, true); })));
        if ($vals) $answers[$id] = $vals; else $dropped++;
    } elseif ($type === 'text') {
        $t = clean($v, (int) ($q['maxLength'] ?? 120));
        if ($t !== '') $answers[$id] = $t;
    } elseif ($type === 'number') {
        if (!is_array($v)) { $dropped++; continue; }
        $a = [];
        if (isset($v['state']) && in_array($v['state'], ['unsure', 'none'], true)) {
            $a['state'] = $v['state'];
        } else {
            if (isset($v['value']) && (is_int($v['value']) || is_float($v['value']))) {
                $n = (float) $v['value'];
                $min = isset($q['min']) ? (float) $q['min'] : 0.0;
                $max = isset($q['max']) ? (float) $q['max'] : INF;
                if (is_finite($n) && $n >= $min && $n <= $max) $a['value'] = $n;
            }
            if (isset($v['unit']) && in_array($v['unit'], $q['units'] ?? [], true)) $a['unit'] = $v['unit'];
        }
        if ($a) $answers[$id] = $a; else $dropped++;
    }
}

/* ---- Condition evaluator (mirror of conditions.ts) ------------------------ */

function array_is_list_compat(array $a): bool
{
    return $a === [] || array_keys($a) === range(0, count($a) - 1);
}

function is_answered($v): bool
{
    if ($v === null) return false;
    if (is_string($v)) return trim($v) !== '';
    if (is_array($v) && array_is_list_compat($v)) return count($v) > 0;
    if (is_array($v)) return isset($v['state']) || (isset($v['value']) && is_finite((float) $v['value']));
    return false;
}

function selected($v): array
{
    if (is_string($v)) return $v === '' ? [] : [$v];
    if (is_array($v) && array_is_list_compat($v)) return $v;
    if (is_array($v) && isset($v['unit'])) return [$v['unit']];
    return [];
}

function cond_eval(array $c, array $ctx): bool
{
    if (isset($c['always'])) return true;
    if (isset($c['all'])) { foreach ($c['all'] as $x) if (!cond_eval($x, $ctx)) return false; return true; }
    if (isset($c['any'])) { foreach ($c['any'] as $x) if (cond_eval($x, $ctx)) return true; return false; }
    if (isset($c['not'])) return !cond_eval($c['not'], $ctx);
    if (isset($c['flagCount'])) {
        $n = 0;
        foreach ($c['flagCount'] as $id) {
            $f = $ctx['flags'][$id] ?? null;
            if ($f && ($f['confirmed'] || !empty($c['includeUncertain']))) $n++;
        }
        return $n >= $c['gte'];
    }
    if (isset($c['flag'])) {
        $f = $ctx['flags'][$c['flag']] ?? null;
        if (!$f) return false;
        return !empty($c['confirmed']) ? $f['confirmed'] : true;
    }
    if (isset($c['metric'])) {
        $m = $ctx['metrics'][$c['metric']] ?? null;
        if ($m === null || !is_finite((float) $m)) return false;
        if (isset($c['gte']) && $m < $c['gte']) return false;
        if (isset($c['lte']) && $m > $c['lte']) return false;
        return true;
    }
    $v = $ctx['answers'][$c['q']] ?? null;
    if (array_key_exists('answered', $c)) return is_answered($v) === (bool) $c['answered'];
    if (isset($c['in'])) return count(array_intersect(selected($v), $c['in'])) > 0;
    if (isset($c['notIn'])) { $s = selected($v); return count($s) > 0 && count(array_intersect($s, $c['notIn'])) === 0; }
    if (isset($c['state'])) return is_array($v) && ($v['state'] ?? null) === $c['state'];
    if (isset($c['gte']) || isset($c['lte'])) {
        if (!is_array($v) || !isset($v['value']) || isset($v['state'])) return false;
        if (isset($c['gte'])) return $v['value'] >= $c['gte'];
        return $v['value'] <= $c['lte'];
    }
    if (isset($c['countGte']) || isset($c['countLte'])) {
        $s = selected($v);
        if (isset($c['among'])) $s = array_values(array_intersect($s, $c['among']));
        if (isset($c['countGte'])) return count($s) >= $c['countGte'];
        return count($s) <= $c['countLte'];
    }
    return false;
}

/* ---- Branch pruning (mirror of scoring.ts visibleSteps/pruneAnswers) ------- */

$endedEarly = false;
$visible = [];
foreach ($cfg['steps'] as $s) {
    $any = false;
    foreach ($s['questions'] as $q) {
        if (empty($q['showWhen']) || cond_eval($q['showWhen'], ['answers' => $answers])) { $visible[$q['id']] = true; $any = true; }
    }
    if ($any && !empty($s['endsWhen']) && cond_eval($s['endsWhen'], ['answers' => $answers])) { $endedEarly = true; break; }
}
foreach (array_keys($answers) as $id) if (empty($visible[$id])) { unset($answers[$id]); $dropped++; }

/* ---- Process metrics (mirror of process-metrics.ts) ------------------------ */

function round_hours(float $h): float
{
    if ($h < 10) return round($h);
    if ($h < 100) return round($h / 5) * 5;
    if ($h < 1000) return round($h / 10) * 10;
    return round($h / 50) * 50;
}

function round_money(float $r): float
{
    $step = $r >= 1000000 ? 50000 : ($r >= 100000 ? 10000 : 1000);
    return round($r / $step) * $step;
}

function process_metrics(array $def, array $answers, int $workingDays): array
{
    $num = static function (string $id) use ($answers): array {
        $v = $answers[$id] ?? null;
        if (!is_array($v)) return ['value' => null, 'unit' => null, 'state' => null];
        if (isset($v['state'])) return ['value' => null, 'unit' => $v['unit'] ?? null, 'state' => $v['state']];
        return ['value' => isset($v['value']) ? (float) $v['value'] : null, 'unit' => $v['unit'] ?? null, 'state' => null];
    };
    $vol = ['day' => $workingDays, 'week' => 52, 'month' => 12, 'year' => 1];
    $rep = ['week' => 52, 'month' => 12, 'quarter' => 4, 'year' => 1];
    $f = $num($def['frequency']); $m = $num($def['minutes']); $r = $num($def['reporting']); $rate = $num($def['rate']);

    $annualVolume = ($f['value'] !== null && isset($vol[$f['unit']])) ? $f['value'] * $vol[$f['unit']] : null;
    $processing = ($annualVolume !== null && $m['value'] !== null) ? $annualVolume * $m['value'] / 60 : null;
    $reporting = null;
    if ($r['state'] === 'none') $reporting = 0.0;
    elseif ($r['value'] !== null && isset($rep[$r['unit']])) $reporting = $r['value'] * $rep[$r['unit']];

    $est = null;
    if ($processing !== null) $est = $processing + ($reporting ?? 0);
    elseif ($reporting !== null && $reporting > 0) $est = $reporting;
    $est = $est !== null ? round_hours($est) : null;
    $hourly = ($rate['value'] !== null && $rate['value'] > 0) ? $rate['value'] : null;

    $band = null;
    if ($est !== null) $band = $est < 100 ? 'Low' : ($est < 500 ? 'Moderate' : ($est < 2000 ? 'Significant' : 'Very significant'));
    return [
        'annual_volume' => $annualVolume !== null ? round($annualVolume) : null,
        'monthly_volume' => $annualVolume !== null ? round($annualVolume / 12) : null,
        'minutes_per_item' => $m['value'],
        'annual_processing_hours' => $processing !== null ? round_hours($processing) : null,
        'annual_reporting_hours' => $reporting !== null ? round_hours($reporting) : null,
        'estimated_admin_hours' => $est,
        'fte' => $est !== null ? round($est / 1800, 1) : null,
        'cost_low' => ($est !== null && $hourly !== null) ? round_money($est * $hourly * 0.8) : null,
        'cost_high' => ($est !== null && $hourly !== null) ? round_money($est * $hourly * 1.2) : null,
        'admin_load' => $band,
    ];
}

$metrics = [];
if (!empty($cfg['metrics'])) $metrics = process_metrics($cfg['metrics'], $answers, (int) ($schema['constants']['workingDays'] ?? 250));

/* ---- Flags, outcomes, findings (mirror of scoring.ts) ---------------------- */

$down = ['high' => 'medium', 'medium' => 'low', 'low' => 'low'];
$weight = ['high' => 3, 'medium' => 2, 'low' => 1];
$flags = [];
foreach ($cfg['flags'] as $def) {
    $ctx = ['answers' => $answers, 'metrics' => $metrics, 'flags' => $flags];
    $confirmed = null;
    if (cond_eval($def['when'], $ctx)) $confirmed = true;
    elseif (!empty($def['uncertainWhen']) && cond_eval($def['uncertainWhen'], $ctx)) $confirmed = false;
    if ($confirmed === null) continue;
    $sev = $def['severity'];
    if ($confirmed) {
        foreach ($def['severityWhen'] ?? [] as $sw) if (cond_eval($sw['when'], $ctx)) { $sev = $sw['severity']; break; }
    } else {
        $sev = $down[$sev];
    }
    $flags[$def['id']] = ['id' => $def['id'], 'label' => $def['label'], 'severity' => $sev, 'confirmed' => $confirmed, 'kind' => $def['kind'] ?? 'risk'];
}
$ctx = ['answers' => $answers, 'metrics' => $metrics, 'flags' => $flags];

$outcomes = [];
foreach ($cfg['outcomes'] ?? [] as $o) {
    foreach ($o['levels'] as $l) if (cond_eval($l['when'], $ctx)) { $outcomes[$o['id']] = $l; break; }
}

$findings = [];
foreach ($cfg['findings'] as $i => $f) {
    $hits = array_values(array_filter(array_map(static function ($id) use ($flags) { return $flags[$id] ?? null; }, $f['flags'])));
    if (!$hits) continue;
    $sev = 'low';
    $conf = false;
    foreach ($hits as $h) { if ($weight[$h['severity']] > $weight[$sev]) $sev = $h['severity']; if ($h['confirmed']) $conf = true; }
    $findings[] = $f + ['severity' => $sev, 'confirmed' => $conf, 'order' => $i, 'rank' => $weight[$sev] * ($conf ? 2 : 1)];
}
$risks = array_values(array_filter($findings, static function ($f) { return $f['kind'] !== 'opportunity'; }));
usort($risks, static function ($a, $b) { return ($b['rank'] <=> $a['rank']) ?: ($a['order'] <=> $b['order']); });
$priorities = array_slice($risks, 0, 3);
$opportunities = array_values(array_filter($findings, static function ($f) { return $f['kind'] === 'opportunity'; }));

// Cross-check what the browser calculated (informational only: server values win).
$clientFlags = [];
foreach ((array) ($in['result']['flags'] ?? []) as $cf) if (is_array($cf) && isset($cf['id']) && is_string($cf['id'])) $clientFlags[] = $cf['id'];
$serverFlags = array_keys($flags);
sort($clientFlags);
sort($serverFlags);
$mismatch = $clientFlags !== $serverFlags;
$clientHours = $in['process']['estimated_admin_hours'] ?? null;
if (!empty($cfg['metrics']) && $clientHours !== ($metrics['estimated_admin_hours'] ?? null)
    && !(is_numeric($clientHours) && (float) $clientHours === (float) ($metrics['estimated_admin_hours'] ?? -1))) {
    $mismatch = true;
}

/* ---- Internal lead qualification (never shown to the respondent) ----------- */

$highConfirmed = count(array_filter($flags, static function ($f) { return $f['kind'] === 'risk' && $f['confirmed'] && $f['severity'] === 'high'; }));
$largeOrg = in_array($contact['org_size'], ['201_500', '501_1000', '1001_plus'], true);
$midOrg = $largeOrg || $contact['org_size'] === '51_200';
$opportunity = $outcomes['opportunity']['label'] ?? null;
$relevance = 'Low';
if (($largeOrg && ($highConfirmed >= 2 || ($outcomes['opportunity']['value'] ?? '') === 'high')) || $highConfirmed >= 4) $relevance = 'High';
elseif ($midOrg || $highConfirmed >= 1) $relevance = 'Medium';

/* -------------------------------------------------------------------------- */
/* Compose                                                                     */
/* -------------------------------------------------------------------------- */

$labelOf = static function (array $opts, string $v): string {
    foreach ($opts as $o) if ($o['value'] === $v) return $o['label'];
    return $v;
};
$answerLabel = static function (array $q, $v) use ($questions, $labelOf): string {
    if ($q['type'] === 'text') return (string) $v;
    if ($q['type'] === 'number') {
        if (isset($v['state'])) return $v['state'] === 'none' ? 'None' : 'Not sure';
        $s = isset($v['value']) ? rtrim(rtrim(number_format((float) $v['value'], 2, '.', ' '), '0'), '.') : '?';
        return $s . (isset($v['unit']) ? ' per ' . $v['unit'] : '');
    }
    $opts = allowed_options($q, $questions);
    return implode('; ', array_map(static function ($x) use ($opts, $labelOf) { return $labelOf($opts, $x); }, (array) $v));
};
$fmt = static function ($n): string { return $n === null ? '-' : number_format((float) $n, 0, '.', ' '); };

$ref = 'LD-' . gmdate('ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
$processName = $diagId === 'process' && !empty($cfg['metrics'])
    ? ($answers[$cfg['metrics']['processName']] ?? ($answers[$cfg['metrics']['processType']] ?? ''))
    : '';
if ($processName !== '' && isset($questions['a2_2']) && $processName === ($answers['a2_2'] ?? null)) {
    $processName = $answerLabel($questions['a2_2'], $processName);
}

$attr = is_array($in['attribution'] ?? null) ? $in['attribution'] : [];
$attribution = [];
foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'referrer', 'landing'] as $k) {
    $v = clean($attr[$k] ?? '', 300);
    if ($v !== '') $attribution[$k] = $v;
}
$page = clean($in['page'] ?? '', 120);

$lines = [];
$lines[] = 'New diagnostic lead from lumko.cloud';
$lines[] = str_repeat('=', 48);
$lines[] = 'Reference:        ' . $ref;
$lines[] = 'Diagnostic:       ' . $cfg['title'] . ' (v' . $cfg['version'] . ')';
$lines[] = 'Received:         ' . gmdate('Y-m-d H:i') . ' UTC';
$lines[] = '';
$lines[] = 'LEAD SUMMARY (internal)';
$lines[] = str_repeat('-', 48);
$lines[] = 'Project relevance: ' . $relevance;
if ($opportunity) $lines[] = 'Opportunity:       ' . $opportunity;
$lines[] = 'High-severity:     ' . $highConfirmed . ' confirmed';
$lines[] = 'Top finding:       ' . ($priorities[0]['title'] ?? '-');
$lines[] = 'Organisation size: ' . $labelOf($schema['lead']['org_size'], $contact['org_size']);
$lines[] = 'Sector:            ' . $labelOf($schema['lead']['industry'], $contact['industry']);
$lines[] = 'Contact requested: yes (consented)';
$lines[] = 'Marketing opt-in:  ' . ($consent['marketing'] ? 'yes' : 'no');
$lines[] = '';
$lines[] = 'CONTACT';
$lines[] = str_repeat('-', 48);
$lines[] = 'Name:              ' . $contact['name'];
$lines[] = 'Role:              ' . $contact['role'];
$lines[] = 'Organisation:      ' . $contact['organisation'];
$lines[] = 'Organisation type: ' . $labelOf($schema['lead']['org_type'], $contact['org_type']);
$lines[] = 'Email:             ' . $contact['email'];
$lines[] = 'Phone:             ' . ($contact['phone'] !== '' ? $contact['phone'] : '-');
$lines[] = 'Province/country:  ' . ($contact['region'] !== '' ? $contact['region'] : '-');
$lines[] = '';
$lines[] = 'RESULT (recalculated on the server)';
$lines[] = str_repeat('-', 48);
if ($endedEarly) $lines[] = 'Ended early: no manual process identified.';
foreach ($priorities as $i => $p) {
    $lines[] = sprintf('Priority %d:        %s [%s%s]', $i + 1, $p['title'], $p['severity'], $p['confirmed'] ? '' : ', uncertain');
    $lines[] = '                   Capability: ' . $p['capability'] . ' (' . $p['service'] . ')';
}
foreach (array_slice($risks, 3) as $p) $lines[] = 'Also noted:        ' . $p['title'] . ' [' . $p['severity'] . ($p['confirmed'] ? '' : ', uncertain') . ']';
foreach ($opportunities as $p) $lines[] = 'Opportunity:       ' . $p['title'];
foreach ($outcomes as $id => $o) $lines[] = str_pad(ucfirst(str_replace('_', ' ', $id)) . ':', 19) . $o['label'];
if ($mismatch) $lines[] = 'Note: the browser result differed from the server recalculation; server values are shown.';
if ($dropped) $lines[] = 'Note: ' . $dropped . ' answer(s) were outside the schema or on a hidden branch and were ignored.';

if ($diagId === 'process' && $metrics) {
    $lines[] = '';
    $lines[] = 'PROCESS METRICS';
    $lines[] = str_repeat('-', 48);
    $lines[] = 'Process:           ' . ($processName !== '' ? $processName : '-');
    $lines[] = 'Annual volume:     ' . $fmt($metrics['annual_volume']) . ' (monthly ~' . $fmt($metrics['monthly_volume']) . ')';
    $lines[] = 'Processing hours:  ' . $fmt($metrics['annual_processing_hours']) . ' a year';
    $lines[] = 'Reporting hours:   ' . $fmt($metrics['annual_reporting_hours']) . ' a year';
    $lines[] = 'Est. admin hours:  ' . $fmt($metrics['estimated_admin_hours']) . ' a year (' . ($metrics['admin_load'] ?? '-') . ')';
    if ($metrics['cost_low'] !== null) $lines[] = 'Indicative cost:   R' . $fmt($metrics['cost_low']) . ' to R' . $fmt($metrics['cost_high']) . ' a year (respondent rate)';
}

$lines[] = '';
$lines[] = 'ANSWERS';
$lines[] = str_repeat('-', 48);
foreach ($cfg['steps'] as $s) {
    foreach ($s['questions'] as $q) {
        if (!array_key_exists($q['id'], $answers)) continue;
        $lines[] = '- ' . $q['short'] . ': ' . $answerLabel($q, $answers[$q['id']]);
    }
}
$lines[] = '';
$lines[] = 'SOURCE';
$lines[] = str_repeat('-', 48);
$lines[] = 'Page:              ' . ($page !== '' ? $page : '-');
foreach ($attribution as $k => $v) $lines[] = str_pad($k . ':', 19) . $v;
$lines[] = '';
$lines[] = 'A machine-readable copy is attached (' . $ref . '.json).';
$body = implode("\n", $lines);

$record = [
    'ref' => $ref,
    'received_at' => gmdate('c'),
    'diagnostic' => ['id' => $diagId, 'version' => (int) $cfg['version']],
    'contact' => $contact,
    'consent' => $consent,
    'qualification' => ['relevance' => $relevance, 'high_confirmed' => $highConfirmed, 'opportunity' => $outcomes['opportunity']['value'] ?? null],
    'answers' => $answers,
    'flags' => array_values($flags),
    'outcomes' => array_map(static function ($o) { return $o['value']; }, $outcomes),
    'priorities' => array_map(static function ($p) { return ['id' => $p['id'], 'title' => $p['title'], 'severity' => $p['severity'], 'confirmed' => $p['confirmed'], 'service' => $p['service']]; }, $priorities),
    'findings' => array_map(static function ($p) { return ['id' => $p['id'], 'severity' => $p['severity'], 'confirmed' => $p['confirmed']]; }, $findings),
    'metrics' => $metrics,
    'process' => $diagId === 'process' ? ['name' => $processName, 'type' => $answers['a2_2'] ?? null] : null,
    'ended_early' => $endedEarly,
    'client_mismatch' => $mismatch,
    'page' => $page,
    'attribution' => $attribution,
];
$json = (string) json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

/** Optional hand-off to a CRM or lead store. No-op unless configured. */
function forward_to_crm(string $json): void
{
    $url = getenv('LUMKO_CRM_WEBHOOK');
    if (!$url || !preg_match('#^https://#i', $url)) return;
    $ctx = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n",
        'content' => $json,
        'timeout' => 5,
        'ignore_errors' => true,
    ]]);
    @file_get_contents($url, false, $ctx);
}

// ---- Multipart email: readable text + JSON attachment ----------------------
$subject = 'Diagnostic lead: ' . one_line($contact['organisation']) . ' (' . $cfg['title'] . ')';
$boundary = 'lumko-' . bin2hex(random_bytes(8));
$headers = [
    'From: ' . FROM_NAME . ' <' . FROM_ADDRESS . '>',
    'Reply-To: "' . str_replace(['"', '\\'], '', one_line($contact['name'])) . '" <' . one_line($contact['email']) . '>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="' . $boundary . '"',
    'X-Mailer: lumko-diagnostic',
];
$message = implode("\r\n", [
    '--' . $boundary,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    $body,
    '',
    '--' . $boundary,
    'Content-Type: application/json; charset=UTF-8; name="' . $ref . '.json"',
    'Content-Disposition: attachment; filename="' . $ref . '.json"',
    'Content-Transfer-Encoding: base64',
    '',
    chunk_split(base64_encode($json)),
    '--' . $boundary . '--',
    '',
]);
$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

if (getenv('LUMKO_CONTACT_DRYRUN')) {
    $sent = (bool) file_put_contents(
        sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'lumko-diagnostic-last.txt',
        "To: " . TO_ADDRESS . "\nSubject: $subject\n" . implode("\n", $headers) . "\n\n" . $body . "\n\n--- JSON ---\n" . $json
    );
} else {
    $sent = @mail(TO_ADDRESS, $encodedSubject, $message, implode("\r\n", $headers), '-f' . FROM_ADDRESS);
}

if (!$sent) respond(502, ['ok' => false, 'error' => 'send']);

forward_to_crm($json);
$hits[] = $now;
@file_put_contents($rateFile, json_encode($hits), LOCK_EX);

respond(200, ['ok' => true, 'ref' => $ref]);
