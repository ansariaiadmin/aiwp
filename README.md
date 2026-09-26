<div align="center">

# AnsariAiWP — WordPress Plugin Factory

[![Build](https://github.com/ansariaiadmin/aiwp/actions/workflows/qa.yml/badge.svg?branch=main)](https://github.com/ansariaiadmin/aiwp/actions/workflows/qa.yml)
[![Tests](https://img.shields.io/badge/tests-75%20passing-brightgreen)](tools/tests)
[![PHP](https://img.shields.io/badge/PHP-%3E%3D8.1-777BB4?logo=php&logoColor=white)](https://www.php.net/)
[![WordPress](https://img.shields.io/badge/WordPress-6.0%2B-21759B?logo=wordpress&logoColor=white)](https://wordpress.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Made by [Mohammad Ansari](https://ansariai.ir)** · Telegram [@ansariaiadmin](https://t.me/ansariaiadmin) · © 2026 AnsariAi — attribution must be preserved

<table width="100%"><tr><td align="left" width="50%">🇮🇷 <b>فارسی</b> ← ستون چپ / Left column</td><td align="right" width="50%"><b>English</b> → ستون راست / Right column 🇬🇧</td></tr></table>

</div>

<table width="100%"><tr>

<td width="50%" valign="top" dir="rtl" align="right">

### 🇮🇷 معرفی (فارسی)

**AnsariAiWP** یک «کارخانه افزونه» است: شما یک فایل JSON ساده (حدود ۳۰ خط) می‌نویسید و کارخانه یک افزونه وردپرس کامل، امن و قابل نصب تحویل می‌دهد — بدون حتی یک خط کدنویسی PHP.

**با دانش معمولی چه می‌توانید بسازید؟**
- ✅ افزونه سلامت‌سنج سایت (نمره ۰ تا ۱۰۰ + گزارش هفتگی ایمیلی)
- ✅ افزونه پشتیبان‌گیری هوشمند (زمان‌بندی خودکار + هشدار)
- ✅ فرم تماس، خبرنامه، قفل امنیتی لاگین، پاکسازی دیتابیس
- ✅ داشبورد مدیریتی و ابزار گزارش‌گیری CSV

**نصب در ۱ دقیقه (بدون دانش فنی):**

```bash
git clone https://github.com/ansariaiadmin/aiwp.git
cd aiwp && chmod +x install.sh && ./install.sh
```

فقط همین! سپس آدرسی که نمایش داده می‌شود را در مرورگر باز کنید.

**راهنمای کامل فارسی:** [docs/INSTALL-FA.md](docs/INSTALL-FA.md) · [USER_GUIDE_FA.md](docs/USER_GUIDE_FA.md)

**دستورات روزمره:**

| دستور | کار |
|---|---|
| `./update.sh` | آپدیت خودکار با بکاپ + بازگشت امن |
| `./status.sh` | وضعیت سرویس‌ها |
| `./logs.sh` | مشاهده لاگ‌ها |
| `./stop.sh` | توقف کامل |

**ماژول‌های آماده (ترکیبی انتخاب کنید):**

| ماژول | کاربرد |
|---|---|
| `settings-page` | صفحه تنظیمات گرافیکی |
| `health-scan` | اسکنر سلامت سایت با نمره‌دهی Pro |
| `backup-alert` | نگهبان پشتیبان‌گیری Pro |
| `rest-api` | رابط برنامه‌نویسی امن |
| `db-table` | جدول دیتابیس + مخزن داده |
| `scheduler` | کارهای زمان‌بندی‌شده |
| `csv-export` | خروجی اکسل/CSV |
| `email-notify` | ارسال ایمیل امن |

**حمایت مالی:** هر دونیت = شارژ API و ساخت پروژه‌های جدید، رایگان برای همه؛ من چیزی برای خودم نمی‌خواهم. جزئیات: [DONATE.md](DONATE.md) 💛

**حق تألیف:** © ۲۰۲۶ محمد انصاری — در صورت فورک کردن، حفظ نام سازنده و لینک [ansariai.ir](https://ansariai.ir) الزامی است. اطلاعات بیشتر: [ABOUT.md](ABOUT.md)

</td>

<td width="50%" valign="top" dir="ltr" align="left">

### 🇬🇧 Overview (English)

**AnsariAiWP** is a spec-driven *plugin factory*: write one small JSON file (~30 lines) and it generates a complete, secure, production-grade WordPress plugin — no PHP coding required. It also ships a full SaaS license platform (admin + customer dashboards sharing one API).

**What can a non-technical user build?**
- ✅ Site health scanner (0–100 score + weekly email reports)
- ✅ Smart backup guardian (adaptive scheduling + alerts)
- ✅ Contact forms, newsletters, login hardening, DB cleanup
- ✅ Admin dashboards & CSV reporting tools

**Install in 1 minute (no technical skills needed):**

```bash
git clone https://github.com/ansariaiadmin/aiwp.git
cd aiwp && chmod +x install.sh && ./install.sh
```

That's it — open the printed URL in your browser.

**Full English guide:** [INSTALL.md](INSTALL.md) · [USER_GUIDE_EN.md](docs/USER_GUIDE_EN.md)

**Everyday commands:**

| Command | What it does |
|---|---|
| `./update.sh` | Auto-update with backup + safe rollback |
| `./status.sh` | Service health check |
| `./logs.sh` | View logs |
| `./stop.sh` | Stop everything |

**Ready-made modules (mix & match):**

| Module | Purpose |
|---|---|
| `settings-page` | Graphical settings screen |
| `health-scan` | Pro site-health scanner with scoring |
| `backup-alert` | Pro smart backup guardian |
| `rest-api` | Secure REST endpoints |
| `db-table` | DB table + typed repository |
| `scheduler` | Background jobs (Action Scheduler) |
| `csv-export` | Excel/CSV export |
| `email-notify` | Safe wp_mail wrapper |

**Example spec — this becomes a real plugin:**

```json
{
  "slug": "my-crm",
  "version": "1.0.0",
  "modules": ["settings-page", "db-table", "rest-api"],
  "db_tables": {
    "contacts": {"columns": {"id": "BIGINT AUTO_INCREMENT", "phone": "VARCHAR(20)"}}
  }
}
```

```bash
php tools/build.php spec/my-crm.json
# => build/my-crm-1.0.0.zip ready for wp-admin upload
```

**Quality guarantees:** every generated file enforces `ABSPATH` guards, nonce + capability checks, `sanitize_*`/`esc_*`, `$wpdb->prepare()`, WPCS 3.x zero errors. **75/75 tests passing.** CI runs on PHP 8.1/8.2/8.3.

**Support this project:** every donation = API credits + new free projects for everyone. Details: [DONATE.md](DONATE.md) 💛

**Attribution:** © 2026 Mohammad Ansari — forks must keep the author name and the [ansariai.ir](https://ansariai.ir) link. More: [ABOUT.md](ABOUT.md)

</td>

</tr></table>

---

<div align="center">

## 📚 Documentation / مستندات

<table width="100%"><tr>
<td width="50%" valign="top" dir="rtl" align="right"><b>فارسی</b><br>
<a href="docs/INSTALL-FA.md">راهنمای نصب</a> · <a href="docs/USER_GUIDE_FA.md">راهنمای کاربری</a> · <a href="CHANGELOG.md">تغییرات نسخه‌ها</a></td>
<td width="50%" valign="top" dir="ltr" align="left"><b>English</b><br>
<a href="INSTALL.md">Install Guide</a> · <a href="docs/USER_GUIDE_EN.md">User Guide</a> · <a href="CHANGELOG.md">Changelog</a></td>
</tr></table>

**Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · **Module spec:** [docs/MODULE-SPEC.md](docs/MODULE-SPEC.md) · **License:** [MIT](LICENSE) © 2026 Mohammad Ansari

</div>
