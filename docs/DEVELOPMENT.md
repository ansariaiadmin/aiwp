# Development

Local development for both halves of the repo — the PHP factory and the Next.js
platform — including the no-native-PHP WebAssembly runner.

## 1. The factory (PHP)

### With a native PHP

```bash
composer install
composer lint                    # phpcs (WPCS 3.x + PHPCompatibilityWP) — 0 errors required
php tools/tests/run-tests.php    # 27 tests
php tools/validate.php spec/examples/store-health.json
php tools/build.php spec/examples/store-health.json
```

`tools/build.php` runs the full pipeline: validate → compose → `php -l`
(tokenizer fallback when `shell_exec()` is unavailable) → in-process phpcs on
the composed output → zip.

### Without a native PHP (WebAssembly runner)

Some environments (locked-down CI images, sandboxes without distro repos)
cannot install a `php` binary. The repo ships a runner for exactly that case —
it executes the **same PHP files** against the host filesystem:

```bash
cd tools/php-wasm
npm install
npm test                                  # run-tests.php under php-wasm
node run.mjs ../../tools/validate.php ../../spec/examples/store-health.json
node run.mjs ../../tools/build.php ../../spec/examples/store-health.json
```

Notes:

- The runner disables `shell_exec()`/`proc_open()` via php.ini and the factory
  code takes its documented tokenizer fallback (`tools/build.php:
  wppf_check_syntax()`).
- `composer lint` still needs a native PHP (or CI) — the runner is for
  validate/compose/build/tests, not for the phpcs toolchain itself.
- GitHub Actions (`qa.yml`) is the source of truth: it runs both the native
  PHP 8.4 job and the `php:8.2-cli` Docker job.

## 2. Adding a module

1. `php tools/new-module.php my-module` (or copy an existing `modules/<id>/`).
2. Fill in `module.json` (id, entryClass, hooks, options) + `README.md`.
3. Implement `src/<EntryClass>.php` against `ModuleInterface`
   (`requirements()` / `register()` / `boot()`).
4. Use the shared helpers: `Guard::verify_write()` for every write,
   `Plugin::instance()->module('<id>')` for cross-module access,
   `Logger::` for diagnostics (secrets are auto-redacted).
5. `php tools/build.php <spec-that-includes-it>` must pass end-to-end.

The contract and the placeholder discipline are specified in
[MODULE-SPEC.md](MODULE-SPEC.md).

## 3. The platform (Next.js)

```bash
cd platform
npm ci
npm run dev                        # http://localhost:3000 (uses .env)
npm test                           # vitest, 234 tests, no DB needed
npm run typecheck && npm run lint
```

Database:

- **Full stack:** `docker compose up -d` from the repo root (Postgres 16 + app),
  then `docker compose exec -T platform node scripts/migrate.mjs` and
  `docker compose exec -T platform node scripts/seed-admin.mjs --email admin@local --password '<random>'`.
- **PGlite (no Docker):** `node platform/scripts/dev-pglite-server.mjs` exposes
  an in-process Postgres on TCP for a single developer.
- Migrations are plain SQL in `platform/drizzle/` applied by
  `scripts/migrate.mjs` (tracked in `drizzle.__drizzle_migrations`). Never hand-edit
  an applied migration — add a new numbered one.

Testing conventions:

- Everything network-facing takes an injectable `fetch` (payment gateways, LLM
  providers, the KB crawler) so the suites run offline.
- DB-touching logic is covered by pg-mem tests where possible; the license API
  contract is pinned in `src/lib/__tests__/license-api.test.ts`.

## 4. CI

`qa.yml` runs on every push/PR to `main`:

| Job | What it does |
|---|---|
| `factory-php-native` | PHP 8.4: `composer validate --strict`, `composer lint`, 27 tests |
| `factory-php-docker` | `php:8.2-cli` container: same suite, minimum-PHP boundary |
| `platform` | Node 22: typecheck, ESLint, vitest, standalone build |

`docker-image.yml` builds and pushes the platform image on tags.

## 5. Repo etiquette

See [CONTRIBUTING.md](../CONTRIBUTING.md). Short version: 0 lint errors, 0
test failures, regression test for every fix, evidence (command + output) in
the PR, no secrets, security issues via [SECURITY.md](../SECURITY.md).
