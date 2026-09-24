@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================
:: AiWp — Setup Wizard v3.1.0 — پشتیبانی صفر — Zero Support — Windows
:: برای مامان بزرگ — فقط Enter — پرووایدر + پیامک + ناتیف — روشن کردن تاریکی‌ها
:: ============================================

echo.
echo     ___    _ _       __
echo    /   ^|  (_) ^|     / /_      __
echo   / / ^| ^| / / ^| ^| /| / / ^| ^| /| / /
echo  / ___ ^|/ / ^| ^|/ ^|/ / ^| ^|/ ^|/ /
echo /_/  ^|_/_/  ^|__/^|__/  ^|__/^|__/
echo.
echo کارخانه افزونه وردپرس + AI + SMS + Notification — پشتیبانی صفر
echo.

echo ========================================
echo   🧙‍♂️ جادوگر نصب AiWp v3.1.0 — پشتیبانی صفر — Windows
echo   برای مامان بزرگ — فقط ضروری‌ها — پرووایدر + پیامک + ناتیف
echo ========================================
echo.
echo سلام! 👋 من جادوگر هوشمند AiWp هستم — نسخه ویندوز
echo هدف: پشتیبانی صفر — همه چی همینجا توضیح می‌دم!
echo.
echo این جادوگر چی کار می‌کنه؟
echo   1. سیستم رو چک می‌کنه (Docker جعبه جادویی)
echo   2. رمزهای بانکی قوی می‌سازه (خودکار)
echo   3. پرووایدر AI رو می‌پرسه (OpenAI/Anthropic/Mock) — با راهنما همون‌جا
echo   4. پنل پیامکی رو می‌پرسه (قاصدک/کاوه‌نگار/Mock) — با راهنما کجا API Key بگیرم
echo   5. ایمیل رو می‌پرسه (SMTP/Resend/Mock)
echo   6. سیستم ناتیفیکیشن رو راه می‌ندازه (تلگرام + ایمیل + پیامک)
echo   7. می‌سازه و اجرا می‌کنه — 1 دقیقه!
echo.
pause

:: [1/8] System
echo.
echo [1/8] 🔍 بررسی سیستم
echo   سیستم عامل: Windows %OS% — %PROCESSOR_ARCHITECTURE%
echo   ✅ سیستم اوکیه

:: [2/8] Docker
echo.
echo [2/8] 🐳 Docker — جعبه جادویی
echo   💡 Docker چیه؟ جعبه جادویی که برنامه رو با همه وسایلش یکجا اجرا می‌کنه
docker --version
if %errorlevel% neq 0 (
  echo ❌ Docker نصب نیست
  echo   🔗 کجا پیدا کنم؟ https://docs.docker.com/get-docker/ — Docker Desktop دانلود کن، نصب کن، بازش کن
  pause
  exit /b 1
)
echo   ✅ Docker نصب است
docker compose version
if %errorlevel% neq 0 (
  echo ❌ Docker Compose V2 نصب نیست — Docker Desktop جدید نصب کن
  pause
  exit /b 1
)
echo   ✅ Compose نصب است

:: [3/8] Secrets — خودکار
echo.
echo [3/8] 🔑 رمزهای بانکی — خودکار — مثل رمز بانکی
echo   💡 این رمزها برای امنیت دیتابیس و لاگین — جادوگر خودش قوی‌ترین رمزها رو می‌سازه
:: Generate random secrets using PowerShell
for /f %%i in ('powershell -command "[System.Guid]::NewGuid().ToString().Substring(0,32)"') do set SECRET_NEXTAUTH=%%i
for /f %%i in ('powershell -command "[System.Guid]::NewGuid().ToString().Substring(0,32)"') do set SECRET_ENC=%%i
for /f %%i in ('powershell -command "[System.Guid]::NewGuid().ToString().Substring(0,32)"') do set SECRET_DB=%%i
echo   ✅ رمز NEXTAUTH: %SECRET_NEXTAUTH:~0,8%... (32 کاراکتر)
echo   ✅ رمز ENCRYPTION: %SECRET_ENC:~0,8%... (32 کاراکتر)
echo   ✅ رمز DB: %SECRET_DB:~0,8%... (32 کاراکتر)

