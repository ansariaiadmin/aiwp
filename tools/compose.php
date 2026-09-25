<?php
/**
 * Composes scaffold + selected modules from a spec into /build/<slug>/,
 * replacing every {{PLACEHOLDER}} token, and generating:
 *  - src/autoload.php     (PSR-4-ish classmap autoloader)
 *  - src/module-manifest.php (Manifest::MODULE_CLASSES / SETTINGS_FIELDS / SPEC)
 *  - composer.json         (dev/IDE only, never required at runtime)
 *  - readme.txt            (from scaffold/readme.txt.stub)
 *  - languages/<slug>.pot  (strings scraped from the composed PHP)
 *
 * Usage: php tools/compose.php <path/to/spec.json> [--out=/custom/build/dir]
 *
 * @package WpPluginFactory\Tools
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/Support.php';
require_once __DIR__ . '/lib/SchemaValidator.php';
require_once __DIR__ . '/validate.php';

use WpPluginFactory\Tools\Support;

/**
 * @param array<string,mixed> $spec
 *
 * @return array<string,string>
 */
function wppf_placeholder_map( array $spec ): array {
    $slug     = (string) $spec['slug'];
    $prefix   = (string) $spec['prefix'];
    $requires = (array) ( $spec['requires'] ?? [] );
    $license  = (array) ( $spec['license'] ?? [ 'enabled' => false ] );

    $requiresPluginsHeader = [];

    if (! empty($requires['woo'])) {
        $requiresPluginsHeader[] = 'woocommerce';
    }

    return [
        'SLUG'                    => $slug,
        'SLUG_UNDERSCORE'         => str_replace('-', '_', $slug),
        'NAMESPACE'               => (string) $spec['namespace'],
        'PLUGIN_NAME'             => (string) $spec['name'],
        'DESCRIPTION'             => (string) ( $spec['description'] ?? '' ),
        'PREFIX'                  => $prefix,
        'PREFIX_UPPER'            => Support::upperSnake($prefix),
        'TEXT_DOMAIN'             => (string) $spec['textDomain'],
        'VERSION'                 => (string) $spec['version'],
        'AUTHOR_NAME'             => (string) ( $spec['author']['name'] ?? 'AnsariAi' ),
        'AUTHOR_URI'              => (string) ( $spec['author']['uri'] ?? 'https://ansariaiwp.com' ),
        'REQUIRES_PHP'            => (string) ( $requires['php'] ?? '8.1' ),
        'REQUIRES_WP'             => (string) ( $requires['wp'] ?? '6.5' ),
        'REQUIRES_WOO'            => (string) ( $requires['woo'] ?? '' ),
        // The header line is emitted whole, or not at all. Emitting an empty
        // value left " * Requires Plugins:  " with trailing spaces, which
        // WordPress-Core rejects — so any plugin without a declared
        // dependency failed its own lint step.
        'REQUIRES_PLUGINS_LINE'   => [] === $requiresPluginsHeader
            ? ''
            : ' * Requires Plugins:  ' . implode(', ', $requiresPluginsHeader) . "\n",
        'LICENSE_ENABLED'         => ! empty($license['enabled']) ? '1' : '',
        'LICENSE_SERVER'          => (string) ( $license['server'] ?? '' ),
        'LICENSE_PRODUCT_ID'      => (string) ( $license['productId'] ?? $slug ),
    ];
}

/**
 * Bare, identifier-safe placeholder tokens used inside scaffold/module *.php
 * source wherever a {{MUSTACHE}} token would break PHP syntax (namespace
 * declarations, bare constant references, the bootstrap function name).
 * These are plain string search/replace pairs, applied in addition to the
 * {{PLACEHOLDER}} map. Order matters: the longer/more specific tokens are
 * replaced before the shorter ones that could be substrings of them.
 *
 * @param array<string,string> $placeholders standard {{...}} placeholder map.
 *
 * @return array<string,string>
 */
function wppf_bare_token_map( array $placeholders ): array {
    return [
        'vplugin_boot' => $placeholders['PREFIX'] . '_boot',
        'VendorPlugin' => $placeholders['NAMESPACE'],
        'VPLUGIN'      => $placeholders['PREFIX_UPPER'],
    ];
}

