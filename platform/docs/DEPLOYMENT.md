# راهنمای دیپلوی — AiWp Platform روی سرور واقعی

این راهنما گام‌به‌گام توضیح می‌دهد چطور پلتفرم را روی یک سرور لینوکسی (Ubuntu/Debian)
با Docker بالا بیاورید: اپ Next.js (standalone)، Postgres، Redis، و Nginx با
گواهی TLS رایگان از Let's Encrypt.

## پیش‌نیازها روی سرور

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # سپس یک بار logout/login کنید
```

یک دامنه (یا ساب‌دامنه) که رکورد A آن به IP سرور اشاره کند — مثلاً
`panel.example.com`.

## مرحله ۱ — کلون و تنظیم متغیرهای محیطی

```bash
git clone <repo-url> aiwp && cd aiwp/platform

cp .env.example .env.production
# مقادیر زیر را حتماً با مقادیر واقعی و امن جایگزین کنید:
#   POSTGRES_PASSWORD   -> openssl rand -base64 32
#   REDIS_PASSWORD      -> openssl rand -base64 32
#   SESSION_SECRET      -> openssl rand -base64 48
#   ENCRYPTION_KEY      -> openssl rand -base64 32
#   APP_URL             -> https://panel.example.com
#   DOMAIN              -> panel.example.com
$EDITOR .env.production
```

**هرگز** این فایل را commit نکنید — در `.gitignore` از قبل نادیده گرفته می‌شود.

## مرحله ۲ — تنظیم Nginx (قبل از اولین اجرا)

```bash
cp nginx/conf.d/aiwp.conf.template nginx/conf.d/aiwp.conf
sed -i "s/\${DOMAIN}/panel.example.com/g" nginx/conf.d/aiwp.conf
```

## مرحله ۳ — دریافت اولین گواهی TLS (قبل از روشن کردن کامل استک)

چون Nginx برای پیکربندی HTTPS نیاز به گواهی دارد ولی Certbot برای صدور
گواهی نیاز به یک وب‌سرور در حال اجرا روی پورت ۸۰ دارد، اولین گواهی را
جداگانه می‌گیریم:

```bash
docker compose -f docker-compose.prod.yml up -d postgres redis
docker compose -f docker-compose.prod.yml run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
  -d panel.example.com --email you@example.com --agree-tos --no-eff-email" certbot
```

اگر سرویس nginx هنوز بالا نیست، یک nginx موقت روی پورت ۸۰ فقط برای مسیر
`/.well-known/acme-challenge/` لازم است — ساده‌ترین راه:

```bash
docker compose -f docker-compose.prod.yml up -d nginx
# سپس دستور certbot بالا را دوباره اجرا کنید
```

## مرحله ۴ — Build و اجرای کامل استک

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d postgres redis app nginx certbot
```

## مرحله ۵ — اجرای Migration ها

```bash
docker compose -f docker-compose.prod.yml run --rm migrate
```

این دستور دقیقاً همان SQL تولیدشده توسط `npm run db:generate` (Drizzle) را
با یک اسکریپت سبک و بدون وابستگی به ابزارهای build-time (esbuild/tsx) اجرا
می‌کند — دوباره اجرا کردنش ایمن است (idempotent).

## مرحله ۶ — ساخت اولین حساب ابرمدیر

```bash
docker compose -f docker-compose.prod.yml run --rm seed-admin \
  --email admin@panel.example.com \
  --password "$(openssl rand -base64 24)" \
  --name "مدیر اصلی"
```

رمز عبور تولیدشده را از خروجی دستور یادداشت کنید (فقط همین یک‌بار نمایش
داده می‌شود) و بعد از اولین ورود از صفحه‌ی «امنیت حساب» تغییرش دهید.

## مرحله ۷ — تأیید سلامت سیستم

```bash
curl -s https://panel.example.com/api/health
# {"status":"ok","time":"..."}
```

وارد `https://panel.example.com/login` شوید و با حساب ابرمدیر بالا وارد شوید.

## به‌روزرسانی (Deploy جدید)

```bash
git pull
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.prod.yml up -d app
```

## پشتیبان‌گیری

```bash
# پایگاه داده
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U aiwp aiwp | gzip > backup-$(date +%F).sql.gz

# بازیابی
gunzip -c backup-2026-01-01.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U aiwp aiwp
```

`ENCRYPTION_KEY` را هم جدا و امن نگه دارید (مثلاً در یک secrets manager) —
بدون آن، مقادیر رمزنگاری‌شده‌ی تنظیمات (کلید API هوش مصنوعی، پنل پیامک)
غیرقابل بازیابی هستند حتی با بک‌آپ کامل دیتابیس.

## مقیاس‌پذیری افقی (چند نمونه از app)

اگر بار زیاد شد و خواستید چند container از سرویس `app` اجرا کنید:

1. `REDIS_URL` باید تنظیم شده باشد (از قبل در docker-compose.prod.yml هست)
   تا rate limiting بین همه‌ی نمونه‌ها مشترک باشد.
2. اگر بین اپ و Postgres یک connection pooler (مثل PgBouncer) در حالت
   `transaction` قرار می‌دهید، حتماً `DATABASE_USE_PREPARED_STATEMENTS=false`
   را نگه دارید (مقدار پیش‌فرض) — prepared statementها با pooling در حالت
   تراکنشی سازگار نیستند.
3. `docker compose -f docker-compose.prod.yml up -d --scale app=3` و یک
   load balancer (یا خود Nginix با upstream چندتایی) جلوی آن‌ها.

## عیب‌یابی سریع

| علامت | راه‌حل |
|---|---|
| `docker compose ... run migrate` خطای اتصال می‌دهد | مطمئن شوید `postgres` سرویس healthy است: `docker compose ps` |
| صفحه‌ی ورود بالا می‌آید ولی هیچ ایمیلی نمی‌رسد | `RESEND_API_KEY` را تنظیم کنید؛ بدون آن، ایمیل‌ها فقط در لاگ اپ چاپ می‌شوند |
| گواهی TLS منقضی شده | سرویس `certbot` باید به‌صورت خودکار هر ۱۲ ساعت تلاش برای تمدید کند؛ لاگش را با `docker compose logs certbot` ببینید |
| `ENCRYPTION_KEY` عوض شده و تنظیمات هوش مصنوعی/پیامک کار نمی‌کنند | این طبیعی و از قصد است (امنیتی) — تنظیمات را دوباره از پنل وارد کنید |
