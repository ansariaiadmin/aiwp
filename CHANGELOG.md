# Changelog — AnsariAiWP

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [SemVer](https://semver.org/).

## [v1.0.5] - 2026-09-26 — Clean-Install Hardening

### Fixed
- **docker-compose.yml**: `SESSION_SECRET`/`ENCRYPTION_KEY` now passed to the platform container (fail-fast with a clear message if `.env` is missing) — previously the app crash-looped on boot because `src/lib/env.ts` requires them.
- **.env.example**: rewritten to contain only variables the code actually reads; removed dead vars (`NEXTAUTH_*`, `SMTP_*`, `OPENAI_*`, `WP_ADMIN_*`, `HOSTNAME`) that never existed in the codebase.
- **install.sh**: removed dead conditional branches (`[ "web" = "web" ]`, `"Next.js + PHP" == *Node*`); secrets generated with `openssl rand -hex` (no more `/` corrupting `sed` replacements); added automatic DB migration (`scripts/migrate.mjs`) and admin seeding (`scripts/seed-admin.mjs`) with a random password shown once at the end of install.
- **Docs honesty**: removed the false default credential `admin@aiwp.dev / Admin@123` from INSTALL.md and both user guides — no default password exists by design.
- **CHANGELOG.md**: restored proper Keep-a-Changelog structure (header was buried mid-file).
- **README.md**: title aligned with the AnsariAiWP product name.

## [v1.0.4] - 2026-09-26 — AnsariAiWP Branding · About · Donation System

### Added
- **Product name: AnsariAiWP** — author block + ABOUT.md (author, website ansariai.ir, Telegram @ansariaiadmin, copyright notice kept in forks)
- **DONATE.md**: donation = new projects for everyone — 100% of donations goes to API credits & building new tools, nothing personal (BTC/ETH-TRON/GitHub Sponsors/Pro license)
- README: Author section, Support/Donate section, accurate dual-license statement
- composer.json: `version`, `authors` (Mohammad Ansari), `funding` (GitHub Sponsors + DONATE.md)

### Fixed
- License consistency: LICENSE file is MIT but composer.json declared GPL-2.0-or-later → now MIT (factory) with generated plugins GPL-2.0-or-later (documented)
- LICENSE copyright holder: ansariaiadmin → Mohammad Ansari (ansariai.ir)
- README version header said v1.0.3 while CHANGELOG had no such release → aligned to real releases

## [v1.0.1] - 2026-09-24 - Non-Technical Auto Install + Auto Update Edition

### Added - نصب خودکار برای افراد غیر فنی
- **install.sh**: نصب خودکار تمیز - چک Docker, ساخت .env با رمز تصادفی openssl, docker compose up --build -d, صبر 30s, سلامت چک, نمایش آدرس و رمز ورود
- **update.sh**: آپدیت خودکار - بکاپ به backups/YYYYMMDD-HHMMSS/, git pull origin main, docker compose pull + up --build -d, health check, rollback hint
- **start.sh, stop.sh, status.sh, logs.sh, backup.sh**: دستورات ساده روزانه
- **install.bat, start.bat, stop.bat, status.bat, logs.bat, update.bat, backup.bat**: نسخه ویندوز برای افراد غیر فنی
- **INSTALL.md**: راهنمای کامل فارسی نصب در 3 قدم (<5 دقیقه)
- **docs/USER_GUIDE_FA.md**: آموزش کامل تمام بخش‌ها - داشبورد, تنظیمات .env, Docker چیست, بکاپ, عیب‌یابی, امنیت, ورژن‌ها
- **docs/USER_GUIDE_EN.md**: Full English guide for non-technical
- **README**: بخش جدید "برای افراد غیر فنی / For Non-Technical Users — نصب در 1 دقیقه!" با one-liner

### Fixed
- Clean presentation: حذف cache artifacts, .env فقط .env.example
- Non-technical UX: پیام‌های فارسی + انگلیسی، رنگی، راهنمای قدم به قدم

### Docs
- README badge+mermaid+quickstart+sample output + non-technical section
- INSTALL.md + docs/USER_GUIDE_FA.md + docs/USER_GUIDE_EN.md


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
