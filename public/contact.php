<?php
/**
 * Lumko website — contact form handler.
 *
 * Receives POSTs from /contact (src/components/ContactForm.astro), validates
 * them, filters obvious bots, and emails the enquiry to Lumko.
 *
 *   success          -> 303 /thank-you
 *   invalid fields   -> 303 /contact?error=fields&fields=name,email#form
 *   mail() failure   -> 303 /contact?error=send#form
 *   rate limited     -> 303 /contact?error=limit#form
 *
 * Deliverability depends on the host's mail configuration (sendmail / SMTP
 * relay for the lumko.cloud domain). Test once after deploying.
 *
 * Local testing: set LUMKO_CONTACT_DRYRUN=1 to write the message to the
 * system temp directory instead of sending it.
 */

declare(strict_types=1);

const TO_ADDRESS   = 'info@lumko.cloud';
const FROM_ADDRESS = 'website@lumko.cloud';
const FROM_NAME    = 'Lumko website';
const MIN_SECONDS  = 3;      // faster than this is almost certainly a bot
const RATE_LIMIT   = 5;      // submissions per IP ...
const RATE_WINDOW  = 3600;   // ... per hour

const INTERESTS = [
    'Software & Systems',
    'Infrastructure & ICT',
    'Data & Intelligence',
    'Integrated Technology',
    'Technology Consulting',
    'Website or online store',
    'Not sure yet',
];
const EXPERTISE = [
    'Software engineering',
    'Infrastructure',
    'Data & analytics',
    'Cloud',
    'Cybersecurity',
    'Networks',
    'Hardware & IoT',
    'Telecommunications',
    'Consulting',
];
const PREFS = ['Email', 'Phone', 'WhatsApp'];

function go(string $path): void
{
    header('Location: ' . $path, true, 303);
    header('Cache-Control: no-store');
    exit;
}

/** Trim, drop control characters (keeps newlines only where allowed), cap length. */
function clean(?string $v, int $max, bool $multiline = false): string
{
    $v = (string) ($v ?? '');
    $v = $multiline
        ? preg_replace('/[^\P{C}\n\t]/u', '', str_replace("\r\n", "\n", $v))
        : preg_replace('/\p{C}/u', '', $v);
    $v = trim((string) $v);
    return mb_substr($v, 0, $max);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    go('/contact');
}

// ---- Bot filtering (silent: bots are shown the success page) -------------
if (!empty($_POST['website'])) {
    go('/thank-you');
}
$ts = (int) ($_POST['ts'] ?? 0);
if ($ts > 0 && (time() - $ts) < MIN_SECONDS) {
    go('/thank-you');
}

// Enquiry type: a project enquiry, or an ICT professional applying to join the
// Lumko network. Carried through redirects so the form reopens in the same mode.
$type = ($_POST['enquiry_type'] ?? '') === 'network' ? 'network' : 'project';
$typeQuery = $type === 'network' ? 'type=network&' : '';

// ---- Rate limit per IP ----------------------------------------------------
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'lumko-contact-' . hash('sha256', $ip) . '.json';
$now = time();
$hits = [];
if (is_file($rateFile)) {
    $hits = array_filter(
        (array) json_decode((string) @file_get_contents($rateFile), true),
        static fn ($t) => is_int($t) && ($now - $t) < RATE_WINDOW
    );
}
if (count($hits) >= RATE_LIMIT) {
    go('/contact?' . $typeQuery . 'error=limit#form');
}

// ---- Validate ---------------------------------------------------------------
$name         = clean($_POST['name'] ?? null, 120);
$organisation = clean($_POST['organisation'] ?? null, 160);
$email        = clean($_POST['email'] ?? null, 254);
$phone        = clean($_POST['phone'] ?? null, 40);
$role         = clean($_POST['role'] ?? null, 120);
$interest     = clean($_POST['interest'] ?? null, 60);
$expertise    = clean($_POST['expertise'] ?? null, 60);
$profileUrl   = clean($_POST['profile_url'] ?? null, 300);
$message      = clean($_POST['message'] ?? null, 5000, true);
$pref         = clean($_POST['contact_pref'] ?? null, 20);
$consent      = ($_POST['consent'] ?? '') === 'yes';

