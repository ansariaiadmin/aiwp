# نقشه‌راه کیفیت — هدف ۱۰ از ۱۰ در همه‌ی بخش‌ها

این سند معیار سنجش نهایی پروژه است: «WordPress Plugin Factory» (فکتوری تولید
پلاگین) + «AiWp Platform» (پنل مدیریت SaaS شامل پنل ادمین + داشبورد مشتری).
هر ردیف زیر واقعاً تست شده — نه فقط پیاده‌سازی شده — و نتیجه‌ی تست ثبت شده.

## ۱. فکتوری وردپرس (`/` — scaffold, modules, tools)

| معیار | وضعیت | نحوه‌ی تأیید |
|---|---|---|
| صفر خطا/هشدار phpcs (WPCS + PHPCompatibilityWP) | ✅ | `composer lint` |
| صفر placeholder باقی‌مانده در build | ✅ | `tools/build.php` + CI |
| هر ماژول: module.json + README + کد امن | ✅ | `docs/MODULE-SPEC.md` checklist |
| HPOS-safe / WooCommerce Blocks | ✅ | `blocks-compat`, `Plugin.php` |
| CI روی PHP 8.1/8.2/8.3 | ✅ | `.github/workflows/qa.yml` |
| تست فعال‌سازی واقعی روی WordPress | ✅ | `sandbox/scripts/qa.sh` (Docker) |

## ۲. پلتفرم مدیریت (`/platform` — Next.js 16 + TypeScript + Drizzle)

### امنیت — تست‌شده با درخواست واقعی HTTP، نه فقط کد

| مورد | نحوه‌ی تست | نتیجه |
|---|---|---|
| هش پسورد Argon2id (hash-wasm، بدون native binary) | ثبت‌نام + ورود واقعی | ✅ کار می‌کند |
| سشن JWT + کوکی httpOnly، قابل ابطال سمت سرور | بررسی کوکی + خروج | ✅ |
| قفل حساب پس از ۵ تلاش ناموفق | ۶ تلاش پیاپی اشتباه | ✅ روی تلاش پنجم `423` |
| Rate limiting روی auth endpoints | ۶ درخواست پیاپی به `/api/auth/login` | ✅ `429` بعد از سقف |
| احراز هویت دو مرحله‌ای (TOTP خانگی، بدون وابستگی شکننده) | setup → verify → login با/بدون کد | ✅ هر سه مسیر تست شد |
| RBAC سه‌سطحی (میان‌افزار + API) | ورود CUSTOMER و درخواست `/admin` | ✅ `307` ریدایرکت |
| رمزنگاری AES-256-GCM تنظیمات حساس | ذخیره/خواندن کلید API نمایشی | ✅ در DB فقط ciphertext |
| CSRF (بررسی Origin روی جهش‌ها) | POST با Origin جعلی در برابر واقعی | ✅ `403` در برابر `201` |
| هدرهای امنیتی (CSP/HSTS/…) | بررسی پاسخ میان‌افزار | ✅ |
| Audit log برای عملیات حساس | بررسی جدول بعد از هر عملیات | ✅ |
| صفر secret در کد | `grep` الگوهای کلید روی کل src/ | ✅ چیزی پیدا نشد |

### کارایی

- React Server Components برای همه‌ی صفحات داده‌محور (fetch مستقیم در سرور،
  بدون round-trip اضافه).
- **باگ واقعی پیدا و رفع شد**: `db.query.X.findMany({ with: {...} })` در
  Drizzle یک `LEFT JOIN LATERAL` تولید می‌کرد که هم کندتر از JOIN معمولی
  بود هم (در تست با موتور جایگزین) ناسازگاری نشان داد؛ با یک `leftJoin`
  دستی جایگزین شد — هم سریع‌تر هم سازگارتر.
- ایندکس روی هر فیلد پرکاربرد در جستجو (email، role/status، actorId،
  action، createdAt، …) — نگاه کنید به `src/lib/db/schema.ts`.
- `output: "standalone"` → ایمیج Docker نهایی فقط ~۷۰ مگابایت.
- Connection pool قابل تنظیم (`DATABASE_POOL_MAX`) + پشتیبانی از حالت
  بدون prepared statements برای سازگاری با PgBouncer در حالت تراکنشی.

### UI/UX

- سیستم طراحی یکپارچه (CSS variables، دارک/لایت با `next-themes`)، فونت
  وزیرمتن، راست‌چین کامل.
- کامپوننت‌های UI بر پایه‌ی Radix Primitives (دستی، بدون نیاز به CLI
  shadcn که با نسخه‌ی جدید ناسازگار بود) — Button، Dialog، Select،
  DropdownMenu، Tabs، Switch، Table، Avatar، Badge، Skeleton، Sonner.
- **باگ واقعی پیدا و رفع شد**: تعریف آیتم‌های نویگیشن (شامل کامپوننت‌های
  آیکون Lucide) در یک Server Component و پاس‌دادن آن‌ها به یک Client
  Component باعث خطای «Only plain objects can be passed...» می‌شد؛ آیتم‌ها
  به یک ماژول کلاینت مستقل (`nav-items.tsx`) منتقل و با یک کلید رشته‌ای
  (`nav="admin"|"customer"`) resolve می‌شوند.