/**
 * Rewrite the composed readme.txt into a wordpress.org-review-ready listing.
 *
 * The default stub is deliberately minimal (fine for private distribution),
 * but wp.org review rejects: single auto-generated tags, a one-line
 * Description duplicated verbatim, and an FAQ that only contains boilerplate.
 * When spec.readme provides real content we render it; otherwise we fall back
 * to the description text so the section is never empty.
 *
 * @param array<string,mixed>    $spec
 * @param array<string,string>   $placeholders
 */
function wppf_apply_wporg_readme( string $readmePath, array $spec, array $placeholders ): void {
    $readme      = (array) ( $spec['readme'] ?? [] );
    $tags        = trim((string) ( $readme['tags'] ?? '' ));
    $shortDesc   = trim((string) ( $readme['shortDescription'] ?? $placeholders['DESCRIPTION'] ));
    $longDesc    = trim((string) ( $readme['longDescription'] ?? '' ));
    $faqs        = (array) ( $readme['faqs'] ?? [] );

    $lines   = [];
    $lines[] = '=== ' . $placeholders['PLUGIN_NAME'] . ' ===';
    $lines[] = 'Contributors: ' . $placeholders['AUTHOR_NAME'];
    $lines[] = 'Tags: ' . ('' !== $tags ? $tags : strtolower($placeholders['SLUG']));
    $lines[] = 'Requires at least: ' . $placeholders['REQUIRES_WP'];
    $lines[] = 'Tested up to: ' . $placeholders['REQUIRES_WP'];
    $lines[] = 'Requires PHP: ' . $placeholders['REQUIRES_PHP'];
    $lines[] = 'Stable tag: ' . $placeholders['VERSION'];
    $lines[] = 'License: GPLv2 or later';
    $lines[] = 'License URI: https://www.gnu.org/licenses/gpl-2.0.html';
    $lines[] = '';
    $lines[] = $shortDesc;
    $lines[] = '';
    $lines[] = '== Description ==';
    $lines[] = '';
    $lines[] = '' !== $longDesc ? $longDesc : $shortDesc;
    $lines[] = '';
    $lines[] = '== Installation ==';
    $lines[] = '';
    $lines[] = '1. Upload the plugin ZIP via Plugins → Add New → Upload Plugin, or extract';
    $lines[] = '   it into `wp-content/plugins/`.';
    $lines[] = '2. Activate the plugin through the "Plugins" screen in WordPress.';
    $lines[] = '3. Configure the plugin under Settings → ' . $placeholders['PLUGIN_NAME'] . '.';
    $lines[] = '';
    $lines[] = '== Frequently Asked Questions ==';
    $lines[] = '';

    if ([] !== $faqs) {
        foreach ($faqs as $faq) {
            $lines[] = '= ' . trim((string) ( $faq['question'] ?? '' )) . ' =';
            $lines[] = '';
            $lines[] = trim((string) ( $faq['answer'] ?? '' ));
            $lines[] = '';
        }
    } else {
        $lines[]  = '= Does this plugin work with WooCommerce High-Performance Order Storage (HPOS)? =';
        $lines[]  = '';
        $lines[]  = 'Yes. This plugin declares compatibility with `custom_order_tables` and';
        $lines[]  = '`cart_checkout_blocks` and only reads/writes WooCommerce orders through';
        $lines[]  = '`wc_get_orders()` / `WC_Order` CRUD methods.';
        $lines[]  = '';
    }

    $lines[] = '== Changelog ==';
    $lines[] = '';
    $lines[] = '= ' . $placeholders['VERSION'] . ' =';
    $lines[] = '* Initial release.';
    $lines[] = '';

    file_put_contents($readmePath, implode("\n", $lines));
}

/**
 * Remove vendor/commercial branding from the generated plugin header when
 * targeting wordpress.org: Plugin URI must not advertise a commercial site
 * unless it belongs to the submitting author, and marketing lines such as
 * "generated by <factory>" have no place in a wp.org listing.
 *
 * Concretely: if Plugin URI equals Author URI (the common factory default),
 * drop the Plugin URI line entirely — wp.org then links to the author page,
 * which is allowed and avoids self-promotion flags.
 */
