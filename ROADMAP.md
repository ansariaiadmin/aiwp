# ROADMAP — aiwp

## Done (v1.0.0)
- Spec-driven scaffold + module system (blocks-compat, csv-export, db-table, cron-report, email-notify, license-client, rest-api, scheduler, settings-page, sms-gateway)
- Composer validate --strict + lint (php -l + phpcs WPCS + PHPCompatibilityWP) — 0 errors
- Tests: 25 PHP tests (16 original + 9 new: blocks-compat e2e 3, csv-export integration 6) — all green
- CI: qa.yml with native PHP 8.4 + docker php:8.2-cli stage + e2e docker stage (HOSTNAME=0.0.0.0 + Origin header + two IPs login flow)
- Docker: platform Next.js build standalone
- Security: secret scan 0 real, .env.example complete
- Docs: README with badges, mermaid, quickstart, sample output
- Release: v1.0.0 tag + GitHub Release

## v2 (Explicit — No Hidden Gaps)
- **E2E real WordPress**: Full WordPress + WooCommerce integration test with real DB, not just factory compose
- **BlocksCompat real Store API**: Test with actual WooCommerce Blocks (ExtendSchema) — currently only hooks + placeholder substitution tested, real Blocks rendering needs WC Blocks env
- **CSV Export large files**: Streaming for >100k rows with chunked file handles, currently tested up to small/medium
- **License server e2e**: Real HTTP call to license server with signed payloads
- **i18n**: POT file generation e2e with real WordPress i18n extraction
- **Why v2**: Requires WordPress + WooCommerce runtime, not available in bare php-cli CI

## Next Steps
- Add phpunit with WP test lib for deeper integration
- Add GitHub Pages demo
