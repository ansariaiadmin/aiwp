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
