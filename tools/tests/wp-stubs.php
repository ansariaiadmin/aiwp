<?php
/**
 * Minimal WordPress function stubs, enough to load and drive a composed
 * plugin module outside WordPress.
 *
 * The point is to exercise the *real* generated code (modules/license-client
 * and its composed output) rather than a re-implementation of it. Only the
 * WordPress API surface is faked.
 *
 * Networking cannot work inside the WebAssembly PHP build (curl fails with
 * "Socket not connected"), so wp_remote_post() operates in two modes driven
 * by the AIWP_WP_FIXTURE environment variable:
 *
 *   record — capture every request the plugin builds and return a sentinel.
 *            The Node harness then performs those requests for real.
 *   replay — hand back the real responses the harness captured, so the
 *            plugin's own response-parsing code runs on real data.
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    define('ABSPATH', '/tmp/aiwp-wp/');
}
if (!defined('DAY_IN_SECONDS')) {
    define('DAY_IN_SECONDS', 86400);
}
if (!defined('HOUR_IN_SECONDS')) {
    define('HOUR_IN_SECONDS', 3600);
}

/** In-memory stand-in for the wp_options table. */
$GLOBALS['aiwp_options']    = [];
/** Registered hooks, so tests can assert what the module wired up. */
$GLOBALS['aiwp_hooks']      = [];
/** Recorded outbound requests (record mode). */
$GLOBALS['aiwp_requests']   = [];
/**
 * Queued real responses (replay mode), loaded from the JSON file named by
 * AIWP_WP_RESPONSES. The Node harness fills it by performing the recorded
 * requests against a live platform.
 */
$GLOBALS['aiwp_responses']  = (static function (): array {
    $path = getenv('AIWP_WP_RESPONSES');
    if (!$path || !is_file($path)) {
        return [];
    }
    $decoded = json_decode((string) file_get_contents($path), true);
    return is_array($decoded) ? $decoded : [];
})();
/** Which queued response comes next. */
$GLOBALS['aiwp_replay_idx'] = 0;

