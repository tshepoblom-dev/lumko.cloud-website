<?php
/**
 * Dev-only router for testing the static build with PHP's built-in server,
 * mimicking the clean-URL rules in public/.htaccess. Pass an absolute path.
 *
 *   npm run build
 *   LUMKO_CONTACT_DRYRUN=1 php -S localhost:8090 -t dist "$PWD/scripts/test-server.php"
 */
$uri = urldecode((string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$root = rtrim($_SERVER['DOCUMENT_ROOT'], '/' . DIRECTORY_SEPARATOR);
if ($uri === '/' || is_file($root . $uri)) return false;
if (is_file($root . $uri . '.html')) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($root . $uri . '.html');
    return true;
}
http_response_code(404);
header('Content-Type: text/html; charset=utf-8');
readfile($root . '/404.html');
return true;