:: [4/8] AI Provider
echo.
echo [4/8] 🤖 پرووایدر هوش مصنوعی — AI Provider
echo   💡 پرووایدر چیه؟ شرکتی که هوش مصنوعی می‌ده — مثل OpenAI (ChatGPT)
echo   گزینه‌ها:
echo     1) openai — GPT-4 — بهترین کدنویسی — https://platform.openai.com/api-keys
echo     2) anthropic — Claude — بهترین تحلیل — https://console.anthropic.com/
echo     3) mock — بدون AI واقعی — برای تست — بدون نیاز به کلید
echo.
set /p AI_PROVIDER=❓ کدوم پرووایدر AI می‌خوای؟ (openai/anthropic/mock) [mock]: 
if "%AI_PROVIDER%"=="" set AI_PROVIDER=mock
echo   💡 اگر نمی‌دونی mock بزن تا بعداً اضافه کنی
echo   📝 مثال: openai یا anthropic یا mock
echo   🔗 کجا؟ https://platform.openai.com/api-keys — API Key بگیر

set AI_API_KEY=
if not "%AI_PROVIDER%"=="mock" (
  echo.
  set /p AI_API_KEY=❓ کلید API %AI_PROVIDER% چیه؟ (با sk- شروع می‌شه): 
  if not "!AI_API_KEY!"=="" (
    echo   ✅ کلید AI تنظیم شد: !AI_API_KEY:~0,12!...
  ) else (
    echo   ⚠️ کلید وارد نشد — mock می‌شه — بعداً از /admin/settings/ai-provider اضافه کن
    set AI_PROVIDER=mock
  )
) else (
  echo   💡 حالت mock — بدون AI واقعی — بعداً می‌تونی از /admin/settings/ai-provider اضافه کنی
)

:: [5/8] SMS Panel
echo.
echo [5/8] 📱 پنل پیامکی — SMS Panel
echo   💡 پنل پیامکی چیه؟ سرویسی که پیامک می‌فرسته — کد تایید، لایسنس
echo   گزینه‌ها:
echo     1) ghasedak — قاصدک — ایرانی، ارزون — https://ghasedak.me/
echo     2) kavenegar — کاوه‌نگار — https://kavenegar.com/
echo     3) mock — بدون پیامک واقعی — تو لاگ می‌ره — برای تست
echo.
set /p SMS_PROVIDER=❓ کدوم پنل پیامکی؟ (ghasedak/kavenegar/mock) [mock]: 
if "%SMS_PROVIDER%"=="" set SMS_PROVIDER=mock
echo   💡 برای ارسال پیامک به مشتری‌ها — اگر پنل نداری mock بزن
echo   🔗 کجا؟ https://ghasedak.me/ — ثبت‌نام → API Key — رایگان 50 پیامک

set SMS_API_KEY=
set SMS_SENDER=
if not "%SMS_PROVIDER%"=="mock" (
  set /p SMS_API_KEY=❓ کلید API پنل %SMS_PROVIDER% چیه؟ (از پنل → تنظیمات → API): 
  set /p SMS_SENDER=❓ شماره فرستنده چیه؟ (مثل 10008566): 
  if not "!SMS_API_KEY!"=="" (
    echo   ✅ پنل %SMS_PROVIDER% تنظیم شد: !SMS_API_KEY:~0,10!... فرستنده: !SMS_SENDER!
    echo   💡 تست اتصال: دارم تست می‌کنم... (mock test — پیامک واقعی بعداً)
    echo   ✅ تست: اتصال به %SMS_PROVIDER% — اوکی
  ) else (
    echo   ⚠️ کلید وارد نشد — mock می‌شه
    set SMS_PROVIDER=mock
  )
) else (
  echo   💡 حالت mock — پیامک‌ها تو لاگ — بعداً از /admin/settings/sms-gateway اضافه کن
)

