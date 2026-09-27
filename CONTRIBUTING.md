# Contributing — aiwp

Thanks for taking a look! This repo has two products in one:

1. **The factory** (`tools/`, `scaffold/`, `modules/`, `spec/`) — dependency-free PHP 8.1+ CLI.
2. **The platform** (`platform/`) — Next.js 16 + Drizzle + Postgres license server.

## Quick start (factory)

```bash
git clone https://github.com/ansariaiadmin/aiwp.git && cd aiwp
composer install                 # phpcs + WPCS + PHPCompatibility
composer lint                    # must be 0 errors
php tools/tests/run-tests.php    # must be 0 failures
php tools/build.php spec/examples/store-health.json   # end-to-end build
```

No PHP? The factory also runs through the bundled WebAssembly runner — see
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Quick start (platform)

```bash
cd platform
npm ci && npm run typecheck && npm run lint
npm test                         # 234 tests
npm run build                    # standalone production bundle
```

Local dev against a database: `docker compose up -d` from the repo root, then
`docker compose exec platform node scripts/migrate.mjs`. Full setup:
[INSTALL.md](INSTALL.md).

## PR guidelines

- **Tests must be green** — factory `run-tests.php` and platform `npm test`, both 0 failures.
- **Lint must be clean** — `composer lint` (WPCS 3.x + PHPCompatibilityWP) and `npm run lint` (ESLint), 0 errors.
- **Add a regression test for every bug fix.** The last audit
  ([docs/AUDIT-2026-09-27.md](docs/AUDIT-2026-09-27.md)) lives in this repo precisely so fixes are pinned by tests.
- Update `CHANGELOG.md`; update `ROADMAP.md` when scope changes.
- Put the evidence in the PR description: the command you ran and its output.
- No secrets in the diff (scan below).

## Code quality rules

- PHP: WordPress Coding Standards + PHP 8.1+ syntax. No `shell_exec()` in the
  hot path — the factory must also run in the sandboxed WebAssembly runner.
- TypeScript: strict mode, no `any` in `src/lib` without a comment explaining why.
- Money is integers in the smallest currency unit — never floats (see `platform/src/lib/money.ts`).
- Every user-facing string that crosses a trust boundary is escaped/sanitized on both sides.
- Secrets (API keys, tokens) are AES-256-GCM encrypted at rest and masked in API responses —
  keep it that way.

## Secret scan (run before pushing)

```bash
grep -r -E "sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|(api_key|password|secret)\s*[=:]\s*['\"][A-Za-z0-9]{16,}" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=build . || echo "0 secrets found"
```

## Releases

- Maintainer tags: `git tag v<version> && git push origin v<version>`
- GitHub Release with the changelog body.
- Bump `composer.json` (factory) and `platform/package.json` (platform) in the same commit as the tag.

## Reporting problems

- **Security issues: do not open a public issue.** Follow
  [SECURITY.md](SECURITY.md) — responsible disclosure to the maintainer directly.
- Everything else: GitHub Issues, with the output of the failing command.
