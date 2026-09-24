<?php
/**
 * Small shared helpers used by validate.php / compose.php / build.php /
 * new-module.php. Kept dependency-free on purpose.
 *
 * @package WpPluginFactory\Tools
 */

declare(strict_types=1);

namespace WpPluginFactory\Tools;

final class Support {
    public const REPO_ROOT = __DIR__ . '/../..';

    public static function repoPath( string $relative ): string {
        return rtrim(self::REPO_ROOT, '/') . '/' . ltrim($relative, '/');
    }

    /**
     * @return array<string,mixed>
     */
    public static function readJson( string $path ): array {
        if (! is_file($path)) {
            throw new \RuntimeException("File not found: {$path}");
        }

        $contents = file_get_contents($path);

        if (false === $contents) {
            throw new \RuntimeException("Unable to read file: {$path}");
        }

        $decoded = json_decode($contents, true);

        if (JSON_ERROR_NONE !== json_last_error()) {
            throw new \RuntimeException("Invalid JSON in {$path}: " . json_last_error_msg());
        }

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * Converts a kebab-case module id to StudlyCaps, e.g.
     * 'settings-page' => 'SettingsPage'.
     */
    public static function studly( string $kebab ): string {
        return str_replace(' ', '', ucwords(str_replace([ '-', '_' ], ' ', $kebab)));
    }

    public static function upperSnake( string $prefix ): string {
        return strtoupper(str_replace('-', '_', $prefix));
    }

    /**
     * Discovers every module.json under modules/, keyed by module id.
     *
     * @return array<string,array<string,mixed>>
     */
    public static function discoverModules(): array {
        $modules    = [];
        $modulesDir = self::repoPath('modules');

        foreach (glob($modulesDir . '/*', GLOB_ONLYDIR) ?: [] as $dir) {
            $manifestPath = $dir . '/module.json';

            if (! is_file($manifestPath)) {
                continue;
            }

            $manifest         = self::readJson($manifestPath);
            $id               = (string) ( $manifest['id'] ?? basename($dir) );
            $manifest['_dir'] = $dir;
            $modules[ $id ]   = $manifest;
        }

        return $modules;
    }

    /**
     * Resolves the full set of module ids to include, given the requested
     * ids, by transitively following each module's "requires" list.
     * Returns ids ordered so dependencies always precede dependents.
     *
     * @param string[]                          $requested
     * @param array<string,array<string,mixed>> $allModules
     *
     * @return string[]
     *
     * @throws \RuntimeException on missing module, or a requires/conflicts violation.
     */
    public static function resolveModules( array $requested, array $allModules ): array {
        $resolved = [];
        $visiting = [];

        $visit = static function ( string $id ) use ( &$visit, &$resolved, &$visiting, $allModules ): void {
            if (isset($resolved[ $id ])) {
                return;
            }

            if (! isset($allModules[ $id ])) {
                throw new \RuntimeException("Unknown module \"{$id}\" referenced in spec or module requires.");
            }

            if (isset($visiting[ $id ])) {
                throw new \RuntimeException("Circular module dependency detected involving \"{$id}\".");
            }

            $visiting[ $id ] = true;

            foreach ((array) ( $allModules[ $id ]['requires'] ?? [] ) as $dependencyId) {
                $visit((string) $dependencyId);
            }

            unset($visiting[ $id ]);
            $resolved[ $id ] = true;
        };

        foreach ($requested as $id) {
            $visit($id);
        }

        $resolvedIds = array_keys($resolved);

        // Conflict check across the fully resolved set (including transitively pulled-in modules).
        foreach ($resolvedIds as $id) {
            foreach ((array) ( $allModules[ $id ]['conflicts'] ?? [] ) as $conflictId) {
                if (in_array((string) $conflictId, $resolvedIds, true)) {
                    throw new \RuntimeException("Module \"{$id}\" conflicts with \"{$conflictId}\", both are (transitively) selected.");
                }
            }
        }

        return $resolvedIds;
    }

    /**
     * Recursively finds every {{TOKEN}} occurrence in a string.
     *
     * @return string[] token names, without the surrounding braces.
     */
    public static function findPlaceholders( string $contents ): array {
        preg_match_all('/\{\{([A-Z0-9_]+)\}\}/', $contents, $matches);

        return array_values(array_unique($matches[1] ?? []));
    }

    public static function replacePlaceholders( string $contents, array $map ): string {
        $search  = [];
        $replace = [];

        foreach ($map as $key => $value) {
            $search[]  = '{{' . $key . '}}';
            $replace[] = (string) $value;
        }

        return str_replace($search, $replace, $contents);
    }

    /**
     * Replaces "bare" identifier-safe placeholder tokens — used anywhere a
     * mustache {{TOKEN}} would break PHP syntax (namespace declarations,
     * function names, bare constant references) — with their real values.
     * Scaffold/module source is intentionally written using these dummy,
     * syntactically valid identifiers (VendorPlugin, VPLUGIN, vplugin_boot)
     * so every *.php file lints and parses correctly even before a build
     * resolves it; only *.stub files (and comments/strings, which use the
     * regular {{TOKEN}} mustache placeholders) need compose-time resolution
     * to become real PHP.
     *
     * @param array<string,string> $map bare token => replacement value.
     */
    public static function replaceBareTokens( string $contents, array $map ): string {
        return str_replace(array_keys($map), array_values($map), $contents);
    }

    /**
     * Recursively copies a directory, optionally applying a per-file
     * transform (used for placeholder replacement + *.stub renaming).
     *
     * @param callable(string $contents, string $relativePath): string $transform
     * @param callable(string $relativePath): string                   $renamePath
     */
    public static function copyTree( string $source, string $destination, callable $transform, callable $renamePath ): void {
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($source, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $item) {
            /** @var \SplFileInfo $item */
            $relative   = substr($item->getPathname(), strlen($source) + 1);
            $relative   = $renamePath($relative);
            $targetPath = rtrim($destination, '/') . '/' . $relative;

            if ($item->isDir()) {
                if (! is_dir($targetPath)) {
                    mkdir($targetPath, 0755, true);
                }

                continue;
            }

            if ('.gitkeep' === basename($item->getPathname())) {
                continue;
            }

            $dir = dirname($targetPath);

            if (! is_dir($dir)) {
                mkdir($dir, 0755, true);
            }

            $contents = file_get_contents($item->getPathname());
            $contents = false === $contents ? '' : $transform($contents, $relative);

            file_put_contents($targetPath, $contents);
        }
    }

    public static function rrmdir( string $dir ): void {
        if (! is_dir($dir)) {
            return;
        }

        $items = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($items as $item) {
            /** @var \SplFileInfo $item */
            if ($item->isDir()) {
                rmdir($item->getPathname());
            } else {
                unlink($item->getPathname());
            }
        }

        rmdir($dir);
    }

    /**
     * Converts a PHP array to exported PHP source, using short array
     * syntax and stable key quoting, suitable for embedding into a
     * generated const declaration.
     */
    public static function exportPhpArray( array $value, int $indent = 0 ): string {
        $pad      = str_repeat("\t", $indent);
        $innerPad = str_repeat("\t", $indent + 1);
        $isList   = array_keys($value) === range(0, count($value) - 1);
        $lines    = [ '[' ];

        foreach ($value as $key => $item) {
            $prefix = $isList ? '' : self::exportPhpScalar((string) $key) . ' => ';

            if (is_array($item)) {
                $lines[] = $innerPad . $prefix . self::exportPhpArray($item, $indent + 1) . ',';
            } else {
                $lines[] = $innerPad . $prefix . self::exportPhpScalar($item) . ',';
            }
        }

        $lines[] = $pad . ']';

        return implode("\n", $lines);
    }

    private static function exportPhpScalar( mixed $value ): string {
        if (is_string($value)) {
            return "'" . addcslashes($value, "'\\") . "'";
        }

        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        if (null === $value) {
            return 'null';
        }

        return (string) $value;
    }
}