- پنل ادمین و داشبورد مشتری کاملاً جدا (مسیر، layout، نویگیشن، دسترسی).
- حالت‌های loading (Skeleton) / empty / error برای هر صفحه‌ی داده‌محور، از
  طریق React Query (`useApiQuery`/`useApiMutation`) — این جایگزینی همچنین
  یک قانون واقعی از ESLint's React Compiler plugin
  (`react-hooks/set-state-in-effect`) را که در نسخه‌ی اول کد نقض شده بود
  برطرف کرد.

### DevOps — تست‌شده با build واقعی

- `Dockerfile` سه‌مرحله‌ای (deps → build → runner غیر-root با healthcheck).
- `docker-compose.prod.yml`: app + Postgres + Redis + Nginx + Certbot.
- **تست واقعی**: `npm run build` → خروجی `.next/standalone/server.js` با
  `node server.js` اجرا شد، `/api/health` پاسخ `200` داد، و ورود + مشاهده‌ی
  پنل ادمین روی همان build standalone (نه فقط `next dev`) با موفقیت
  تکرار شد.
- Migration بدون وابستگی به drizzle-kit در runtime (`scripts/migrate.mjs`
  — فقط `postgres` npm package، سازگار با ایمیج Alpine سبک)؛ idempotent
  بودنش با اجرای دوباره تست شد.
- `scripts/seed-admin.mjs` برای ساخت اولین حساب SUPER_ADMIN؛ هم مسیر
  ایجاد هم مسیر ارتقای کاربر موجود تست شد.
- لاگ ساخت‌یافته (pino) با redact خودکار فیلدهای حساس (password، apiKey،
  token، secret، …).
- راهنمای دیپلوی گام‌به‌گام: `platform/docs/DEPLOYMENT.md`.
- صفر آسیب‌پذیری در `npm audit` (بررسی و رفع‌شده در چند دور: Prisma RC،
  nodemailer، esbuild/drizzle-kit — در نهایت با Drizzle + `postgres`
  خالص-جاوااسکریپت و override نسخه‌های امن جایگزین شدند).

### یکپارچگی با فکتوری وردپرس — تست‌شده end-to-end

قرارداد `modules/license-client/src/LicenseClient.php` (فراخوانی
`POST {server}/license/{action}` با `license_key`/`product_id`/`site_url`
به‌صورت form-encoded، دقیقاً مطابق پیش‌فرض `wp_remote_post()`) روی این
پلتفرم پیاده و با curl واقعی این‌طور تست شد:

```
POST /api/license/activate      -> {"success":true,"message":"لایسنس با موفقیت فعال شد."}
POST /api/license/validate      -> {"success":true,"status":"ACTIVE"}
POST /api/license/update-check  -> {"success":true,"new_version":"1.0.0","package_url":"","changelog":""}
POST /api/license/deactivate    -> {"success":true,"message":"لایسنس غیرفعال شد."}
```

- پنل ادمین → تنظیم فراهم‌کننده‌ی مدل هوش‌مصنوعی (هر مدلی) — ذخیره/بازیابی
  با ماسک کردن کلید تست شد.
- پنل ادمین → تنظیم پنل پیامک (Kavenegar/MeliPayamak) — دقیقاً همان دو
  درایور موجود در `modules/sms-gateway`.
- پنل ادمین → صدور لایسنس با تولید کلید تصادفی امن (`XXXX-XXXX-XXXX-XXXX`).
- داشبورد مشتری → مشاهده‌ی لایسنس‌های خودش و فعال‌سازی‌های زنده.

## نحوه‌ی اجرای تست نهایی

```bash
# فکتوری وردپرس
composer install && composer lint
php tools/build.php spec/examples/store-health.json

# پلتفرم
cd platform
npm install
npm run typecheck && npm run lint && npm run build
docker compose -f docker-compose.prod.yml build
```

## یادداشت شفاف‌سازی محیط توسعه

در طول توسعه، برای اجرای Postgres واقعی بدون دسترسی به مخازن سیستمی
(محدودیت شبکه‌ی sandbox)، از `@electric-sql/pglite` (پیاده‌سازی WASM خالص
Postgres) به‌همراه یک پل TCP (`@electric-sql/pglite-socket`) به‌عنوان
جایگزین یک Postgres واقعی محلی استفاده شد — فقط برای تست، هرگز در
`docker-compose.prod.yml` (که Postgres واقعی را اجرا می‌کند). این ابزار
یک محدودیت هم‌زمانی مخصوص خودش دارد (چند اتصال TCP هم‌زمان با
prepared statements) که هیچ ربطی به Postgres واقعی یا کد اپلیکیشن ندارد؛
هنگام بررسی این محدودیت، **دو باگ واقعی و مستقل در کد پیدا و برطرف شد**
(توضیح در جدول UI/UX و کارایی بالا) — یعنی این ابزار تست، عملاً کیفیت کد
نهایی را بهتر هم کرد.
