# AiWp Platform

پلتفرم مدیریت SaaS برای فکتوری پلاگین وردپرس AiWp — یک پنل ادمین کامل برای
مدیریت محصولات/لایسنس‌ها/کاربران/تنظیمات، و یک داشبورد مستقل برای مشتریان،
هر دو روی Next.js 16 (App Router)، TypeScript، Drizzle ORM (PostgreSQL) و
یک سیستم طراحی سفارشی راست‌چین.

## ویژگی‌های کلیدی

- **احراز هویت کامل**: ثبت‌نام + تأیید ایمیل، ورود با قفل خودکار پس از
  تلاش ناموفق، بازیابی رمز عبور، احراز هویت دو مرحله‌ای (TOTP، سازگار با
  Google Authenticator)، سشن‌های قابل ابطال (JWT + رکورد سمت سرور).
- **RBAC سه‌سطحی**: `SUPER_ADMIN` / `ADMIN` / `CUSTOMER`، اعمال‌شده هم در
  میان‌افزار (Edge) هم در هر Route Handler/Server Component.
- **پنل ادمین**: محصولات، لایسنس‌ها (صدور/ابطال/مسدودسازی)، کاربران، گزارش
  رویدادها (Audit Log فقط‌خواندنی)، تنظیمات فراهم‌کننده‌ی هوش مصنوعی (هر
  مدلی — OpenAI/Anthropic/Gemini/OpenRouter/سفارشی)، تنظیمات پنل پیامک
  (Kavenegar/MeliPayamak — دقیقاً منطبق با ماژول `sms-gateway` فکتوری
  وردپرس).
- **داشبورد مشتری**: مشاهده‌ی لایسنس‌ها و فعال‌سازی‌ها، دانلود آخرین نسخه،
  امنیت حساب (تغییر رمز، ۲FA)، پروفایل.
- **API لایسنس عمومی**: `/api/license/{activate,deactivate,validate,update-check,info}`
  دقیقاً مطابق قرارداد `modules/license-client/src/LicenseClient.php` در
  فکتوری وردپرس — یک پلاگین وردپرس ساخته‌شده با فکتوری می‌تواند مستقیماً
  به این پلتفرم وصل شود.
- **امنیت درجه‌یک**: Argon2id، AES-256-GCM برای تنظیمات حساس، Rate limiting
  (Redis-ready)، CSRF (بررسی Origin روی جهش‌ها)، CSP/HSTS/… در میان‌افزار،
  Audit log تغییرناپذیر، هیچ secret در کد.

## اجرای محلی

```bash
cp .env.example .env
# مقادیر DATABASE_URL / SESSION_SECRET / ENCRYPTION_KEY را پر کنید

npm install
npm run db:generate      # (فقط اولین بار یا بعد از تغییر schema.ts)
npm run db:migrate:dev   # اجرای migration با drizzle-kit (نیازمند devDependencies)
npm run db:seed-admin -- --email admin@example.com --password 'یک-رمز-قوی' --name "مدیر"
npm run dev
```

سپس به `http://localhost:3000` بروید.

## دستورات مفید

```bash
npm run lint        # ESLint (شامل قوانین React Compiler)
npm run typecheck   # tsc --noEmit
npm run build       # next build (خروجی standalone)
npm run db:generate      # تولید migration جدید از schema.ts
npm run db:migrate:dev   # اجرای migration در محیط توسعه (drizzle-kit)
npm run db:migrate       # اجرای migration در production (بدون وابستگی به drizzle-kit)
npm run db:seed-admin    # ساخت/ارتقای یک حساب SUPER_ADMIN
```

## دیپلوی روی سرور واقعی

راهنمای کامل گام‌به‌گام (Docker + Nginx + Let's Encrypt) در
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## معماری

```
src/
├─ app/                      # صفحات (App Router)
│  ├─ (auth)/                # ورود/ثبت‌نام/بازیابی رمز — layout مشترک
│  ├─ admin/                 # پنل ادمین (نیازمند نقش ADMIN+)
│  ├─ dashboard/             # داشبورد مشتری (نیازمند هر نقشی)
│  └─ api/                   # Route Handlerها
│     ├─ auth/               # ثبت‌نام، ورود، ۲FA، بازیابی رمز
│     ├─ admin/              # محصولات، لایسنس‌ها، کاربران، تنظیمات
│     ├─ customer/           # لایسنس‌های من، امنیت حساب
│     ├─ license/            # API عمومی لایسنس (برای پلاگین وردپرس)
│     └─ health/             # health-check برای Docker/Load Balancer
├─ components/
│  ├─ ui/                    # کامپوننت‌های پایه (دستی، بدون shadcn CLI)
│  └─ shell/                 # پوسته‌ی مشترک پنل (سایدبار، هدر، ...)
├─ lib/
│  ├─ auth/                  # پسورد، سشن، RBAC، TOTP
│  ├─ db/                    # اسکیمای Drizzle + کلاینت
│  ├─ validation/             # اسکیمای Zod
│  ├─ crypto.ts               # رمزنگاری AES-256-GCM برای تنظیمات حساس
│  ├─ rate-limit.ts            # محدودسازی نرخ (حافظه یا Redis)
│  ├─ audit.ts                 # ثبت رویداد
│  ├─ logger.ts                # لاگ ساخت‌یافته (pino) با پنهان‌سازی خودکار secretها
│  └─ settings.ts              # سرویس تنظیمات هوش مصنوعی/پیامک
├─ proxy.ts                    # میان‌افزار Edge: هدرهای امنیتی + RBAC + CSRF
scripts/
├─ migrate.mjs                 # اجرای migration در production (بدون drizzle-kit)
├─ seed-admin.mjs               # ساخت اولین حساب ابرمدیر
└─ dev-pglite-server.mjs        # (فقط توسعه) دیتابیس PGlite بدون نیاز به Postgres واقعی
```