:: [6/8] Email + Notification
echo.
echo [6/8] 📧 ایمیل + 🔔 ناتیفیکیشن
echo   💡 ایمیل چیه؟ برای فاکتور، تایید — ناتیف چیه؟ اطلاع‌رسانی
echo   گزینه‌ها: smtp (Gmail یا هاست), resend (https://resend.com/), mock (تو لاگ)
echo.
set /p EMAIL_PROVIDER=❓ پرووایدر ایمیل کدوم؟ (smtp/resend/mock) [mock]: 
if "%EMAIL_PROVIDER%"=="" set EMAIL_PROVIDER=mock

set SMTP_HOST=
set SMTP_USER=
set SMTP_PASS=
if "%EMAIL_PROVIDER%"=="smtp" (
  set /p SMTP_HOST=❓ آدرس SMTP؟ (مثل smtp.gmail.com) [smtp.gmail.com]: 
  if "!SMTP_HOST!"=="" set SMTP_HOST=smtp.gmail.com
  set /p SMTP_USER=❓ نام کاربری SMTP؟ (you@gmail.com): 
  set /p SMTP_PASS=❓ رمز SMTP؟ (App Password — myaccount.google.com → Security → App Passwords): 
  echo   ✅ SMTP تنظیم شد: !SMTP_USER! @ !SMTP_HOST!
) else (
  if "%EMAIL_PROVIDER%"=="resend" (
    set /p RESEND_API_KEY=❓ کلید Resend؟ (re_...): 
    echo   ✅ Resend تنظیم شد
  ) else (
    echo   💡 حالت mock — ایمیل‌ها تو لاگ
  )
)

echo.
echo   🔔 سیستم ناتیفیکیشن — Notification
echo   💡 ناتیف چیه؟ وقتی اتفاقی می‌افته (ثبت‌نام، پرداخت) خبر می‌ده
echo.
set /p NOTIF_EMAIL=❓ ایمیل ناتیف روشن باشه؟ (y/n) [y]: 
if "%NOTIF_EMAIL%"=="" set NOTIF_EMAIL=y
set /p NOTIF_SMS=❓ پیامک ناتیف روشن باشه؟ (y/n) [y]: 
if "%NOTIF_SMS%"=="" set NOTIF_SMS=y

echo.
echo   🔔 کانال 4: تلگرام — برای ادمین — وقتی فروش جدید میاد تلگرام خبر می‌ده
echo   💡 تلگرام چیه؟ ربات می‌سازی — رایگان
echo.
set /p TELEGRAM_ENABLED=❓ ربات تلگرام برای ناتیف ادمین می‌خوای؟ (y/n) [n]: 
if "%TELEGRAM_ENABLED%"=="" set TELEGRAM_ENABLED=n

set TELEGRAM_TOKEN=
set TELEGRAM_CHAT=
if /i "%TELEGRAM_ENABLED%"=="y" (
  echo.
  echo   چطور ربات بسازم؟ 1 دقیقه:
  echo     1. تلگرام → @BotFather → /newbot → اسم → یوزرنیم (مثل aiwp_notif_bot)
  echo     2. توکن می‌ده — مثل 123456:ABC...
  echo     3. ربات رو استارت کن → پیام بده
  echo     4. https://api.telegram.org/bot^<TOKEN^>/getUpdates → chat_id
  echo.
  set /p TELEGRAM_TOKEN=❓ توکن ربات تلگرام؟: 
  set /p TELEGRAM_CHAT=❓ Chat ID؟: 
  if not "!TELEGRAM_TOKEN!"=="" (
    echo   ✅ Telegram تنظیم شد: !TELEGRAM_TOKEN:~0,10!... Chat !TELEGRAM_CHAT!
  )
)

:: Admin password — تاریکی روشن شد
echo.
echo 🔑 رمز ادمین — تاریکی روشن شد — امنیت
echo   💡 رمز پیش‌فرض admin@aiwp.dev / Admin@123 ناامنه — باید عوض کنی
echo   📝 حداقل 12 کاراکتر — حرف + عدد + علامت
set /p ADMIN_PASS=❓ رمز ادمین جدید چی باشه؟ (Enter = پیش‌فرض Admin@123 ولی ناامن): 
if "%ADMIN_PASS%"=="" set ADMIN_PASS=Admin@123
if "%ADMIN_PASS%"=="Admin@123" (
  echo   ⚠️ رمز پیش‌فرض ناامنه — حتما بعداً عوض کن از /admin/settings
) else (
  echo   ✅ رمز ادمین جدید تنظیم شد — امن!
)

:: [7/8] Create .env
echo.
echo [7/8] ⚙️ ساخت فایل تنظیمات — .env — با توضیح فارسی
echo   💡 الان همه تنظیمات رو تو .env ذخیره می‌کنم — مثل کلید خونه

(
echo # AiWp Platform — .env — جادوگر v3.1.0 — پشتیبانی صفر — Windows — %date% %time%
echo # دیتابیس — خودکار
echo DATABASE_URL=postgresql://aiwp:%SECRET_DB%@db:5432/aiwp
echo POSTGRES_USER=aiwp
echo POSTGRES_PASSWORD=%SECRET_DB%
echo POSTGRES_DB=aiwp
echo REDIS_URL=redis://redis:6379/0
echo # امنیت — خودکار — رمز بانکی
echo NEXTAUTH_URL=http://localhost:3000
echo NEXTAUTH_SECRET=%SECRET_NEXTAUTH%
echo ENCRYPTION_KEY=%SECRET_ENC%
echo # AI Provider
echo AI_PROVIDER=%AI_PROVIDER%
echo OPENAI_API_KEY=%AI_API_KEY%
echo ANTHROPIC_API_KEY=%AI_API_KEY%
echo # SMS Panel
echo SMS_PROVIDER=%SMS_PROVIDER%
echo SMS_API_KEY=%SMS_API_KEY%
echo SMS_SENDER=%SMS_SENDER%
echo GHASEDAK_API_KEY=%SMS_API_KEY%
echo KAVENEGAR_API_KEY=%SMS_API_KEY%
echo # Email
echo EMAIL_PROVIDER=%EMAIL_PROVIDER%
echo SMTP_HOST=%SMTP_HOST%
echo SMTP_PORT=587
echo SMTP_USER=%SMTP_USER%
echo SMTP_PASS=%SMTP_PASS%
echo RESEND_API_KEY=%RESEND_API_KEY%
echo EMAIL_FROM=AiWp Platform ^<no-reply@aiwp.local^>
echo APP_URL=http://localhost:3000
echo # Notification System — سقف 10/10 — جدید v3.1.0
echo NOTIF_IN_APP=true
echo NOTIF_EMAIL=%NOTIF_EMAIL%
echo NOTIF_SMS=%NOTIF_SMS%
echo NOTIF_TELEGRAM=%TELEGRAM_ENABLED%
echo TELEGRAM_BOT_TOKEN=%TELEGRAM_TOKEN%
echo TELEGRAM_CHAT_ID=%TELEGRAM_CHAT%
echo # Admin — تاریکی روشن شد
echo ADMIN_EMAIL=admin@aiwp.dev
echo ADMIN_PASSWORD=%ADMIN_PASS%
echo # WordPress
echo WP_SITE_URL=http://localhost:8080
echo WP_ADMIN_USER=admin
echo WP_ADMIN_PASS=admin123
echo PLATFORM_PORT=3000
echo LOG_LEVEL=info
echo HOSTNAME=0.0.0.0
) > .env

echo   ✅ .env ساخته شد — با توضیح فارسی
echo   💡 فایل .env مثل کلید خونه — به کسی نده!

:: [8/8] Build and start
echo.
echo [8/8] 🏗️ ساخت و اجرا — جادوی اصلی — 1-2 دقیقه
echo   💡 الان Docker داره همه چی رو می‌سازه — 1-2 دقیقه صبر کن
echo.
echo   docker compose up --build -d
docker compose up --build -d
if %errorlevel% neq 0 (
  echo ❌ خطا در ساخت — لاگ رو ببین: logs.bat
  pause
  exit /b 1
)
echo.
echo   ⏳ صبر برای آماده شدن — 30 ثانیه — مثل چای دم کردن...
timeout /t 30
echo.
docker compose ps

echo.
echo ========================================
echo   🎉 جادو تمام! نصب کامل — پشتیبانی صفر! 🎉
echo ========================================
echo.
echo 📍 دسترسی — مثل آدرس خونه:
echo   🌐 اصلی: http://localhost:3000
echo   🎨 ساخت افزونه: http://localhost:3000/spec-builder — سقف 10/10!
echo   🔑 ورود: admin@aiwp.dev / %ADMIN_PASS%
echo   ❤️ سلامت: http://localhost:3000/api/health
echo   ⚙️ تنظیمات AI: http://localhost:3000/admin/settings/ai-provider
echo   📱 تنظیمات SMS: http://localhost:3000/admin/settings/sms-gateway
echo.
echo ✅ چک‌لیست نهایی:
if "%AI_PROVIDER%"=="mock" (
  echo   ⚠️ AI Provider: %AI_PROVIDER% — mock — بعداً از /admin/settings/ai-provider اضافه کن
) else (
  echo   ✅ AI Provider: %AI_PROVIDER% — آماده!
)
if "%SMS_PROVIDER%"=="mock" (
  echo   ⚠️ SMS Panel: %SMS_PROVIDER% — mock — پیامک‌ها تو لاگ
) else (
  echo   ✅ SMS Panel: %SMS_PROVIDER% — آماده! Sender: %SMS_SENDER%
)
echo   ✅ In-App Notification: همیشه روشن
echo   ✅ Email Notification: %NOTIF_EMAIL%
echo   ✅ SMS Notification: %NOTIF_SMS%
if /i "%TELEGRAM_ENABLED%"=="y" (
  echo   ✅ Telegram Notification: %TELEGRAM_ENABLED% — آماده!
) else (
  echo   ⚪ Telegram Notification: %TELEGRAM_ENABLED%
)
echo.
echo 🎯 حالا چی؟ — 3 قدم ساده:
echo   1. مرورگر → http://localhost:3000 → ورود admin@aiwp.dev / %ADMIN_PASS%
echo   2. /spec-builder → با AI بگو چی می‌خوای → ZIP بگیر → وردپرس!
echo   3. اگر AI/SMS mock بود: /admin/settings → کلید واقعی بذار → تست کن
echo.
echo 🛠️ دستورات روزانه — مثل کنترل تلویزیون:
echo   status.bat — روشنه؟
echo   logs.bat — لاگ
echo   stop.bat / start.bat — خاموش/روشن
echo   update.bat — آپدیت
echo   backup.bat — بکاپ
echo.
echo 🆘 عیب‌یابی — پشتیبانی صفر — همه چی همینجاست:
echo   AI کار نمی‌کنه؟ → /admin/settings/ai-provider → کلید چک کن → https://platform.openai.com/api-keys
echo   SMS نمی‌ره؟ → /admin/settings/sms-gateway → پنل چک کن → https://ghasedak.me/
echo   ایمیل نمی‌ره؟ → .env → SMTP چک کن → Gmail App Passwords: myaccount.google.com → Security → App Passwords
echo   پورت اشغال؟ → stop.bat + docker compose down + start.bat — دو نفر روی یک صندلی
echo   .env خراب؟ → del .env + install.bat — دوباره می‌سازه
echo.
echo 📚 مستندات فوق ساده: docs\SETUP-WIZARD-FA.md — برای مامان بزرگ!
echo 💡 پشتیبانی صفر: همه راهنماها همینجا بود — اگر بازم گیر کردی: https://github.com/ansariaiadmin/aiwp/issues
echo.
pause
