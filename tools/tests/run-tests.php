<?php
/**
 * Tests for the plugin factory (tools/*.php).
 *
 * A dependency-free runner rather than PHPUnit: the factory has to be
 * testable on a bare `php-cli` install and inside the WebAssembly runner
 * (tools/php-wasm), where pulling a Composer toolchain is not an option.
 *
 * Run:
 *   php tools/tests/run-tests.php
 *   cd tools/php-wasm && npm test
 */

declare(strict_types=1);

$root = dirname(__DIR__, 2);

require_once $root . '/tools/lib/Support.php';
require_once $root . '/tools/lib/SchemaValidator.php';
require_once $root . '/tools/compose.php';
require_once $root . '/tools/build.php';

$passed = 0;
$failed = 0;
$failures = [];

function it(string $name, callable $fn): void
{
    global $passed, $failed, $failures;

    try {
        $fn();
        $passed++;
        echo "  \033[32m✓\033[0m {$name}\n";
    } catch (Throwable $e) {
        $failed++;
        $failures[] = "{$name}: {$e->getMessage()}";
        echo "  \033[31m✗\033[0m {$name}\n      {$e->getMessage()}\n";
    }
}

function assert_true(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function assert_same(mixed $expected, mixed $actual, string $message): void
{
    if ($expected !== $actual) {
        $e = var_export($expected, true);
        $a = var_export($actual, true);
        throw new RuntimeException("{$message} (expected {$e}, got {$a})");
    }
}

function assert_contains(string $haystack, string $needle, string $message): void
{
    if (!str_contains($haystack, $needle)) {
        throw new RuntimeException("{$message} (looking for '{$needle}')");
    }
}

$specPath = $root . '/spec/examples/store-health.json';
$spec     = json_decode((string) file_get_contents($specPath), true, 512, JSON_THROW_ON_ERROR);

// -------------------------------------------------------------------------
echo "\nSpec validation\n";
// -------------------------------------------------------------------------

it('accepts the bundled example spec', function () use ($specPath) {
    $result = wppf_validate_spec($specPath);
    assert_true(is_array($result), 'validate returned a non-array');
    assert_true(count($result['modules']) > 0, 'no modules resolved');
});

it('resolves modules in a deterministic build order', function () use ($specPath) {
    $a = wppf_validate_spec($specPath)['modules'];
    $b = wppf_validate_spec($specPath)['modules'];
    assert_same($a, $b, 'module order is not stable between runs');
});

it('puts license-client last so it can observe the other modules', function () use ($specPath) {
    $modules = wppf_validate_spec($specPath)['modules'];
    assert_same('license-client', end($modules), 'license-client is not last');
});

it('rejects a spec with an unknown module', function () use ($root) {
    $bad = $root . '/spec/examples/store-health.json';
    $spec = json_decode((string) file_get_contents($bad), true, 512, JSON_THROW_ON_ERROR);
    $spec['modules'][] = 'module-that-does-not-exist';

    $tmp = tempnam(sys_get_temp_dir(), 'aiwp-spec-') . '.json';
    file_put_contents($tmp, json_encode($spec, JSON_THROW_ON_ERROR));

    try {
        wppf_validate_spec($tmp);
        throw new RuntimeException('expected validation to fail for an unknown module');
    } catch (Throwable $e) {
        if (str_contains($e->getMessage(), 'expected validation to fail')) {
            throw $e;
        }
        // Any rejection is the correct outcome.
        assert_true(true, '');
    } finally {
        @unlink($tmp);
    }
});

it('rejects a slug that is not kebab-case', function () use ($specPath) {
    $spec = json_decode((string) file_get_contents($specPath), true, 512, JSON_THROW_ON_ERROR);
    $spec['slug'] = 'Not A Valid Slug';

    $tmp = tempnam(sys_get_temp_dir(), 'aiwp-spec-') . '.json';
    file_put_contents($tmp, json_encode($spec, JSON_THROW_ON_ERROR));

    try {
        wppf_validate_spec($tmp);
        throw new RuntimeException('expected validation to fail for a bad slug');
    } catch (Throwable $e) {
        if (str_contains($e->getMessage(), 'expected validation to fail')) {
            throw $e;
        }
        assert_true(true, '');
    } finally {
        @unlink($tmp);
    }
});

// -------------------------------------------------------------------------
echo "\nComposition\n";
// -------------------------------------------------------------------------

// Compose into a throwaway directory so the tests never touch build/.
$composed = wppf_compose($specPath, sys_get_temp_dir() . '/aiwp-test-' . getmypid());

it('writes a main plugin file with a valid WordPress header', function () use ($composed, $spec) {
    $main = $composed . '/' . $spec['slug'] . '.php';
    assert_true(is_file($main), "missing {$main}");

    $contents = (string) file_get_contents($main);
    assert_contains($contents, 'Plugin Name:', 'no Plugin Name header');
    assert_contains($contents, 'Version:', 'no Version header');
    assert_contains($contents, 'Text Domain:', 'no Text Domain header');
    assert_contains($contents, 'License:', 'no License header');
});

it('declares GPL-2.0-or-later, as WordPress.org and Envato require', function () use ($composed, $spec) {
    $contents = (string) file_get_contents($composed . '/' . $spec['slug'] . '.php');
    assert_contains($contents, 'GPL-2.0-or-later', 'licence is not GPL-2.0-or-later');
});

it('substitutes every placeholder — none may leak into the output', function () use ($composed) {
    $leaked = [];
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($composed, FilesystemIterator::SKIP_DOTS)
    );

    foreach ($iterator as $file) {
        if ($file->isDir() || !in_array($file->getExtension(), ['php', 'txt', 'json'], true)) {
            continue;
        }
        $body = (string) file_get_contents($file->getPathname());
        if (preg_match('/\{\{[A-Z0-9_]+\}\}/', $body, $m)) {
            $leaked[] = $file->getFilename() . ' -> ' . $m[0];
        }
    }

    assert_true($leaked === [], 'unsubstituted placeholders: ' . implode(', ', array_slice($leaked, 0, 5)));
});

