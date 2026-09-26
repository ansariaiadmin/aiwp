<div dir="rtl">

# AnsariAiWP — کارخانه افزونه وردپرس (راهنمای فارسی)

[![Build](https://github.com/ansariaiadmin/aiwp/actions/workflows/qa.yml/badge.svg?branch=main)](https://github.com/ansariaiadmin/aiwp/actions/workflows/qa.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)

**سازنده: [محمد انصاری](https://ansariai.ir)** · تلگرام [@ansariaiadmin](https://t.me/ansariaiadmin) · © ۲۰۲۶ AnsariAi — حق اثر در تمام فورک‌ها محفوظ است

> نسخه انگلیسی (مستند اصلی): [README.md](../README.md)

---

## TL;DR — این پروژه چیست؟

شما یک فایل JSON ساده (حدود ۳۰ خط) می‌نویسید؛ کارخانه یک **افزونه وردپرس کامل، امن و قابل نصب** تحویل می‌دهد — بدون حتی یک خط کدنویسی PHP. تمام استانداردهای امنیتی (nonce، بررسی سطح دسترسی، پاکسازی داده، prepared statements) به‌صورت خودکار روی کد تولیدشده اعمال می‌شود.

## 🚀 نصب در ۱ دقیقه (بدون دانش فنی)

```bash
git clone https://github.com/ansariaiadmin/aiwp.git
cd aiwp
chmod +x install.sh
./install.sh
```

فقط همین! پس از اتمام، آدرسی که در ترمینال نمایش داده می‌شود را در مرورگر باز کنید و وارد پنل شوید. نام کاربری ادمین و رمز عبور تصادفی همان لحظه در ترمینال به شما نشان داده می‌شود.

## 🛠 چه افزونه‌هایی می‌توانید بسازید؟

| محصول | ماژول‌های مورد نیاز | سختی |
|---|---|---|
| سلامت‌سنج سایت (نمره ۰ تا ۱۰۰ + گزارش هفتگی ایمیلی) | `health-scan`، `email-notify`، `scheduler` | ⭐ فقط یک دستور |
| نگهبان پشتیبان‌گیری هوشمند (زمان‌بندی تطبیقی + اعتبارسنجی) | `backup-alert`، `scheduler` | ⭐ فقط یک دستور |
| فرم تماس، خبرنامه، قفل امنیتی لاگین، پاکسازی دیتابیس | `settings-page`، `db-table`، `rest-api` | ⭐⭐ ویرایش یک JSON |
| داشبورد لایسنس و فروش ووکامرس | `license-client`، `csv-export`، `blocks-compat` | ⭐⭐⭐ spec + پلتفرم Pro |

## 📖 شروع ساخت افزونه (سه مرحله)

1. **یک نمونه بردارید:**
   ```bash
   cp spec/examples/store-health.json spec/my-plugin.json
   ```
2. **فایل را ویرایش کنید:** نام (slug)، نسخه و ماژول‌ها را عوض کنید. راهنمای تصویری هر بخش داخل پنل با دکمه ❓ کنار المان‌ها موجود است.
3. **بیلد بگیرید:**
   ```bash
   php tools/build.php spec/my-plugin.json
   ```
   خروجی: فایل `build/my-plugin-1.0.0.zip` آماده آپلود در پیشخوان وردپرس (افزونه‌ها ← افزودن ← بارگذاری).

## 🧰 ماژول‌های آماده

| ماژول | کاربرد |
|---|---|
| `settings-page` | صفحه تنظیمات + ریست ایمن |
| `scheduler` |_job_های پس‌زمینه (Action Scheduler با fallback به wp-cron) |
| `db-table` | جدول دیتابیس + repository تایپ‌دار |
| `rest-api` | API اختصاصی `{slug}/v1` با محدودسازی نرخ درخواست |
| `sms-gateway` | کاوه‌نگار + ملی‌پیامک |
| `email-notify` | ارسال ایمیل امن (wrapper روی wp_mail) |
| `csv-export` | خروجی CSV با دانلود محافظت‌شده |
| `cron-report` | گزارش دوره‌ای + ایمیل/CSV |
| `health-scan` | پرو: موتور امتیازدهی، روند ۳۰ روزه، رفع خودکار |
| `backup-alert` | پرو: زمان‌بندی تطبیقی، اعتبارسنجی یکپارچگی، نگهداری نسخه |
| `license-client` | ارتباط با سرور لایسنس + آپدیت امضاشده |
| `blocks-compat` | سازگاری با بلوک‌های ووکامرس |

## 🔐 امنیت

هر افزونه تولیدشده این موارد را رعایت می‌کند: گارد `ABSPATH`، بررسی nonce و سطح دسترسی در نوشتن‌ها، `sanitize_*`/`esc_*`، `$wpdb->prepare()`، استاندارد WPCS بدون خطا، سازگاری HPOS ووکامرس، Rate Limiting روی REST و پاکسازی کامل هنگام حذف (uninstall.php).

## 📚 مستندات بیشتر

| سند | مخاطب |
|---|---|
| [USER_GUIDE_FA.md](USER_GUIDE_FA.md) | آموزش تصویری گام‌به‌گام |
| [INSTALL-FA.md](INSTALL-FA.md) | نصب و راه‌اندازی |
| [ARCHITECTURE.md](ARCHITECTURE.md) | مهندسان (انگلیسی) |
| [../ABOUT.md](../ABOUT.md) · [../DONATE.md](../DONATE.md) | درباره سازنده و حمایت مالی |

## 💛 حمایت از پروژه

هر دونیت = شارژ API و ساخت پروژه‌های جدید، رایگان برای همه. جزئیات و آدرس کیف پول: **[DONATE.md](../DONATE.md)** ☕

## 📄 لایسنس

- **کارخانه و پلتفرم AnsariAiWP:** MIT © ۲۰۲۶ محمد انصاری — حفظ حق اثر الزامی است.
- **افزونه‌های تولیدشده:** GPL-2.0-or-later (الزام وردپرس دات اورگ؛ در تمام فایل‌های تولیدی اعمال می‌شود).

</div>
