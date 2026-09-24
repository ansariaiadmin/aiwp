<?php
/**
 * Full pipeline: validate -> compose -> lint (phpcs, if vendor/ is
 * installed) -> zip to /build/<slug>-<version>.zip.
 *
 * Usage: php tools/build.php <path/to/spec.json>
 *
 * @package WpPluginFactory\Tools
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/Support.php';
require_once __DIR__ . '/lib/SchemaValidator.php';
require_once __DIR__ . '/validate.php';
require_once __DIR__ . '/compose.php';

use WpPluginFactory\Tools\Support;

/**
 * Verifies every composed PHP file parses cleanly, using php -l when
 * shell_exec() is available, and a token_get_all()-based fallback
 * otherwise (some hosts disable shell_exec()/proc_open() entirely).
 */
function wppf_check_syntax( string $composedDir ): void {
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($composedDir, FilesystemIterator::SKIP_DOTS));
    $canShellExec = function_exists('shell_exec') && false === stripos((string) ini_get('disable_functions'), 'shell_exec');
    $errors = [];

    foreach ($iterator as $file) {
        /** @var SplFileInfo $file */
        if ('php' !== $file->getExtension()) {
            continue;
        }

        $checkedViaShell = false;

        if ($canShellExec) {
            // shell_exec() is not merely absent on some builds — it can be
            // present and then *throw* (WebAssembly PHP raises
            // "popen(), proc_open() are unsupported"; hardened hosts raise
            // similar errors). Treat a throw exactly like a null return and
            // fall through to the tokenizer check below.
            try {
                $output = shell_exec(escapeshellcmd(PHP_BINARY) . ' -l ' . escapeshellarg($file->getPathname()) . ' 2>&1');
            } catch (Throwable $spawnError) {
                $output = null;
                // Only worth deciding once; every later file would throw too.
                $canShellExec = false;
            }

            // Some restricted/sandboxed PHP builds report shell_exec() as
            // callable but it either silently no-ops (returns null/'') or
            // spawns a process that cannot see the same filesystem/working
            // directory as the parent (reports "Could not open input
            // file"); fall back to the tokenizer-based check below in
            // either case instead of treating that as a real syntax error.
            if (is_string($output) && '' !== $output && !str_contains($output, 'Could not open input file')) {
                $checkedViaShell = true;

                if (!str_contains($output, 'No syntax errors detected')) {
                    $errors[] = trim($output);
                }
            }
        }

        if ($checkedViaShell) {
            continue;
        }

        // Fallback: a parse error surfaces as a thrown ParseError from
        // token_get_all() with TOKEN_PARSE, without executing the file.
        try {
            token_get_all((string) file_get_contents($file->getPathname()), TOKEN_PARSE);
        } catch (ParseError $parseError) {
            $errors[] = $file->getPathname() . ': ' . $parseError->getMessage();
        }
    }

    if ([] !== $errors) {
        throw new RuntimeException("PHP syntax errors in composed output:\n - " . implode("\n - ", $errors));
    }
}

function wppf_run_phpcs( string $composedDir ): void {
    $phpcsAutoload = Support::repoPath('vendor/squizlabs/php_codesniffer/autoload.php');

    if (! is_file($phpcsAutoload)) {
        fwrite(STDERR, "NOTE: vendor/squizlabs/php_codesniffer not installed (run `composer install` first) — skipping lint step of the build.\n");

        return;
    }

    // The repo's own phpcs.xml.dist targets template *sources* (scaffold/,
    // modules/, tools/) via path-based <include-pattern>s and allow-lists
    // the {{PLACEHOLDER}} tokens/dummy VendorPlugin|VPLUGIN identifiers
    // those templates use. The *composed* output in $composedDir has none
    // of that: every token is already resolved to the plugin's real
    // namespace/prefix/text-domain, so it is linted here against a plain,
    // unmodified WordPress-Core + WordPress-Extra + PHPCompatibilityWP
    // ruleset — the same bar a real, hand-written WordPress plugin must
    // clear.
    $ruleset = wppf_write_runtime_ruleset($composedDir);

    // Run PHP_CodeSniffer in-process (rather than shelling out to
    // vendor/bin/phpcs) so the build works identically on hosts where
    // shell_exec()/proc_open() are disabled or sandboxed.
    require_once $phpcsAutoload;

    $previousArgv     = $_SERVER['argv'] ?? null;
    $previousArgc     = $_SERVER['argc'] ?? null;
    $_SERVER['argv']  = [
        'phpcs',
        '--standard=' . $ruleset,
        '--extensions=php',
        '-q',
        $composedDir,
    ];
    $_SERVER['argc']  = count($_SERVER['argv']);

    ob_start();
    $runner   = new \PHP_CodeSniffer\Runner();
    $exitCode = $runner->runPHPCS();
    $output   = ob_get_clean();

    if (null === $previousArgv) {
        unset($_SERVER['argv'], $_SERVER['argc']);
    } else {
        $_SERVER['argv'] = $previousArgv;
        $_SERVER['argc'] = $previousArgc;
    }

    unlink($ruleset);

    echo $output;

    // Runner::runPHPCS() exit codes: 0 = no errors, 1 = errors found (none
    // auto-fixable), 2 = errors found (some auto-fixable), 3 = a fatal
    // runner-level problem (e.g. a bad ruleset). 1 and 2 both mean "phpcs
    // found violations" and should fail the build the same way.
    if (0 !== $exitCode) {
        throw new RuntimeException("phpcs reported violations in the composed plugin (exit code {$exitCode}); see output above.");
    }
}

