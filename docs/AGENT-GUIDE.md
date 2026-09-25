# Agent Guide — generating a new plugin

This is the exact, minimal recipe an AI agent (or a human) follows to ship a
new WordPress plugin from this factory. **Nothing in `scaffold/` or
`modules/` should ever need to change** to ship a new plugin. If you find
yourself wanting to edit those directories for a one-off plugin need, stop —
that need almost always belongs in a new module (see
`docs/MODULE-SPEC.md`) or a small glue class (see step 4 below), not a
one-off scaffold edit.

## Step 1 — Pick modules, don't write code

Read `docs/ARCHITECTURE.md`'s module list and each `modules/<id>/README.md`
to see what's already available:

| Module            | Use it when the plugin needs to...                                   |
|--------------------|------------------------------------------------------------------------|
| `settings-page`    | (almost always) a Settings quick-link + reset action                  |
| `scheduler`        | run anything on a recurring/async schedule                            |
| `db-table`         | store its own structured data (not WooCommerce orders)                |
| `rest-api`         | expose a `/wp-json/<slug>/v1/...` endpoint                             |
| `blocks-compat`    | integrate with WooCommerce Cart/Checkout Blocks                       |
| `sms-gateway`      | send SMS via Kavenegar or MeliPayamak                                 |
| `email-notify`     | send templated HTML email                                              |
| `csv-export`       | offer a CSV download                                                   |
| `cron-report`      | a recurring "generate + deliver a report" job (needs `scheduler`)     |
| `license-client`   | require a paid license key, deliver private updates                    |

Only list the modules you actually need in the spec's `"modules"` array —
`tools/compose.php` automatically pulls in anything a module's
`module.json#requires` lists, and the built ZIP only contains the modules
you selected (plus their dependencies).

## Step 2 — Write the spec

Create `spec/<slug>.json` (or hand it to `tools/build.php` from anywhere —
it doesn't have to live under `spec/`). Follow
`spec/plugin-spec.schema.json` exactly; `spec/examples/store-health.json` is
a complete, realistic reference. The required top-level keys are:

```json
{
  "slug": "kebab-case-plugin-slug",
  "name": "Human Plugin Name",
  "namespace": "VendorName\\PluginName",
  "prefix": "vendor_pn",
  "textDomain": "kebab-case-plugin-slug",
  "version": "1.0.0",
  "modules": ["settings-page", "..."]
}
```

Add `requires.php` / `requires.wp` / `requires.woo` if the plugin needs a
newer baseline than the defaults (PHP 8.1, WP 6.5). Add `license` only if
the plugin should be a paid/licensed product (this pulls in the
`license-client` module automatically — you still need to list
`"license-client"` in `modules`).

`options` becomes the plugin's Settings screen fields — every option a spec
declares is automatically rendered, sanitized, and readable via
`{{NAMESPACE}}\Settings::get('key')` at runtime with zero extra code.
Each option may set `"tab"` (default `"general"`); unknown tab ids get their
own tab automatically, title-cased from the id. To give a custom tab a nicer
label, filter `{{PREFIX}}_settings_tab_labels` (`tab id => label`) from glue
code or a module. Modules can also append their own fields to the shared
screen via the `{{PREFIX}}_settings_fields` filter instead of registering a
separate admin page.

## Step 3 — Describe custom logic in `features`, don't hand-write hooks yet

The `features` array is natural-language only — it does not affect
`tools/compose.php`'s output. It exists so a human reviewer (or a later
agent pass) understands *intent* before glue code gets written. Example:

```json
"features": [
  "Once a day, collect order count/revenue for the last 24h... using the email-notify module...",
  "Expose a read-only REST endpoint at /wp-json/<slug>/v1/summary..."
]
```

## Step 4 — Write the glue class (only if a spec's `features` need real logic)

Most specs need a tiny bit of logic that doesn't belong in any reusable
module: e.g. "compute these specific WooCommerce metrics". This goes in
**one file outside `scaffold/` and `modules/`**, following this pattern:

1. Create `glue/<slug>/Glue.php` (anywhere outside `scaffold/`/`modules/` —
   a sibling `glue/` directory at the repo root is the convention; it is
   never scanned by `tools/compose.php` automatically, see step 5).
2. Namespace it `{spec.namespace}\Glue`, e.g. `AnsariAi\StoreHealth\Glue`.
3. Hook the module extension points documented in each module's README
   (`{{PREFIX}}_report_data`, `{{PREFIX}}_rest_routes`, etc) — never touch
   `scaffold/` or `modules/` files directly.
4. Reference it from the spec via `"glueClass": "Glue"` (optional metadata
   field, informational — see step 5 for how it actually gets included).

**Important**: `tools/compose.php` does not currently auto-discover a
`glue/` directory (there is no per-plugin custom code in this factory by
design — see `docs/ARCHITECTURE.md`). If a spec truly needs custom glue
code beyond what a new/existing module can express, the correct move is
almost always to add it as a proper new module (step 6) so it stays
testable, documented, and reusable. Reserve inline "glue" for genuinely
one-off, non-reusable business logic and add it as a tiny extra module
(`modules/<slug>-glue/`) selected only by that one spec — this keeps the
one-module-per-concern contract intact and requires zero special-casing in
`tools/compose.php`.

## Step 5 — Build it

```bash
composer install          # once, to fetch phpcs + WPCS + PHPCompatibility
php tools/validate.php spec/<slug>.json   # optional: fast pre-check
php tools/build.php spec/<slug>.json
```

`tools/build.php` runs, in order:

1. **validate** — spec schema + module existence/requires/conflicts.
2. **compose** — copies scaffold + selected modules into `/build/<slug>/`,
   resolves every `{{PLACEHOLDER}}`, generates `src/autoload.php`,
   `src/module-manifest.php`, `composer.json`, and `languages/<slug>.pot`.
3. **PHP syntax check** — every composed `.php` file must parse.
4. **lint** — the composed output is linted against a plain
   WordPress-Core + WordPress-Extra + PHPCompatibilityWP ruleset (no
   template-specific exclusions — this is the same bar a hand-written
   plugin must clear).
5. **zip** — `/build/<slug>-<version>.zip`, ready to upload to WordPress.

If any step fails, **no ZIP is produced**. Fix the spec (or, if the failure
is inside a module, fix the module — see `docs/MODULE-SPEC.md`) and re-run.

## Step 6 — (Only if no existing module fits) add a new module

```bash
php tools/new-module.php <module-id> "<Human Name>"
```

Fill in the generated `module.json`, `src/<EntryClass>.php`, and
`README.md` following `docs/MODULE-SPEC.md`'s checklist exactly (ABSPATH
guard, nonce+capability on writes, sanitize/escape, `wc_get_orders()` for
any WooCommerce order access). Run `composer lint` before using it in a
spec — modules ship inside every plugin that selects them, so they are held
to the same WordPress Coding Standards bar as the scaffold.

## Step 7 — Verify end-to-end (optional but recommended before shipping)

```bash
# Local sandbox (requires Docker):
sandbox/scripts/qa.sh build/<slug>-<version>.zip
```

This spins up disposable WordPress + MariaDB containers, installs and
activates the ZIP, runs `wp plugin check` if available, and tears itself
down — giving a PASS/FAIL summary without touching any real site.

## What an agent must NOT do

- Edit files under `scaffold/` or `modules/` to satisfy a single plugin's
  one-off requirement — add/extend a module instead (step 6), or accept a
  small glue module (step 4).
- Hardcode the plugin's namespace/prefix/slug anywhere outside the spec
  JSON — every generated file must derive those from `{{PLACEHOLDER}}`
  tokens resolved by `tools/compose.php`.
- Commit secrets (API keys, license tokens) anywhere. Runtime secrets are
  entered by the site owner through the generated Settings screen and
  stored in `wp_options`; document any required constant in the plugin's
  own `.env.example`-style note only if a constant-based override is
  offered (see `license-client`'s README for the pattern).
- Skip `composer lint` / `php tools/build.php` before considering a plugin
  "done" — a spec is not finished until `tools/build.php` produces a ZIP.