$bad = [];
if (mb_strlen($name) < 2)                              $bad[] = 'name';
if ($type === 'project' && mb_strlen($organisation) < 2) $bad[] = 'organisation';
if ($profileUrl !== '' && (!filter_var($profileUrl, FILTER_VALIDATE_URL) || !preg_match('#^https?://#i', $profileUrl))) {
    $bad[] = 'profile_url';
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL))        $bad[] = 'email';
if (mb_strlen($message) < 10)                          $bad[] = 'message';
if (!$consent)                                         $bad[] = 'consent';
if ($interest !== '' && !in_array($interest, INTERESTS, true)) $interest = '';
if ($expertise !== '' && !in_array($expertise, EXPERTISE, true)) $expertise = '';
if (!in_array($pref, PREFS, true))                     $pref = 'Email';

if ($bad) {
    go('/contact?' . $typeQuery . 'error=fields&fields=' . rawurlencode(implode(',', $bad)) . '#form');
}

// ---- Compose ----------------------------------------------------------------
// Header-bound values must never contain line breaks (header injection).
$oneLine = static fn (string $s): string => str_replace(["\r", "\n"], ' ', $s);

$isNetwork = $type === 'network';
$subject = $isNetwork
    ? 'Network application: ' . $oneLine($name)
    : 'Website enquiry: ' . $oneLine($organisation);
$body = implode("\n", [
    $isNetwork ? 'New Lumko network application from lumko.cloud' : 'New enquiry from lumko.cloud',
    str_repeat('-', 40),
    'Type:          ' . ($isNetwork ? 'Joining the Lumko network' : 'Project or problem'),
    'Name:          ' . $name,
    ($isNetwork ? 'Company:       ' : 'Organisation:  ') . ($organisation !== '' ? $organisation : '-'),
    'Role:          ' . ($role !== '' ? $role : '-'),
    'Email:         ' . $email,
    'Phone:         ' . ($phone !== '' ? $phone : '-'),
    $isNetwork
        ? 'Expertise:     ' . ($expertise !== '' ? $expertise : '-')
        : 'About:         ' . ($interest !== '' ? $interest : '-'),
    ...($isNetwork ? ['Profile:       ' . ($profileUrl !== '' ? $profileUrl : '-')] : []),
    'Reply by:      ' . $pref,
    'Consent:       yes (privacy notice)',
    '',
    'Message:',
    $message,
    '',
    str_repeat('-', 40),
    'Sent ' . gmdate('Y-m-d H:i') . ' UTC',
]);

$headers = [
    'From: ' . FROM_NAME . ' <' . FROM_ADDRESS . '>',
    'Reply-To: "' . str_replace(['"', '\\'], '', $oneLine($name)) . '" <' . $oneLine($email) . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'X-Mailer: lumko-contact',
];

$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';

if (getenv('LUMKO_CONTACT_DRYRUN')) {
    $sent = (bool) file_put_contents(
        sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'lumko-contact-last.txt',
        "To: " . TO_ADDRESS . "\nSubject: $subject\n" . implode("\n", $headers) . "\n\n" . $body
    );
} else {
    $sent = @mail(TO_ADDRESS, $encodedSubject, $body, implode("\r\n", $headers), '-f' . FROM_ADDRESS);
}

if (!$sent) {
    go('/contact?' . $typeQuery . 'error=send#form');
}

$hits[] = $now;
@file_put_contents($rateFile, json_encode(array_values($hits)), LOCK_EX);

go($isNetwork ? '/thank-you?type=network' : '/thank-you');
