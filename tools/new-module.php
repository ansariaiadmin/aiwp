<?php
/**
 * Scaffolds a brand-new, empty module following docs/MODULE-SPEC.md, so
 * contributors never have to re-derive the module contract by hand.
 *
 * Usage: php tools/new-module.php <module-id> "<Human Name>" [entryClass]
 *
 * @package WpPluginFactory\Tools
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/Support.php';

use WpPluginFactory\Tools\Support;

function wppf_new_module( string $id, string $name, ?string $entryClass = null ): string {
    if (1 !== preg_match('/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/', $id)) {
        throw new RuntimeException("Module id \"{$id}\" must be lowercase kebab-case, e.g. \"my-module\".");
    }

    $dir = Support::repoPath('modules/' . $id);

    if (is_dir($dir)) {
        throw new RuntimeException("modules/{$id} already exists.");
    }

    $entryClass ??= Support::studly($id);

    mkdir($dir . '/src', 0755, true);

    file_put_contents($dir . '/module.json', wppf_render_module_json($id, $name, $entryClass));
    file_put_contents($dir . '/README.md', wppf_render_readme($id, $name));
    file_put_contents($dir . '/src/' . $entryClass . '.php', wppf_render_entry_class($id, $entryClass));

    return $dir;
}

function wppf_render_module_json( string $id, string $name, string $entryClass ): string {
    $data = [
        'id' => $id,
        'name' => $name,
        'version' => '1.0.0',
        'description' => 'TODO: describe what this module does.',
        'requires' => [],
        'conflicts' => [],
        'hooks' => [
            'actions' => [],
            'filters' => [],
        ],
        'options' => [],
        'placeholders' => [],
        'entryClass' => $entryClass,
        'capabilities' => [],
        'woo' => false,
    ];

    return json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
}

function wppf_render_readme( string $id, string $name ): string {
    return <<<MD
        # {$id}

        TODO: one paragraph describing what this module does.

        ## What it does

        TODO.

        ## Options

        None yet.

        ## Hooks

        None yet.

        ## Example usage

        ```json
        {
          "modules": ["{$id}"]
        }
        ```

        MD;
}

function wppf_render_entry_class( string $id, string $entryClass ): string {
    return <<<PHP
        <?php
        /**
         * {$entryClass} module.
         *
         * @package VendorPlugin
         */

        declare(strict_types=1);

        namespace VendorPlugin\\Modules\\{$entryClass};

        use VendorPlugin\\Contracts\\ModuleInterface;

        if ( ! defined( 'ABSPATH' ) ) {
        \texit;
        }

        final class {$entryClass} implements ModuleInterface {

        \tpublic function id(): string {
        \t\treturn '{$id}';
        \t}

        \tpublic function requirements(): array {
        \t\treturn [];
        \t}

        \tpublic function register(): void {
        \t\t// TODO: add_action()/add_filter() calls only.
        \t}

        \tpublic function boot(): void {
        \t\t// TODO: optional cross-module logic.
        \t}
        }

        PHP;
}

if (realpath($argv[0] ?? '') === __FILE__) {
    $id = $argv[1] ?? '';
    $name = $argv[2] ?? '';
    $entryClass = $argv[3] ?? null;

    if ('' === $id || '' === $name) {
        fwrite(STDERR, "Usage: php tools/new-module.php <module-id> \"<Human Name>\" [entryClass]\n");
        exit(1);
    }

    try {
        $dir = wppf_new_module($id, $name, $entryClass);
        echo "OK: created {$dir}\n";
        echo "Next steps:\n";
        echo "  1. Fill in modules/{$id}/module.json (options, hooks, requires).\n";
        echo "  2. Implement the module logic in modules/{$id}/src/.\n";
        echo "  3. Document it in modules/{$id}/README.md.\n";
        echo "  4. Reference \"{$id}\" from a plugin spec's \"modules\" array.\n";
    } catch (Throwable $exception) {
        fwrite(STDERR, 'FAIL: ' . $exception->getMessage() . "\n");
        exit(1);
    }
}