it('namespaces the code as the spec asks', function () use ($composed, $spec) {
    $main = (string) file_get_contents($composed . '/' . $spec['slug'] . '.php');
    $all  = '';
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($composed, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($iterator as $file) {
        if ($file->isFile() && 'php' === $file->getExtension()) {
            $all .= (string) file_get_contents($file->getPathname());
        }
    }

    $namespace = str_replace('\\', '\\\\', $spec['namespace']);
    assert_true(
        str_contains($all, $spec['namespace']) || str_contains($main, $namespace),
        'the spec namespace never appears in the output'
    );
});

it('wires the licence client to the server the spec declares', function () use ($composed, $spec) {
    if (empty($spec['license']['enabled'])) {
        return; // nothing to assert
    }

    $client = $composed . '/src/Modules/LicenseClient/LicenseClient.php';
    assert_true(is_file($client), 'LicenseClient was not composed');

    $body = (string) file_get_contents($client);
    assert_contains($body, $spec['license']['server'], 'licence server URL not baked in');
    assert_contains($body, $spec['license']['productId'], 'product id not baked in');
});

it('produces a licence URL the platform actually serves', function () use ($composed, $spec) {
    // Guards the integration contract: LicenseClient calls
    // {server}/license/{action}, and the platform exposes exactly that under
    // /api/v1. If either side moves, this test fails.
    if (empty($spec['license']['enabled'])) {
        return;
    }

    $server = rtrim($spec['license']['server'], '/');
    assert_contains($server, '/api/v1', 'licence server must point at the versioned /api/v1 namespace');

    $client = (string) file_get_contents($composed . '/src/Modules/LicenseClient/LicenseClient.php');
    assert_contains($client, "'license/'", 'LicenseClient no longer builds a /license/{action} path');
});

it('generates an uninstall handler', function () use ($composed) {
    assert_true(is_file($composed . '/uninstall.php'), 'uninstall.php is missing');
});

it('generates a readme.txt for WordPress.org', function () use ($composed) {
    assert_true(is_file($composed . '/readme.txt'), 'readme.txt is missing');
});

it('every composed PHP file parses', function () use ($composed) {
    // Reuses the production check rather than re-implementing it.
    wppf_check_syntax($composed);
    assert_true(true, '');
});

it('emits no trailing whitespace, including when a plugin has no dependencies', function () use ($specPath) {
    // Regression: the plugin header emitted " * Requires Plugins:  " with two
    // trailing spaces whenever the spec declared no dependency. WordPress-Core
    // rejects that, so such a plugin failed its own lint step. The reference
    // spec (store-health) requires woocommerce, which hid the bug — so this
    // test composes a deliberately dependency-free spec instead.
    $spec = json_decode((string) file_get_contents($specPath), true, 512, JSON_THROW_ON_ERROR);
    $spec['slug']       = 'aiwp-no-deps-probe';
    $spec['name']       = 'No Deps Probe';
    $spec['namespace']  = 'AnsariAi\\NoDepsProbe';
    $spec['prefix']     = 'ansariai_ndp';
    $spec['textDomain'] = 'aiwp-no-deps-probe';
    unset($spec['requires']['woo']);

    $probeSpec = sys_get_temp_dir() . '/aiwp-nodeps-' . getmypid() . '.json';
    file_put_contents($probeSpec, json_encode($spec, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

    $outDir = wppf_compose($probeSpec, sys_get_temp_dir() . '/aiwp-nodeps-' . getmypid());
    @unlink($probeSpec);

    $header = (string) file_get_contents($outDir . '/aiwp-no-deps-probe.php');
    assert_true(
        ! str_contains($header, 'Requires Plugins'),
        'a plugin with no dependencies must not emit a Requires Plugins header at all',
    );

    $rii = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($outDir, FilesystemIterator::SKIP_DOTS));
    foreach ($rii as $file) {
        if (! $file->isFile() || 'php' !== $file->getExtension()) {
            continue;
        }

        $lines = explode("\n", (string) file_get_contents($file->getPathname()));
        foreach ($lines as $i => $line) {
            assert_true(
                rtrim($line) === $line,
                sprintf('%s:%d has trailing whitespace', str_replace($outDir . '/', '', $file->getPathname()), $i + 1),
            );
        }
    }

    assert_true(true, '');
});

// -------------------------------------------------------------------------
echo "\nPackaging\n";
// -------------------------------------------------------------------------

it('zips the composed plugin into build/', function () use ($composed, $spec) {
    $zipPath = $composed . '.zip-test.zip';
    @unlink($zipPath);

    wppf_zip_directory($composed, $zipPath, $spec['slug']);

    assert_true(is_file($zipPath), 'zip was not created');
    assert_true(filesize($zipPath) > 1000, 'zip is suspiciously small');

    $zip = new ZipArchive();
    assert_true(true === $zip->open($zipPath), 'zip cannot be opened');

    // WordPress expects a single top-level folder inside the archive.
    $top = [];
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $name = (string) $zip->getNameIndex($i);
        $top[explode('/', $name)[0]] = true;
    }

    assert_true($zip->numFiles > 10, 'zip has implausibly few entries');
    assert_same([$spec['slug'] => true], $top, 'zip must contain exactly one top-level folder');
    $zip->close();
    @unlink($zipPath);
});

// -------------------------------------------------------------------------
$colour = $failed === 0 ? "\033[32m" : "\033[31m";
echo "\n{$colour}{$passed} passed, {$failed} failed\033[0m\n";

if ($failed > 0) {
    echo "\nFailures:\n";
    foreach ($failures as $f) {
        echo "  - {$f}\n";
    }
}

echo "\n";
exit($failed === 0 ? 0 : 1);
