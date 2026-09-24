# Architecture

This repository is a **factory**, not a plugin. It never ships an end-user
plugin itself. Instead it turns a small **spec** (`spec/*.json`) into a
complete, installable WordPress plugin ZIP by combining:

1. **`scaffold/`** — the boilerplate every generated plugin shares: the main
   plugin file, activation/deactivation, DB migrations runner, Settings API
   wrapper, asset loader, logger, and the `ModuleInterface` contract.
2. **`modules/`** — independent, opt-in feature units (settings page, cron
   scheduler, DB table, REST API, SMS gateway, etc). A plugin spec picks which
   modules it wants; unused modules are never copied into the build.
3. **`tools/`** — the build pipeline (`validate.php` → `compose.php` →
   `build.php`) that reads a spec, resolves module dependencies, stamps
   placeholders, and produces a signed, versioned ZIP in `/build`.

```
spec/plugin.json ──▶ tools/validate.php ──▶ tools/compose.php ──▶ /build/<slug>/ ──▶ tools/build.php ──▶ /build/<slug>-<version>.zip
                          │                        │
                          │                        ├─ copies scaffold/ (renames *.stub, strips the extension)
                          │                        ├─ copies modules/<id>/src for every module in spec.modules
                          │                        │  (plus transitively-required modules from module.json#requires)
                          │                        ├─ replaces every {{PLACEHOLDER}} token everywhere
                          │                        ├─ generates src/module-manifest.php (module registry)
                          │                        ├─ generates a PSR-4 classmap autoloader (no Composer needed at runtime)
                          │                        ├─ generates composer.json (for IDEs / optional `composer install --no-dev`)
                          │                        ├─ generates readme.txt (WordPress.org format) from readme.txt.stub
                          │                        └─ generates languages/<slug>.pot (strings scraped from built PHP)
                          └─ checks the spec against spec/plugin-spec.schema.json and resolves module requires/conflicts
```

## Runtime shape of a generated plugin

```
<slug>/
├─ <slug>.php                 # Plugin header + `require`s the autoloader + boots Plugin::instance()
├─ uninstall.php              # Guarded by WP_UNINSTALL_PLUGIN, removes options/tables if the user opted in
├─ readme.txt                 # WordPress.org-format readme, generated from spec metadata
├─ src/
│  ├─ autoload.php            # Generated PSR-4 classmap autoloader ({{NAMESPACE}}\ => src/)
│  ├─ module-manifest.php     # Generated array: module id => FQCN, + spec-driven options/settings tabs
│  ├─ Plugin.php              # Container/bootstrap: builds + registers + boots every enabled module
│  ├─ Activator.php           # register_activation_hook / register_deactivation_hook, capability + version checks
│  ├─ Installer.php           # dbDelta-based migrations, schema version option
│  ├─ Settings.php            # Settings API wrapper (tabs, sanitize callbacks)
│  ├─ Assets.php               # Versioned wp_enqueue_* helpers, admin-only unless a module opts into front-end
│  ├─ Logger.php               # PSR-3-ish logger writing to a private option/table, never to error_log with secrets
│  ├─ Contracts/ModuleInterface.php
│  ├─ Support/Guard.php        # nonce / capability / sanitize helpers shared by every module
│  └─ Modules/<ModuleName>/... # one namespaced folder per selected module
└─ languages/<slug>.pot
```

## The module lifecycle

Every module implements `{{NAMESPACE}}\Contracts\ModuleInterface`:

```php
interface ModuleInterface {
    public function id(): string;          // stable id, matches module.json "id"
    public function requirements(): array; // ['php' => '8.1', 'wp' => '6.5', 'woo' => '9.0', ...]
    public function register(): void;      // add_action/add_filter/register_* calls ONLY — cheap, idempotent
    public function boot(): void;          // logic that may depend on other modules already being registered
}
```

`Plugin::boot()` (in `scaffold/src/Plugin.php.stub`) does, in order, for every
module listed in the generated `module-manifest.php`:

1. Instantiate the module class.
2. Evaluate `requirements()`. If unmet (PHP/WP/WooCommerce version, a missing
   dependency module, etc), the module is skipped and an admin notice is
   queued — the whole plugin never fatals because one module can't run.
3. Call `register()` on every satisfied module (hook registration phase).
4. Call `boot()` on every satisfied module (cross-module logic phase).

This two-phase split lets, for example, `cron-report` safely assume the
`scheduler` module has already registered its Action Scheduler hooks by the
time `boot()` runs.

## Placeholders

Every scaffold and module file is a **template**. Tokens are plain
`{{UPPER_SNAKE}}` strings, resolved once by `tools/compose.php` from the spec:

| Token                | Source                                   | Example                     |
|----------------------|-------------------------------------------|------------------------------|
| `{{SLUG}}`            | `spec.slug`                              | `store-health`               |
| `{{SLUG_UNDERSCORE}}` | `spec.slug` with `-` → `_`               | `store_health`               |
| `{{NAMESPACE}}`       | `spec.namespace`                         | `AnsariAi\StoreHealth`       |
| `{{PLUGIN_NAME}}`     | `spec.name`                              | `Store Health Assistant`     |
| `{{PREFIX}}`          | `spec.prefix`                            | `ansariai_sh`                |
| `{{PREFIX_UPPER}}`    | `strtoupper(spec.prefix)`                | `ANSARIAI_SH`                |
| `{{TEXT_DOMAIN}}`     | `spec.textDomain`                        | `store-health`                |
| `{{VERSION}}`         | `spec.version`                           | `1.0.0`                      |
| `{{DESCRIPTION}}`     | `spec.description` (optional)            | short plugin tagline         |
| `{{AUTHOR_NAME}}`     | `spec.author.name` (optional, default "AnsariAi") | `AnsariAi`         |
| `{{AUTHOR_URI}}`      | `spec.author.uri` (optional)              | `https://ansariaiwp.com`     |
| `{{REQUIRES_PHP}}`    | `spec.requires.php`                       | `8.1`                        |
| `{{REQUIRES_WP}}`     | `spec.requires.wp`                        | `6.8`                        |
| `{{REQUIRES_WOO}}`    | `spec.requires.woo` (optional)            | `9.0`                        |
| `{{LICENSE_ENABLED}}` | `spec.license.enabled` ? `'1'` : `''`     | `1`                           |
| `{{LICENSE_SERVER}}`  | `spec.license.server` (optional)          | `https://ansariaiwp.com/api/v1` |

`tools/compose.php` fails the build (non-zero exit, no ZIP produced) if any
`{{...}}` token remains unresolved anywhere in the composed output — see
`tools/build.php`'s final placeholder scan.

## Why no Composer dependency at plugin runtime

Generated plugins ship a tiny **generated classmap autoloader**
(`src/autoload.php`), not `vendor/autoload.php`. WordPress plugins are
distributed as a single ZIP that a site owner uploads and activates — they
must not need to run `composer install` first. `tools/compose.php` still
emits a `composer.json` in the build for IDE autocompletion and for
maintainers who want to run the dev toolchain (tests, phpcs) against the
composed source, but the runtime `<slug>.php` never requires
`vendor/autoload.php`.

## Background work

The `scheduler` module wraps [Action Scheduler](https://actionscheduler.org/):
when the `action-scheduler/action-scheduler.php` library is loaded (bundled by
WooCommerce, or by the module itself as a bundled fallback copy declared in
`modules/scheduler/module.json`), recurring/async jobs are scheduled through
`as_schedule_recurring_action()` / `as_enqueue_async_action()`. If Action
Scheduler is unavailable for any reason, the module transparently falls back
to `wp_schedule_event()` / `wp_schedule_single_event()` so a generated plugin
never hard-depends on WooCommerce being active just to run background jobs.

## WooCommerce compatibility

Any module touching WooCommerce data:

- Uses `wc_get_orders()` / `WC_Order` CRUD methods — **never** raw `$wpdb`
  queries against `wp_postmeta` or legacy order tables.
- Declares HPOS + Cart/Checkout Blocks compatibility via
  `Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility()`
  on `before_woocommerce_init` (see `scaffold/src/Plugin.php.stub`).

## Security baseline (enforced in every scaffold/module file)

- `if (!defined('ABSPATH')) { exit; }` guard at the top of every PHP file.
- Every state-changing admin action checks a nonce (`check_admin_referer` /
  `wp_verify_nonce`) **and** `current_user_can()` before doing anything.
- All `$_POST`/`$_GET`/`$_REQUEST` input goes through a `sanitize_*` function
  (see `Support/Guard.php.stub` for the shared helpers).
- All dynamic output is escaped with `esc_html()`, `esc_attr()`, `esc_url()`,
  or `wp_kses_post()` as appropriate.
- All raw SQL (only ever used for the module's own custom table, never for
  WooCommerce order/customer data) goes through `$wpdb->prepare()`.
- No secrets are ever committed. Runtime secrets (license keys, SMS gateway
  API keys) are stored in `wp_options` (never plaintext-logged) or read from
  PHP constants defined in `wp-config.php`; `.env.example` documents the
  constants a site owner may define.

See `docs/MODULE-SPEC.md` for the exact contract a module must satisfy and
`docs/AGENT-GUIDE.md` for the step-by-step recipe to generate a new plugin.