/**
 * Writes a throwaway phpcs ruleset for linting fully-composed (placeholder-
 * free) plugin output, and returns its path.
 */
function wppf_write_runtime_ruleset( string $composedDir ): string {
    $xml = <<<XML
        <?xml version="1.0"?>
        <ruleset name="WP-Plugin-Factory-Build">
            <description>Runtime lint pass for a fully-composed plugin build.</description>
            <config name="testVersion" value="8.1-"/>
            <config name="minimum_supported_wp_version" value="6.5"/>
            <rule ref="WordPress-Core">
                <!-- This factory uses one PSR-4 class per file named after the
                     class, autoloaded via a generated classmap, not the WP
                     core file naming convention. See docs/ARCHITECTURE.md. -->
                <exclude name="WordPress.Files.FileName"/>
                <!-- Target codebase is PHP 8.1+ only: prefer modern short array
                     syntax ([]) over WP core's legacy array() convention. -->
                <exclude name="Universal.Arrays.DisallowShortArraySyntax"/>
                <!-- Shells out to the "php -l" binary; redundant with the
                     explicit php -l pass tools/build.php already runs on
                     every composed file, and unreliable in restricted
                     environments where shell_exec()/proc_open() are limited. -->
                <exclude name="Generic.PHP.Syntax"/>
            </rule>
            <rule ref="WordPress-Extra">
                <exclude name="WordPress.Files.FileName"/>
                <exclude name="Universal.Arrays.DisallowShortArraySyntax"/>
                <exclude name="Generic.PHP.Syntax"/>
            </rule>
            <rule ref="PHPCompatibilityWP"/>
        </ruleset>
        XML;

    $path = rtrim($composedDir, '/') . '/../.build-phpcs-ruleset.xml';
    file_put_contents($path, $xml);

    return $path;
}

function wppf_zip_directory( string $sourceDir, string $zipPath, string $slug ): void {
    if (is_file($zipPath)) {
        unlink($zipPath);
    }

    $zip = new ZipArchive();

    if (true !== $zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE)) {
        throw new RuntimeException("Unable to create ZIP at {$zipPath}.");
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($sourceDir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    foreach ($iterator as $item) {
        /** @var SplFileInfo $item */
        $relative = $slug . '/' . substr($item->getPathname(), strlen($sourceDir) + 1);

        if ($item->isDir()) {
            $zip->addEmptyDir($relative);
        } else {
            $zip->addFile($item->getPathname(), $relative);
        }
    }

    $zip->close();
}

if (realpath($argv[0] ?? '') === __FILE__) {
    $specPath = $argv[1] ?? '';

    if ('' === $specPath) {
        fwrite(STDERR, "Usage: php tools/build.php <path/to/spec.json>\n");
        exit(1);
    }

    try {
        $spec    = Support::readJson($specPath);
        $slug    = (string) $spec['slug'];
        $version = (string) $spec['version'];

        echo "==> Validating spec...\n";
        wppf_validate_spec($specPath);
        echo "    OK\n";

        echo "==> Composing plugin...\n";
        $composedDir = wppf_compose($specPath);
        echo "    OK: {$composedDir}\n";

        echo "==> Checking PHP syntax...\n";
        wppf_check_syntax($composedDir);
        echo "    OK\n";

        echo "==> Linting composed output...\n";
        wppf_run_phpcs($composedDir);
        echo "    OK\n";

        echo "==> Zipping...\n";
        $zipPath = Support::repoPath('build/' . $slug . '-' . $version . '.zip');
        wppf_zip_directory($composedDir, $zipPath, $slug);
        echo '    OK: ' . $zipPath . "\n";

        echo "Build succeeded.\n";
    } catch (Throwable $exception) {
        fwrite(STDERR, 'FAIL: ' . $exception->getMessage() . "\n");
        exit(1);
    }
}