function wppf_strip_commercial_branding( string $mainFilePath ): void {
    $contents = file_get_contents($mainFilePath);

    if (false === $contents) {
        return;
    }

    if (preg_match('/\A(?:<\?php)?(?:.|\n)*? \* Plugin URI:\s+(\S+).*?\n.*? \* Author URI:\s+(\S+)/m', $contents, $m)) {
        if ($m[1] === $m[2]) {
            $contents = preg_replace('/^\s*\* Plugin URI:.*\n/m', '', $contents, 1);
        }
    }

    // Never ship the "generated by" marketing sentence inside a wp.org plugin.
    $contents = str_replace(
        "This plugin was generated by the AnsariAi WordPress Plugin Factory.\n\n",
        '',
        (string) $contents
    );

    file_put_contents($mainFilePath, $contents);
}

/**
 * @param array<string,mixed> $spec
 *
 * @return array<int,array<string,mixed>>
 */
function wppf_settings_fields( array $spec ): array {
    $fields = [];

    foreach ((array) ( $spec['options'] ?? [] ) as $option) {
        $fields[] = [
            'key'     => (string) $option['key'],
            'type'    => (string) $option['type'],
            'label'   => (string) ( $option['label'] ?? ucwords(str_replace('_', ' ', (string) $option['key'])) ),
            'default' => $option['default'] ?? '',
            'choices' => (array) ( $option['choices'] ?? [] ),
            'tab'     => (string) ( $option['tab'] ?? 'general' ),
        ];
    }

    return $fields;
}

/**
 * Composes a validated spec into $outDir (default: build/<slug>). Returns
 * the output directory path.
 */
