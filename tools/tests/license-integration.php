<?php
/**
 * Drives the *composed* plugin's LicenseClient against WordPress stubs.
 *
 * This is the plugin half of the platform<->plugin contract test. It loads
 * the real generated code from build/<slug>/ (placeholders already
 * substituted by tools/compose.php) and runs the code paths that talk to the
 * license server:
 *
 *   handle_activate()  -> POST {server}/license/activate
 *   revalidate()       -> POST {server}/license/validate
 *   inject_update()    -> POST {server}/license/update-check
 *   plugin_information -> POST {server}/license/info
 *
 * The WebAssembly PHP build has no outbound networking, so wp_remote_post()
 * records the request instead of sending it. The Node harness
 * (tools/php-wasm/license-integration.mjs) then performs those requests
 * against a live platform and re-runs this script in replay mode, so the
 * plugin's own response parsing executes on real server data.
 *
 * Output is a single JSON document on stdout:
 *   { "assertions": [...], "requests": [...], "outcomes": {...} }
 */

declare(strict_types=1);

require_once __DIR__ . '/wp-stubs.php';

$buildDir = $argv[1] ?? '';
$licenseKey = $argv[2] ?? '';

if ('' === $buildDir || !is_dir($buildDir)) {
    fwrite(STDERR, "usage: php license-integration.php <build-dir> <license-key>\n");
    exit(2);
}

$autoload = $buildDir . '/src/autoload.php';
if (!is_file($autoload)) {
    fwrite(STDERR, "no composed plugin at {$buildDir} — run tools/build.php first\n");
    exit(2);
}

require_once $autoload;

// The main plugin file defines the constants every module reads
// (<PREFIX>_VERSION, <PREFIX>_FILE, ...). Loading that file would run the
// whole bootstrap, so lift just the define() pairs out of it. The prefix is
// per-plugin, so it is read rather than hardcoded.
$mainFile = glob($buildDir . '/*.php');
foreach ($mainFile ?: [] as $candidate) {
    if ('uninstall.php' === basename($candidate)) {
        continue;
    }
    $source = (string) file_get_contents($candidate);
    if (!preg_match_all("/define\\(\\s*'([A-Z0-9_]+)'\\s*,\\s*'([^']*)'\\s*\\)/", $source, $m, PREG_SET_ORDER)) {
        continue;
    }
    foreach ($m as $pair) {
        if (!defined($pair[1])) {
            $value = match ($pair[1]) {
                default => str_contains($pair[2], '__FILE__') ? $candidate : $pair[2],
            };
            define($pair[1], '' !== $pair[2] ? $pair[2] : $candidate);
        }
    }
    break;
}

$assertions = [];

function check(string $name, bool $ok, string $detail = ''): void
{
    global $assertions;
    $assertions[] = ['name' => $name, 'ok' => $ok, 'detail' => $detail];
}

// Resolve the composed classes by suffix, so this test does not hardcode the
// namespace that happens to be in the example spec.
$classFor = static function (string $suffix): ?string {
    foreach (get_declared_classes() as $class) {
        if (str_ends_with($class, '\\' . $suffix)) {
            return $class;
        }
    }
    return null;
};

require_once $autoload; // already loaded; ensure classes are declared

$licenseClientClass = null;
$settingsClass      = null;

foreach (spl_autoload_functions() ?: [] as $fn) {
    // Trigger the autoloader by touching the manifest, which maps every class.
}

// The manifest is a generated class holding a MODULE_CLASSES constant, not a
// returned array. Its namespace is the plugin's, so resolve the class name by
// reading the constant off whichever declared class exposes it.
$manifestPath = $buildDir . '/src/module-manifest.php';
if (is_file($manifestPath)) {
    $before = get_declared_classes();
    require_once $manifestPath;
    $added = array_diff(get_declared_classes(), $before);

    foreach ($added as $class) {
        if (!defined($class . '::MODULE_CLASSES')) {
            continue;
        }
        $map = constant($class . '::MODULE_CLASSES');
        if (is_array($map) && isset($map['license-client'])) {
            $licenseClientClass = $map['license-client'];
            break;
        }
    }
}

if (null === $licenseClientClass) {
    fwrite(STDERR, "could not resolve the LicenseClient class from the manifest\n");
    exit(2);
}

class_exists($licenseClientClass);

