# AiWp — WordPress Plugin Factory + Management Platform

This repository has two parts:

1. **The Factory** (this root) — a spec-driven scaffold + module system
   that turns a small JSON file into a complete, production-grade,
   installable WordPress plugin. It never ships an end-user plugin
   itself. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how the
   pieces fit together, [`docs/MODULE-SPEC.md`](docs/MODULE-SPEC.md) for
   the module contract, and [`docs/AGENT-GUIDE.md`](docs/AGENT-GUIDE.md)
   for the exact step-by-step recipe to generate a new plugin (spec only,
   no scaffold/module edits).
2. **[`platform/`](platform/README.md)** — a full SaaS management
   platform (Next.js 16 + TypeScript + Drizzle/PostgreSQL): a complete
   **admin panel** (products, licenses, users, AI provider settings — any
   model/provider — SMS gateway settings, audit log) and a fully separate
   **customer dashboard**, both talking to the exact same license API
   contract that the factory's `license-client` module expects. See
   [`platform/README.md`](platform/README.md) and
   [`platform/docs/DEPLOYMENT.md`](platform/docs/DEPLOYMENT.md) for a
   step-by-step production deployment guide (Docker + Nginx + Let's
   Encrypt).

A line-by-line, test-backed quality checklist for both halves of the
project is in [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Standards this factory enforces on everything it generates

- PHP 8.1+, `declare(strict_types=1)` throughout.
- WordPress Coding Standards (WPCS 3.x) + PHPCompatibilityWP, zero errors.
- Security by default: `ABSPATH` guard in every file, nonce +
  `current_user_can()` on every write action, `sanitize_*` on all input,
  `esc_*` on all output, `$wpdb->prepare()` for any custom SQL.
- WooCommerce: HPOS-safe only (`wc_get_orders()` / CRUD, never direct
  `postmeta`), with `custom_order_tables` + `cart_checkout_blocks`
  compatibility declared automatically via `FeaturesUtil`.
- Background jobs: Action Scheduler when available, wp-cron fallback.
- No secrets committed anywhere; runtime secrets live in `wp_options` (set
  via the generated Settings screen) or optional `wp-config.php` constants
  (see `.env.example`).

## How to generate a plugin

```bash
composer install                              # once: phpcs + WPCS + PHPCompatibility

# 1. Write a spec (see spec/plugin-spec.schema.json + spec/examples/*.json)
cp spec/examples/store-health.json spec/my-plugin.json
$EDITOR spec/my-plugin.json

# 2. (optional) fast pre-check
php tools/validate.php spec/my-plugin.json

# 3. Build: validate -> compose -> PHP syntax check -> lint -> zip
php tools/build.php spec/my-plugin.json

# -> build/<slug>-<version>.zip, ready to upload in wp-admin
```

That's it — no scaffold/module code needs to change to ship a new plugin.
Full recipe, including when (rarely) to add a new module, is in
[`docs/AGENT-GUIDE.md`](docs/AGENT-GUIDE.md).

### Other useful commands

```bash
composer lint          # WPCS + PHPCompatibility across scaffold/, modules/, tools/
composer lint:fix       # auto-fix fixable violations
php tools/new-module.php <module-id> "<Human Name>"   # scaffold a new module
sandbox/scripts/qa.sh build/<slug>-<version>.zip       # install+activate in a disposable WP+MariaDB sandbox
```

## Available modules

| Module | What it does |
|---|---|
| [`settings-page`](modules/settings-page/README.md) | Settings quick-link on the Plugins list + a guarded "reset settings" action. |
| [`scheduler`](modules/scheduler/README.md) | Unified background job API: Action Scheduler when available, wp-cron fallback. |
| [`db-table`](modules/db-table/README.md) | One dbDelta-managed custom table + a small typed, `$wpdb->prepare()`-safe repository. |
| [`rest-api`](modules/rest-api/README.md) | Registers a `{slug}/v1` REST namespace; enforces `permission_callback` on every route. |
| [`blocks-compat`](modules/blocks-compat/README.md) | WooCommerce Cart/Checkout Blocks (Store API) integration point. |
| [`sms-gateway`](modules/sms-gateway/README.md) | Driver-based SMS sending: Kavenegar and MeliPayamak drivers included. |
| [`email-notify`](modules/email-notify/README.md) | Safe `wp_mail()` wrapper: validated recipient, filtered subject/body, forced `wp_kses_post()`. |
| [`csv-export`](modules/csv-export/README.md) | CSV generation + a nonce/capability-guarded download endpoint. |
| [`cron-report`](modules/cron-report/README.md) | Recurring "generate + deliver a report" job (email + CSV snapshot when those modules are present). |
| [`license-client`](modules/license-client/README.md) | Talks to a private ansariaiwp license server: activate/validate/deactivate + private plugin updates. |

Each module folder contains `module.json` (machine-readable manifest),
`src/` (implementation), and `README.md` (options, hooks, example usage).

## Repository layout

```
composer.json / phpcs.xml.dist / .editorconfig / .gitignore   tooling
.github/workflows/qa.yml       CI: PHP 8.1/8.2/8.3 matrix, lint + build smoke test
docs/                          ARCHITECTURE.md, MODULE-SPEC.md, AGENT-GUIDE.md
spec/                          plugin-spec.schema.json + example specs
scaffold/                      boilerplate every generated plugin shares ({{PLACEHOLDER}} templates)
modules/                       opt-in feature units, one per spec's "modules" entry
tools/                         validate.php, compose.php, build.php, new-module.php
sandbox/                       docker-compose.yml (WordPress + MariaDB) + qa.sh smoke test
build/                         (git-ignored) compose/build output
```

## License

GPL-2.0-or-later (see individual generated plugin headers).
