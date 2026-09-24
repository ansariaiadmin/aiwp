# Module Spec — how to write (or generate) a module

A module is a self-contained, independently-testable feature unit that lives
in `modules/<module-id>/`. This document is the exact contract
`tools/compose.php`, `tools/validate.php`, and `tools/new-module.php` expect.
Follow it exactly and a module "just works" when referenced from a plugin
spec's `modules` array.

## Folder layout

```
modules/<module-id>/
├─ module.json          # required — machine-readable manifest, see schema below
├─ README.md            # required — human docs: what it does, options, example usage
└─ src/
   └─ *.php             # required — namespaced {{NAMESPACE}}\Modules\<StudlyModuleId>\...
```

`<module-id>` is `kebab-case` (e.g. `settings-page`, `sms-gateway`).
`<StudlyModuleId>` is its StudlyCaps form (e.g. `SettingsPage`, `SmsGateway`) —
`tools/compose.php` derives it automatically; module source files must use
the literal placeholder token `{{NAMESPACE}}\Modules\<StudlyModuleId>` in
their `namespace` declaration (with `<StudlyModuleId>` written out literally,
NOT as a placeholder, since it is fixed per-module).

## `module.json` schema

```jsonc
{
  "id": "scheduler",                     // required, kebab-case, matches folder name
  "name": "Background Scheduler",        // required, human label
  "version": "1.0.0",                    // required, semver of the module itself
  "description": "Action Scheduler wrapper with wp-cron fallback.",
  "requires": [],                        // optional, array of other module ids that must be composed first
  "conflicts": [],                       // optional, array of module ids that cannot be selected together
  "hooks": {                             // optional, documentation only — what the module wires up
    "actions": ["init", "{{PREFIX}}_run_report"],
    "filters": ["{{PREFIX}}_scheduler_interval"]
  },
  "options": [                           // optional, wp_options this module reads/writes
    { "key": "{{PREFIX}}_scheduler_last_run", "type": "string", "default": "" }
  ],
  "placeholders": [                      // optional, extra placeholder tokens this module needs beyond
    "SLUG"                               // the standard set (compose.php always provides the standard set)
  ],
  "entryClass": "Scheduler",             // required, class name (without namespace) implementing ModuleInterface
  "capabilities": ["manage_options"],    // optional, capabilities this module's actions require
  "woo": false                           // optional, true if this module touches WooCommerce and must only
                                          // run when WooCommerce is active (checked via requirements())
}
```

Rules enforced by `tools/validate.php`:

- `id` must equal the folder name.
- `entryClass` must exist at `src/<entryClass>.php` and declare a class
  literally named `<entryClass>` implementing `ModuleInterface`.
- `requires` must reference module ids that exist in `modules/`.
- `requires`/`conflicts` are resolved transitively: selecting a module in a
  spec's `modules` array automatically pulls in everything it `requires`;
  selecting two modules that mutually `conflicts` fails validation.

## The module class contract

```php
<?php

declare(strict_types=1);

namespace {{NAMESPACE}}\Modules\Scheduler;

use {{NAMESPACE}}\Contracts\ModuleInterface;

if (!defined('ABSPATH')) {
    exit;
}

final class Scheduler implements ModuleInterface
{
    public function id(): string
    {
        return 'scheduler';
    }

    /**
     * Return unmet-requirement messages, or an empty array when all
     * requirements are satisfied. Never throw; the factory scaffold
     * treats a non-empty return as "skip this module, show an admin notice".
     */
    public function requirements(): array
    {
        $unmet = [];

        if (version_compare(PHP_VERSION, '8.1', '<')) {
            $unmet[] = 'PHP 8.1+ is required.';
        }

        return $unmet;
    }

    /**
     * Hook registration ONLY. Must be idempotent and cheap — this runs on
     * every request. Do not query the database or WooCommerce here.
     */
    public function register(): void
    {
        add_action('init', [$this, 'schedule_recurring_job']);
    }

    /**
     * Cross-module logic. Runs after every enabled module has had register()
     * called, so it is safe to assume other modules' hooks are wired up.
     */
    public function boot(): void
    {
        // Optional: nothing needed for most modules.
    }

    public function schedule_recurring_job(): void
    {
        // ...
    }
}
```

## Security checklist for every module (enforced by code review / phpcs, not automatable 100%)

- [ ] `if (!defined('ABSPATH')) { exit; }` at the top of every PHP file.
- [ ] Every admin-facing form/AJAX/REST write path calls
      `{{NAMESPACE}}\Support\Guard::verify_nonce()` and
      `{{NAMESPACE}}\Support\Guard::current_user_can()` (see
      `scaffold/src/Support/Guard.php.stub`) before mutating anything.
  - [ ] Every input read from `$_POST`/`$_GET`/`$_REQUEST`/REST params is
      passed through an explicit `sanitize_*`/`absint`/`floatval` call —
      never used raw.
- [ ] Every value echoed into HTML/attributes/URLs uses `esc_html()`,
      `esc_attr()`, `esc_url()`, or `wp_kses_post()`.
- [ ] Any custom SQL (only ever for a module's own table, e.g. `db-table`)
      uses `$wpdb->prepare()` — never string-concatenated.
- [ ] Any WooCommerce order access uses `wc_get_orders()` /
      `wc_get_order()` / `WC_Order` setters+`save()` — never
      `$wpdb->query()` against `wp_postmeta`/`wp_posts` for order data.
- [ ] No `error_log()`/`var_dump()`/`print_r()` of API keys, tokens,
      passwords, or PII. Use `{{NAMESPACE}}\Logger` which redacts known
      secret option keys.
- [ ] No hardcoded credentials. Secrets come from `wp_options` (set via an
      admin settings screen using the `Settings` scaffold) or PHP constants
      documented in the root `.env.example`.
- [ ] Background jobs longer than a single request go through the
      `scheduler` module (Action Scheduler with wp-cron fallback), never a
      blocking `sleep()`/long-running request.

## Adding module-specific placeholder tokens

If a module needs a token beyond the standard set documented in
`docs/ARCHITECTURE.md#placeholders`, declare it in `module.json`'s
`placeholders` array and provide its value via the plugin spec's `options`
(or a small glue class — see `docs/AGENT-GUIDE.md`). `tools/compose.php`
resolves module-specific placeholders the same way as standard ones and
`tools/build.php` fails the build if any remain unresolved.

## Module README.md

Each module's `README.md` must document, at minimum:

1. **What it does** — one paragraph.
2. **Options** — every `wp_options` key it reads/writes, with type and
   default.
3. **Hooks** — actions/filters it fires or listens to, for other modules or
   glue code to extend.
4. **Example usage** — a short spec snippet (`"modules": ["this-module-id"]`)
   and, if relevant, a glue-code example.

## Scaffolding a new module

Run:

```bash
php tools/new-module.php <module-id> "<Human Name>" [entryClass]
```

This creates `modules/<module-id>/{module.json,README.md,src/<EntryClass>.php}`
pre-filled with the boilerplate above so contributors only fill in the
actual logic — never re-derive the contract by hand.