// Resolve the Settings class by walking up from the module's namespace and
// asking the composed autoloader whether such a class exists. The generated
// autoloader is a closure with an inline classmap, so the map itself cannot
// be read — but class_exists() triggers it, which is all we need.
$settingsClass = null;
$probe         = $licenseClientClass;

while (false !== ($pos = strrpos($probe, '\\'))) {
    $probe     = substr($probe, 0, $pos);
    $candidate = $probe . '\\Settings';

    if (class_exists($candidate)) {
        $settingsClass = $candidate;
        break;
    }
}

if (null === $settingsClass) {
    fwrite(STDERR, "could not resolve the Settings class\n");
    exit(2);
}

// The Settings option group is namespaced per plugin; find it from the
// generated default rather than guessing.
$optionGroup = null;
$reflection  = new ReflectionClass($settingsClass);
foreach ($reflection->getReflectionConstants() as $constant) {
    if ('OPTION_GROUP' === $constant->getName()) {
        $optionGroup = $constant->getValue();
    }
}

if (null === $optionGroup) {
    fwrite(STDERR, "could not determine the Settings option group\n");
    exit(2);
}

// -------------------------------------------------------------------------
// 1. The module must wire up its hooks.
// -------------------------------------------------------------------------
$client = new $licenseClientClass();
$client->register();

check(
    'module id is license-client',
    'license-client' === $client->id(),
    'got: ' . var_export($client->id(), true)
);

check(
    'reports no unmet requirements when a license server is configured',
    [] === $client->requirements(),
    'unmet: ' . implode(', ', $client->requirements())
);

// -------------------------------------------------------------------------
// 2. Activation — the buyer pastes a key in wp-admin.
// -------------------------------------------------------------------------
// The generated Guard::verify_write() requires a capability (stubbed true)
// and a nonce present in $_REQUEST; wp_verify_nonce() is stubbed to accept.
$_POST['license_key']       = $licenseKey;
$_POST['_wpnonce']          = 'stub-nonce';
$_REQUEST['_wpnonce']       = 'stub-nonce';
$_SERVER['REQUEST_METHOD']  = 'POST';

// handle_activate() ends by redirecting, and generated WordPress handlers
// call exit; right after wp_safe_redirect(). The stub turns that into a
// catchable exception so the rest of the test still runs.
$activationRedirect = null;
try {
    $client->handle_activate();
} catch (AIWP_Redirect $redirect) {
    $activationRedirect = $redirect->location;
}

check(
    'activation redirects back to the settings page',
    is_string($activationRedirect) && str_contains($activationRedirect, 'options-general.php'),
    'redirect: ' . var_export($activationRedirect, true)
);

$stored = get_option($optionGroup, []);
check(
    'activation stores the license key',
    is_array($stored) && ($stored['license_key'] ?? '') === $licenseKey,
    'stored: ' . json_encode(is_array($stored) ? array_keys($stored) : $stored)
);

check(
    'the plugin considers itself active after activation',
    true === $client->is_active(),
    'license_status: ' . var_export(is_array($stored) ? ($stored['license_status'] ?? null) : null, true)
);

// -------------------------------------------------------------------------
// 3. Revalidation — the daily cron.
// -------------------------------------------------------------------------
$client->revalidate();

$afterRevalidate = get_option($optionGroup, []);
check(
    'revalidation keeps the license active',
    'active' === ($afterRevalidate['license_status'] ?? ''),
    'license_status: ' . var_export($afterRevalidate['license_status'] ?? null, true)
);

// -------------------------------------------------------------------------
// 4. Update injection — the private update channel.
// -------------------------------------------------------------------------
$transient = (object) ['response' => [], 'translations' => []];
$result    = $client->inject_update($transient);

check(
    'inject_update returns an object',
    is_object($result),
    'got: ' . gettype($result)
);

// -------------------------------------------------------------------------
// 5. Plugin information — the "View details" popup.
// -------------------------------------------------------------------------
$info = $client->plugin_information(false, 'plugin_information', (object) ['slug' => 'store-health']);
check(
    'plugin_information returns something usable',
    null !== $info && false !== $info,
    'got: ' . gettype($info)
);

// -------------------------------------------------------------------------
echo json_encode(
    [
        'mode'        => aiwp_fixture_mode(),
        'assertions'  => $assertions,
        'requests'    => $GLOBALS['aiwp_requests'],
        'licenseKey'  => $licenseKey,
        'optionGroup' => $optionGroup,
    ],
    JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
), "\n";

exit(0);
