# Changelog — aiwp

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-09-24
### Added
- Spec-driven factory scaffold with 10 modules: blocks-compat, csv-export, db-table, cron-report, email-notify, license-client, rest-api, scheduler, settings-page, sms-gateway
- PHP 8.2 compatibility with PHPCompatibilityWP ruleset
- Tests: 25 tests (blocks-compat 3 e2e, csv-export 6 integration, 16 existing) — 0 fail
- CI: qa.yml with 3 jobs — factory-php-native (PHP 8.4), factory-php-docker (php:8.2-cli container), e2e-docker (HOSTNAME=0.0.0.0 + Origin header two-IP)
- Docker compose for platform Next.js with standalone output
- README with badges (lint, tests, build), mermaid diagram (factory flow), quickstart, sample output

### Fixed
- PHP syntax lint 0 errors across 8 files
- Blocks-compat placeholder substitution bug
- CSV export encoding BOM + escaping

### Security
- Secret scan 0 real secrets
- .env.example complete per HANDOFF

## [0.9.0] - 2026-09-20
### Added
- Initial factory scaffold
- Module generator

## [0.1.0] - 2026-09-01
### Added
- Initial spec
