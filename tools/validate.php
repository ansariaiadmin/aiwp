<?php
/**
 * Validates a plugin spec against spec/plugin-spec.schema.json, then
 * resolves and validates its module selection (existence, requires,
 * conflicts).
 *
 * Usage: php tools/validate.php <path/to/spec.json>
 *
 * @package WpPluginFactory\Tools
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/Support.php';
require_once __DIR__ . '/lib/SchemaValidator.php';

use WpPluginFactory\Tools\SchemaValidator;
use WpPluginFactory\Tools\Support;

/**
 * Runs full spec validation and returns the resolved, ordered module id
 * list on success. Throws RuntimeException with a descriptive message on
 * any failure. Used directly by tools/compose.php so validation logic
 * lives in exactly one place.
 *
 * @return array{spec: array<string,mixed>, modules: string[]}
 */
function wppf_validate_spec( string $specPath ): array {
    $spec   = Support::readJson($specPath);
    $schema = Support::readJson(Support::repoPath('spec/plugin-spec.schema.json'));

    $validator = new SchemaValidator();
    $errors    = $validator->validate($spec, $schema);

    if ([] !== $errors) {
        throw new RuntimeException("Spec failed schema validation:\n - " . implode("\n - ", $errors));
    }

    $allModules = Support::discoverModules();
    $requested  = array_map('strval', $spec['modules']);

    foreach ($requested as $moduleId) {
        if (! isset($allModules[ $moduleId ])) {
            throw new RuntimeException("Spec references unknown module \"{$moduleId}\". Available modules: " . implode(', ', array_keys($allModules)));
        }
    }

    $resolved = Support::resolveModules($requested, $allModules);

    foreach ($resolved as $moduleId) {
        $moduleErrors = wppf_validate_module($allModules[ $moduleId ]);

        if ([] !== $moduleErrors) {
            throw new RuntimeException("Module \"{$moduleId}\" is invalid:\n - " . implode("\n - ", $moduleErrors));
        }
    }

    if (! empty($spec['license']['enabled']) && ! in_array('license-client', $resolved, true)) {
        throw new RuntimeException('Spec sets license.enabled=true but does not include the "license-client" module.');
    }

    // wordpress.org submission mode: enforce hard review rules up front so a
    // build that claims wporg=true can never ship with commercial gating.
    if (! empty($spec['wporg'])) {
        if (in_array('license-client', $resolved, true)) {
            throw new RuntimeException('Spec sets wporg=true but includes the "license-client" module. wordpress.org plugins must not gate features or updates behind a license key (Guidelines: no commercial restrictions).');
        }
        if (! empty($spec['license']['enabled'])) {
            throw new RuntimeException('Spec sets wporg=true together with license.enabled=true. Choose one distribution target: wp.org (free) or ansariaiwp.com (licensed).');
        }
        $tags = array_map('trim', explode(',', strtolower((string) ($spec['readme']['tags'] ?? ''))));
        $tags = array_filter($tags, static fn (string $t): bool => '' !== $t);
        if (count($tags) < 3) {
            throw new RuntimeException('wporg=true requires at least 3 readme tags under spec.readme.tags (the directory search/review process rejects single-word auto-generated tags).');
        }
        foreach ($tags as $tag) {
            if (preg_match('/[^a-z0-9\-]/', $tag)) {
                throw new RuntimeException("Invalid wp.org tag \"{$tag}\": tags must be lowercase alphanumeric words separated by hyphens.");
            }
        }
    }

    return [
        'spec'    => $spec,
        'modules' => $resolved,
    ];
}

/**
 * @param array<string,mixed> $module
 *
 * @return string[]
 */
function wppf_validate_module( array $module ): array {
    $errors     = [];
    $dir        = (string) ( $module['_dir'] ?? '' );
    $expectedId = basename($dir);

    if (( $module['id'] ?? null ) !== $expectedId) {
        $errors[] = "module.json \"id\" (\"{$module['id']}\") must equal folder name (\"{$expectedId}\").";
    }

    $entryClass = (string) ( $module['entryClass'] ?? '' );

    if ('' === $entryClass) {
        $errors[] = 'module.json is missing "entryClass".';
    } else {
        $entryFile = $dir . '/src/' . $entryClass . '.php';

        if (! is_file($entryFile)) {
            $errors[] = "entryClass \"{$entryClass}\" has no matching file at src/{$entryClass}.php.";
        } elseif (! str_contains((string) file_get_contents($entryFile), 'class ' . $entryClass)) {
            $errors[] = "src/{$entryClass}.php does not declare \"class {$entryClass}\".";
        }
    }

    if (! is_file($dir . '/README.md')) {
        $errors[] = 'missing README.md.';
    }

    return $errors;
}

if (realpath($argv[0] ?? '') === __FILE__) {
    $specPath = $argv[1] ?? '';

    if (in_array($specPath, ['-h', '--help', 'help'], true)) {
        fwrite(STDOUT, "Usage: php tools/validate.php <path/to/spec.json>\n\nValidates a plugin spec against spec/plugin-spec.schema.json and resolves its module selection.\n");
        exit(0);
    }

    if ('' === $specPath) {
        fwrite(STDERR, "Usage: php tools/validate.php <path/to/spec.json>\n");
        exit(1);
    }

    try {
        $result = wppf_validate_spec($specPath);
        echo "OK: spec is valid.\n";
        echo 'Resolved modules (in build order): ' . implode(', ', $result['modules']) . "\n";
    } catch (Throwable $exception) {
        fwrite(STDERR, 'FAIL: ' . $exception->getMessage() . "\n");
        exit(1);
    }
}