function wppf_compose( string $specPath, ?string $outDir = null ): string {
    ['spec' => $spec, 'modules' => $moduleIds] = wppf_validate_spec($specPath);

    $slug     = (string) $spec['slug'];
    $outDir ??= Support::repoPath('build/' . $slug);

    Support::rrmdir($outDir);
    mkdir($outDir, 0755, true);

    $placeholders = wppf_placeholder_map($spec);
    $bareTokens   = wppf_bare_token_map($placeholders);
    $allModules   = Support::discoverModules();

    // 1. Copy the scaffold, renaming {{SLUG}}.php.stub => <slug>.php and
    // stripping the .stub extension from every other template file.
    $renameScaffoldPath = static function ( string $relative ) use ( $placeholders ): string {
        $relative = Support::replacePlaceholders($relative, $placeholders);

        return str_ends_with($relative, '.stub') ? substr($relative, 0, -5) : $relative;
    };

    Support::copyTree(
        Support::repoPath('scaffold'),
        $outDir,
        static function ( string $contents ) use ( $placeholders, $bareTokens ): string {
            $contents = Support::replacePlaceholders($contents, $placeholders);

            return Support::replaceBareTokens($contents, $bareTokens);
        },
        $renameScaffoldPath
    );

    // 1b. wordpress.org target: rewrite readme.txt into a review-ready
    // listing and strip commercial branding from the generated plugin
    // header. wp.org reviewers reject single auto-generated tags, empty
    // FAQ sections, and "generated by <vendor>" marketing lines; and
    // every URL in the header must belong to the submitting author.
    if (! empty($spec['wporg'])) {
        wppf_apply_wporg_readme($outDir . '/readme.txt', $spec, $placeholders);
        wppf_strip_commercial_branding($outDir . '/' . $placeholders['SLUG'] . '.php');
    }

    // 2. Copy every resolved module's src/ into src/Modules/<StudlyId>/,
    // resolving module-specific placeholders in addition to the
    // standard set.
    foreach ($moduleIds as $moduleId) {
        $module             = $allModules[ $moduleId ];
        $studlyId           = Support::studly($moduleId);
        $modulePlaceholders = $placeholders;

        $destination = $outDir . '/src/Modules/' . $studlyId;

        Support::copyTree(
            $module['_dir'] . '/src',
            $destination,
            static function ( string $contents ) use ( $modulePlaceholders, $bareTokens ): string {
                $contents = Support::replacePlaceholders($contents, $modulePlaceholders);

                return Support::replaceBareTokens($contents, $bareTokens);
            },
            static fn ( string $relative ): string => $relative
        );
    }

    // 3. Generate src/module-manifest.php (Manifest class) from the
    // resolved module list + spec options.
    $moduleClasses = [];

    foreach ($moduleIds as $moduleId) {
        $studlyId                   = Support::studly($moduleId);
        $entryClass                 = (string) $allModules[ $moduleId ]['entryClass'];
        $moduleClasses[ $moduleId ] = $placeholders['NAMESPACE'] . '\\Modules\\' . $studlyId . '\\' . $entryClass;
    }

    $settingsFields = wppf_settings_fields($spec);

    $manifestPath     = $outDir . '/src/module-manifest.php';
    $manifestContents = file_get_contents($manifestPath);

    if (false === $manifestContents) {
        throw new RuntimeException('Failed to read generated module-manifest.php.');
    }

    $manifestContents = str_replace(
        '{{MODULE_CLASSES_PHP_ARRAY}}',
        Support::exportPhpArray($moduleClasses, 1),
        $manifestContents
    );
    $manifestContents = str_replace(
        '{{SETTINGS_FIELDS_PHP_ARRAY}}',
        Support::exportPhpArray($settingsFields, 1),
        $manifestContents
    );
    $manifestContents = str_replace(
        '{{SPEC_PHP_ARRAY}}',
        Support::exportPhpArray($spec, 1),
        $manifestContents
    );
    file_put_contents($manifestPath, $manifestContents);

    // 4. Generate src/autoload.php: a flat classmap of every FQCN => file.
    $classmap         = wppf_build_classmap($outDir);
    $autoloadPath     = $outDir . '/src/autoload.php';
    $autoloadContents = file_get_contents($autoloadPath);

    if (false === $autoloadContents) {
        throw new RuntimeException('Failed to read generated autoload.php.');
    }

    // Classmap values are stored as paths relative to the plugin root and
    // resolved via __DIR__ at runtime so the build is fully relocatable.
    $relativeClassmap = [];

    foreach ($classmap as $fqcn => $absolutePath) {
        $relativeClassmap[ $fqcn ] = str_replace($outDir, '', $absolutePath);
    }

    $exported = Support::exportPhpArray($relativeClassmap, 1);
    // Prefix every path entry with __DIR__ . '/..' since autoload.php lives in src/.
    $exported = preg_replace("/=> '(\\/[^']+)'/", "=> __DIR__ . '/..\$1'", $exported);

    $autoloadContents = str_replace('{{CLASSMAP_PHP_ARRAY}}', (string) $exported, $autoloadContents);
    file_put_contents($autoloadPath, $autoloadContents);

    // 5. Generate composer.json (dev/IDE convenience only).
    file_put_contents($outDir . '/composer.json', wppf_render_plugin_composer_json($spec));

    // 6. Generate languages/<slug>.pot.
    wppf_generate_pot($outDir, $spec);

    // 7. Fail loudly if any placeholder survived composition.
    $leftovers = wppf_scan_for_placeholders($outDir);

    if ([] !== $leftovers) {
        $formatted = [];

        foreach ($leftovers as $file => $tokens) {
            $formatted[] = $file . ': {{' . implode('}}, {{', $tokens) . '}}';
        }

        throw new RuntimeException("Unresolved placeholders remain after compose:\n - " . implode("\n - ", $formatted));
    }

    return $outDir;
}

/**
 * Walks the composed tree and builds FQCN => absolute file path by parsing
 * `namespace` + `class|interface|trait|enum` declarations. Avoids a
 * Composer dependency for the classmap dumper.
 *
 * @return array<string,string>
 */
function wppf_build_classmap( string $dir ): array {
    $map      = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir . '/src', FilesystemIterator::SKIP_DOTS));

    foreach ($iterator as $file) {
        /** @var SplFileInfo $file */
        if ('php' !== $file->getExtension()) {
            continue;
        }

        if (in_array($file->getFilename(), [ 'autoload.php' ], true)) {
            continue;
        }

        $contents = (string) file_get_contents($file->getPathname());

        if (! preg_match('/^\s*namespace\s+([^;]+);/m', $contents, $namespaceMatch)) {
            continue;
        }

        if (! preg_match_all('/^\s*(?:final\s+|abstract\s+|readonly\s+)*(?:class|interface|trait|enum)\s+([A-Za-z0-9_]+)/m', $contents, $classMatches)) {
            continue;
        }

        $namespace = trim($namespaceMatch[1]);

        foreach ($classMatches[1] as $className) {
            $map[ $namespace . '\\' . $className ] = $file->getPathname();
        }
    }

    return $map;
}