function aiwp_fixture_mode(): string
{
    return getenv('AIWP_WP_FIXTURE') ?: 'record';
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
function add_action(string $hook, callable|array|string $cb, int $priority = 10, int $args = 1): bool
{
    $GLOBALS['aiwp_hooks'][$hook][] = $cb;
    return true;
}

function add_filter(string $hook, callable|array|string $cb, int $priority = 10, int $args = 1): bool
{
    return add_action($hook, $cb, $priority, $args);
}

function has_action(string $hook): bool
{
    return !empty($GLOBALS['aiwp_hooks'][$hook]);
}

function do_action(string $hook, mixed ...$args): void
{
    foreach ($GLOBALS['aiwp_hooks'][$hook] ?? [] as $cb) {
        if (is_callable($cb)) {
            $cb(...$args);
        }
    }
}

function apply_filters(string $hook, mixed $value, mixed ...$args): mixed
{
    foreach ($GLOBALS['aiwp_hooks'][$hook] ?? [] as $cb) {
        if (is_callable($cb)) {
            $value = $cb($value, ...$args);
        }
    }
    return $value;
}

function did_action(string $hook): int
{
    return isset($GLOBALS['aiwp_hooks'][$hook]) ? count($GLOBALS['aiwp_hooks'][$hook]) : 0;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
function get_option(string $key, mixed $default = false): mixed
{
    return $GLOBALS['aiwp_options'][$key] ?? $default;
}

function update_option(string $key, mixed $value): bool
{
    $GLOBALS['aiwp_options'][$key] = $value;
    return true;
}

function delete_option(string $key): bool
{
    unset($GLOBALS['aiwp_options'][$key]);
    return true;
}

// ---------------------------------------------------------------------------
// Transients
// ---------------------------------------------------------------------------
function set_transient(string $key, mixed $value, int $ttl = 0): bool
{
    $GLOBALS['aiwp_options']['_transient_' . $key] = $value;
    return true;
}

function get_transient(string $key): mixed
{
    return $GLOBALS['aiwp_options']['_transient_' . $key] ?? false;
}

function delete_transient(string $key): bool
{
    unset($GLOBALS['aiwp_options']['_transient_' . $key]);
    return true;
}

function set_site_transient(string $key, mixed $value, int $ttl = 0): bool
{
    return set_transient($key, $value, $ttl);
}

function get_site_transient(string $key): mixed
{
    return get_transient($key);
}

function delete_site_transient(string $key): bool
{
    return delete_transient($key);
}

// ---------------------------------------------------------------------------
// URLs and escaping
// ---------------------------------------------------------------------------
function home_url(string $path = ''): string
{
    return rtrim(getenv('AIWP_WP_SITE_URL') ?: 'https://customer-shop.test', '/') . $path;
}

function admin_url(string $path = ''): string
{
    return home_url('/wp-admin/' . $path);
}

function site_url(string $path = ''): string
{
    return home_url($path);
}

function plugins_url(string $path = '', string $plugin = ''): string
{
    return home_url('/wp-content/plugins/' . ltrim($path, '/'));
}

function plugin_dir_path(string $file): string
{
    return dirname($file) . '/';
}

function trailingslashit(string $value): string
{
    return rtrim($value, '/\\') . '/';
}

function esc_url_raw(string $url): string
{
    return filter_var($url, FILTER_SANITIZE_URL) ?: '';
}

function esc_html(string $text): string
{
    return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
}

function esc_attr(string $text): string
{
    return htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
}

function wp_kses_post(string $data): string
{
    return $data;
}

/**
 * Minimal faithful-enough wp_kses for the tests: strips every tag not in
 * the allowed whitelist (dropping all its attributes) and leaves text and
 * encoded entities untouched. Enough to verify the guided-help markup
 * sanitizer without pulling in WordPress core's full KSES engine.
 */
function wp_kses(string $string, array $allowed_html): string
{
    $allowed_tags = strtolower(implode('|', array_keys($allowed_html)));

    if ('' === $allowed_tags) {
        return strip_tags($string);
    }

    // Replace <tag ...> with <tag> for allowed tags, drop everything else.
    $string = preg_replace_callback(
        '/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/',
        static function (array $m) use ($allowed_tags): string {
            $tag = strtolower($m[1]);

            if (!preg_match('/\b' . preg_quote($tag, '/') . '\b/', $allowed_tags)) {
                return '';
            }

            return str_starts_with($m[0], '</') ? '</' . $tag . '>' : '<' . $tag . '>';
        },
        $string
    ) ?? '';

    return $string;
}

function wp_unslash(mixed $value): mixed
{
    return is_string($value) ? stripslashes($value) : $value;
}

function sanitize_text_field(string $str): string
{
    return trim(strip_tags($str));
}

function sanitize_key(string $key): string
{
    return strtolower(preg_replace('/[^a-z0-9_\-]/i', '', $key) ?? '');
}

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------
function __(string $text, string $domain = 'default'): string
{
    return $text;
}

function _e(string $text, string $domain = 'default'): void
{
    echo $text;
}

function esc_html__(string $text, string $domain = 'default'): string
{
    return esc_html($text);
}

// ---------------------------------------------------------------------------
// Users and nonces
// ---------------------------------------------------------------------------
function current_user_can(string $capability): bool
{
    return true;
}

function wp_verify_nonce(string $nonce, string $action = '-1'): bool|int
{
    return 1;
}

function wp_nonce_field(string $action = '-1', string $name = '_wpnonce', bool $referer = true, bool $display = true): string
{
    $html = '<input type="hidden" name="' . $name . '" value="stub" />';
    if ($display) {
        echo $html;
    }
    return $html;
}

function check_admin_referer(string $action = '-1', string $query_arg = '_wpnonce'): bool
{
    return true;
}

/**
 * Thrown by wp_safe_redirect() so tests survive the `exit;` that generated
 * handlers run immediately after redirecting — which is correct WordPress
 * behaviour but would otherwise terminate the test process.
 */
final class AIWP_Redirect extends RuntimeException
{
    public function __construct(public readonly string $location)
    {
        parent::__construct('redirect to ' . $location);
    }
}

function wp_safe_redirect(string $location, int $status = 302): bool
{
    $GLOBALS['aiwp_redirect'] = $location;

    if ('replay' === aiwp_fixture_mode() || 'record' === aiwp_fixture_mode()) {
        throw new AIWP_Redirect($location);
    }

    return true;
}

/**
 * Mirrors the real signature: wp_die( $message = '', $title = '', $args = array() )
 * where $message may be a string or WP_Error and $title a string or an HTTP
 * status code. The generated Guard calls it as wp_die( $text, 403 ).
 */
function wp_die(mixed $message = '', mixed $title = '', mixed $args = []): void
{
    $text = is_string($message) ? $message : (is_object($message) && method_exists($message, 'get_error_message') ? $message->get_error_message() : '');
    throw new RuntimeException('wp_die: ' . $text . (is_int($title) ? " (HTTP {$title})" : ''));
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
final class AIWP_WP_Error
{
    public function __construct(private string $code, private string $message) {}

    public function get_error_code(): string
    {
        return $this->code;
    }

    public function get_error_message(): string
    {
        return $this->message;
    }
}

function is_wp_error(mixed $thing): bool
{
    return $thing instanceof AIWP_WP_Error;
}

// ---------------------------------------------------------------------------
// HTTP — record/replay
// ---------------------------------------------------------------------------

/**
 * Mirrors wp_remote_post()'s contract closely enough for the license client:
 * returns an array with 'body'/'response', or a WP_Error on failure.
 */
function wp_remote_post(string $url, array $args = []): array|AIWP_WP_Error
{
    $body = $args['body'] ?? [];

    $GLOBALS['aiwp_requests'][] = [
        'url'     => $url,
        'method'  => 'POST',
        'body'    => $body,
        'timeout' => $args['timeout'] ?? 5,
    ];

    if ('replay' === aiwp_fixture_mode()) {
        $idx      = $GLOBALS['aiwp_replay_idx']++;
        $queued   = $GLOBALS['aiwp_responses'][$idx] ?? null;

        if (null === $queued) {
            return new AIWP_WP_Error('http_request_failed', 'no replayed response for request #' . $idx);
        }

        if (!empty($queued['error'])) {
            return new AIWP_WP_Error('http_request_failed', (string) $queued['error']);
        }

        return [
            'body'     => (string) ($queued['body'] ?? ''),
            'response' => ['code' => (int) ($queued['status'] ?? 200)],
        ];
    }

    // Record mode: the harness has not fetched anything yet.
    return [
        'body'     => json_encode(['success' => true, '__recorded' => true]),
        'response' => ['code' => 200],
    ];
}

function wp_remote_get(string $url, array $args = []): array|AIWP_WP_Error
{
    return wp_remote_post($url, $args);
}

function wp_remote_retrieve_body(array|AIWP_WP_Error $response): string
{
    if (is_wp_error($response)) {
        return '';
    }
    return (string) ($response['body'] ?? '');
}

function wp_remote_retrieve_response_code(array|AIWP_WP_Error $response): int
{
    if (is_wp_error($response)) {
        return 500;
    }
    return (int) ($response['response']['code'] ?? 0);
}

// ---------------------------------------------------------------------------
// URLs and misc
// ---------------------------------------------------------------------------
function add_query_arg(mixed ...$args): string
{
    // Supports add_query_arg( $kv, $url ) and add_query_arg( $k, $v, $url ).
    if (is_array($args[0] ?? null)) {
        $kv  = $args[0];
        $url = (string) ($args[1] ?? home_url());
    } else {
        $kv  = [$args[0] => $args[1] ?? ''];
        $url = (string) ($args[2] ?? home_url());
    }

    $parts = parse_url($url);
    $query = [];
    if (isset($parts['query'])) {
        parse_str($parts['query'], $query);
    }
    $query = array_merge($query, $kv);

    $base = ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? 'localhost');
    $base .= $parts['path'] ?? '';

    return $base . '?' . http_build_query($query);
}

function remove_query_arg(mixed $key, string $url = ''): string
{
    $url   = '' === $url ? home_url() : $url;
    $parts = parse_url($url);
    $query = [];
    if (isset($parts['query'])) {
        parse_str($parts['query'], $query);
    }
    foreach ((array) $key as $k) {
        unset($query[$k]);
    }

    $base = ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? 'localhost');
    $base .= $parts['path'] ?? '';

    return $base . ($query ? '?' . http_build_query($query) : '');
}

function wp_parse_url(string $url, int $component = -1): mixed
{
    return parse_url($url, $component);
}

function wp_json_encode(mixed $data, int $options = 0, int $depth = 512): string|false
{
    return json_encode($data, $options, $depth);
}

function absint(mixed $value): int
{
    return abs((int) $value);
}

function wp_strip_all_tags(string $text, bool $remove_breaks = false): string
{
    $text = strip_tags($text);
    return $remove_breaks ? preg_replace('/[\r\n\s]+/', ' ', $text) : $text;
}

function number_format_i18n(float $number, int $decimals = 0): string
{
    return number_format($number, $decimals);
}

function size_format(int|float $bytes, int $decimals = 0): string
{
    return (string) $bytes;
}

function human_time_diff(int $from, int $to = 0): string
{
    $to   = $to ?: time();
    $diff = abs($to - $from);
    return $diff < 60 ? "{$diff} secs" : round($diff / 60) . ' mins';
}

// ---------------------------------------------------------------------------
// Cron
// ---------------------------------------------------------------------------
function wp_next_scheduled(string $hook): bool|int
{
    return false;
}

function wp_schedule_event(int $timestamp, string $recurrence, string $hook): bool
{
    return true;
}

function wp_unschedule_event(int $timestamp, string $hook): bool
{
    return true;
}

function wp_clear_scheduled_hook(string $hook): int
{
    return 0;
}
