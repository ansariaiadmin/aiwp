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