/**
 * @return array<string,string[]> relative file path => unresolved token names.
 */
function wppf_scan_for_placeholders( string $dir ): array {
    $leftovers = [];
    $iterator  = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));

    foreach ($iterator as $file) {
        /** @var SplFileInfo $file */
        if ($file->isDir()) {
            continue;
        }

        $contents = (string) file_get_contents($file->getPathname());
        $tokens   = Support::findPlaceholders($contents);

        if ([] !== $tokens) {
            $leftovers[ str_replace($dir . '/', '', $file->getPathname()) ] = $tokens;
        }
    }

    return $leftovers;
}

/**
 * @param array<string,mixed> $spec
 */
function wppf_render_plugin_composer_json( array $spec ): string {
    $namespace = str_replace('\\', '\\\\', (string) $spec['namespace']) . '\\\\';

    $json = [
        'name'        => 'generated/' . $spec['slug'],
        'description' => (string) ( $spec['description'] ?? $spec['name'] ),
        'type'        => 'wordpress-plugin',
        'license'     => 'GPL-2.0-or-later',
        'require'     => [
            'php' => '>=' . (string) ( $spec['requires']['php'] ?? '8.1' ),
        ],
        'autoload'    => [
            'psr-4' => [
                $namespace => 'src/',
            ],
        ],
    ];

    return json_encode($json, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
}

/**
 * Scrapes __(), _e(), esc_html__() etc. calls with a literal first
 * argument out of the composed PHP and writes a minimal .pot file.
 *
 * @param array<string,mixed> $spec
 */
function wppf_generate_pot( string $outDir, array $spec ): void {
    $strings  = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($outDir, FilesystemIterator::SKIP_DOTS));
    $pattern  = '/\b(?:__|_e|esc_html__|esc_html_e|esc_attr__|esc_attr_e)\(\s*([\'"])((?:\\\\.|(?!\1).)*)\1/';

    foreach ($iterator as $file) {
        /** @var SplFileInfo $file */
        if ('php' !== $file->getExtension()) {
            continue;
        }

        $contents = (string) file_get_contents($file->getPathname());

        if (preg_match_all($pattern, $contents, $matches)) {
            foreach ($matches[2] as $string) {
                $strings[ $string ] = true;
            }
        }
    }

    $slug  = (string) $spec['slug'];
    $lines = [
        '# Copyright (C) ' . gmdate('Y') . ' ' . (string) ( $spec['author']['name'] ?? 'AnsariAi' ),
        '# This file is distributed under the GPL-2.0-or-later license.',
        'msgid ""',
        'msgstr ""',
        '"Project-Id-Version: ' . (string) $spec['name'] . ' ' . (string) $spec['version'] . '\\n"',
        '"Content-Type: text/plain; charset=UTF-8\\n"',
        '"Content-Transfer-Encoding: 8bit\\n"',
        '',
    ];

    foreach (array_keys($strings) as $string) {
        $escaped = str_replace('"', '\\"', $string);
        $lines[] = 'msgid "' . $escaped . '"';
        $lines[] = 'msgstr ""';
        $lines[] = '';
    }

    if (! is_dir($outDir . '/languages')) {
        mkdir($outDir . '/languages', 0755, true);
    }

    file_put_contents($outDir . '/languages/' . $slug . '.pot', implode("\n", $lines));
}

if (realpath($argv[0] ?? '') === __FILE__) {
    $specPath = $argv[1] ?? '';

    if ('' === $specPath) {
        fwrite(STDERR, "Usage: php tools/compose.php <path/to/spec.json> [--out=/custom/build/dir]\n");
        exit(1);
    }

    $out = null;

    foreach ($argv as $arg) {
        if (str_starts_with((string) $arg, '--out=')) {
            $out = substr((string) $arg, strlen('--out='));
        }
    }

    try {
        $outDir = wppf_compose($specPath, $out);
        echo "OK: composed plugin into {$outDir}\n";
    } catch (Throwable $exception) {
        fwrite(STDERR, 'FAIL: ' . $exception->getMessage() . "\n");
        exit(1);
    }
}
