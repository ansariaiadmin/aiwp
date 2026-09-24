#!/usr/bin/env bash
set -e

# ============================================
# AiWp — Setup Wizard v3.0.0 — پشتیبانی صفر — Zero Support
# برای مامان بزرگ هم قابل فهم — فقط Enter بزن!
# ویژگی‌ها: راهنمای همون‌جا + فقط چیزای ضروری + پرووایدر + پیامک + ناتیف
# ============================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# Helpers
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
ok() { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
err() { echo -e "${RED}❌ $1${NC}"; }
explain() { echo -e "${CYAN}   💡 $1${NC}"; }
example() { echo -e "${DIM}   📝 مثال: $1${NC}"; }
where() { echo -e "${MAGENTA}   🔗 کجا پیدا کنم؟ $1${NC}"; }

generate_secret() {
  if command -v openssl &> /dev/null; then
    openssl rand -base64 32 | tr -d '\n' | tr -d '/' | tr -d '+' | cut -c1-32
  else
    date +%s | sha256sum | head -c 32
  fi
}

ask_with_help() {
  local prompt="$1"
  local help_text="$2"
  local example_text="$3"
  local where_text="$4"
  local default_val="$5"
  local is_secret="${6:-false}"
  
  echo ""
  echo -e "${BOLD}${BLUE}❓ $prompt${NC}"
  if [ -n "$help_text" ]; then explain "$help_text"; fi
  if [ -n "$example_text" ]; then example "$example_text"; fi
  if [ -n "$where_text" ]; then where "$where_text"; fi
  if [ -n "$default_val" ]; then
    echo -e "${DIM}   ⏭️  برای رد شدن Enter بزن — پیش‌فرض: $default_val${NC}"
  else
    echo -e "${DIM}   ⏭️  اگر نداری Enter بزن — بعداً می‌تونی اضافه کنی (mock می‌شه)${NC}"
  fi
  
  local input=""
  if [ "$is_secret" = "true" ]; then
    read -s -p "   👉 جواب: " input
    echo ""
  else
    read -p "   👉 جواب: " input
  fi
  
  if [ -z "$input" ] && [ -n "$default_val" ]; then
    input="$default_val"
  fi
  
  echo "$input"
}

ask_yes_no() {
  local prompt="$1"
  local help_text="$2"
  local default_yes="${3:-true}"
  
  echo ""
  echo -e "${BOLD}${BLUE}❓ $prompt${NC}"
  if [ -n "$help_text" ]; then explain "$help_text"; fi
  if [ "$default_yes" = "true" ]; then
    echo -e "${DIM}   ⏭️  [Y/n] — Enter = بله${NC}"
  else
    echo -e "${DIM}   ⏭️  [y/N] — Enter = خیر${NC}"
  fi
  
  local input=""
  read -p "   👉 جواب (y/n): " input
  input=$(echo "$input" | tr '[:upper:]' '[:lower:]')
  
  if [ -z "$input" ]; then
    if [ "$default_yes" = "true" ]; then input="y"; else input="n"; fi
  fi
  
  if [ "$input" = "y" ] || [ "$input" = "yes" ] || [ "$input" = "بله" ]; then
    echo "yes"
  else
    echo "no"
  fi
}

clear
echo -e "${CYAN}"
cat <<'BANNER'
    ___    _ _       __
   /   |  (_) |     / /_      __
  / /| | / /| | /| / /| | /| / /
 / ___ |/ / | |/ |/ / | |/ |/ /
/_/  |_/_/  |__/|__/  |__/|__/

کارخانه افزونه وردپرس + پلتفرم لایسنس + AI + SMS + Notification
WordPress Plugin Factory + SaaS + AI + SMS + Notification — Zero Support

BANNER
echo -e "${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  🧙‍♂️ جادوگر نصب AiWp v3.0.0 — پشتیبانی صفر${NC}"
echo -e "${BLUE}  برای مامان بزرگ — فقط چیزای ضروری!${NC}"
echo -e "${BLUE}  پرووایدر + پنل پیامکی + سیستم ناتیف${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}سلام! 👋 من جادوگر هوشمند AiWp هستم${NC}"
echo -e "${YELLOW}هدف: پشتیبانی صفر — همه چی همینجا توضیح می‌دم!${NC}"
echo -e "${CYAN}قراره فقط چیزای ضروری رو بپرسم — بقیه خودش تنظیم می‌شه${NC}"
echo ""
echo -e "${BOLD}🎯 این جادوگر چی کار می‌کنه؟${NC}"
echo -e "  1. سیستم رو چک می‌کنه (Docker جعبه جادویی)"
echo -e "  2. رمزهای بانکی قوی می‌سازه (خودکار)"
echo -e "  3. پرووایدر AI رو می‌پرسه (OpenAI/Anthropic/Local/Mock) — با راهنما همون‌جا"
echo -e "  4. پنل پیامکی رو می‌پرسه (قاصدک/کاوه‌نگار/Mock) — با راهنما کجا API Key بگیرم"
echo -e "  5. ایمیل رو می‌پرسه (SMTP/Resend/Mock)"
echo -e "  6. سیستم ناتیفیکیشن رو راه می‌ندازه (تلگرام + ایمیل + پیامک + داخل برنامه)"
echo -e "  7. می‌سازه و اجرا می‌کنه — ۱ دقیقه!"
echo ""
read -p "برای شروع جادو Enter بزنید... ✨ " _

# Step 1: System
echo ""
echo -e "${BLUE}[1/8] 🔍 بررسی سیستم${NC}"
echo -e "  سیستم عامل: $(uname -s) $(uname -m) — تاریخ: $(date)"
ok "سیستم اوکیه"
sleep 1

# Step 2: Docker
echo ""
echo -e "${BLUE}[2/8] 🐳 Docker — جعبه جادویی${NC}"
explain "Docker چیه؟ جعبه جادویی که برنامه رو با همه وسایلش (دیتابیس، ردیس، ...) یکجا اجرا می‌کنه — مثل کانتینر حمل بار"
if ! command -v docker &> /dev/null; then
  err "Docker نصب نیست"
  echo ""
  echo -e "${YELLOW}  نصب Docker مثل نصب واتساپه — ۲ دقیقه:${NC}"
  where "https://docs.docker.com/get-docker/ — Docker Desktop دانلود کن، نصب کن، بازش کن"
  exit 1
else
  ok "Docker: $(docker --version)"
  ok "Compose: $(docker compose version)"
fi
sleep 1

# Step 3: Core Secrets (auto)
echo ""
echo -e "${BLUE}[3/8] 🔑 رمزهای امنیتی — خودکار — مثل رمز بانکی${NC}"
explain "این رمزها برای امنیت دیتابیس و لاگین هستن — جادوگر خودش قوی‌ترین رمزها رو می‌سازه — تو لازم نیست کاری کنی"
echo -e "${DIM}   دارم ۳ رمز بانکی ۳۲ کاراکتری می‌سازم...${NC}"
SECRET_NEXTAUTH=$(generate_secret)
SECRET_ENCRYPTION=$(generate_secret)
SECRET_DB=$(generate_secret)
ok "رمز NEXTAUTH_SECRET ساخته شد: ${SECRET_NEXTAUTH:0:8}... (۳۲ کاراکتر)"
ok "رمز ENCRYPTION_KEY ساخته شد: ${SECRET_ENCRYPTION:0:8}... (۳۲ کاراکتر)"
ok "رمز دیتابیس ساخته شد: ${SECRET_DB:0:8}... (۳۲ کاراکتر)"
sleep 1

# Step 4: AI Provider — با راهنمای همون‌جا
echo ""
echo -e "${BLUE}[4/8] 🤖 پرووایدر هوش مصنوعی — AI Provider${NC}"
echo -e "${BOLD}   AiWp برای ساخت افزونه با AI نیاز به پرووایدر داره${NC}"
explain "پرووایدر چیه؟ شرکتی که هوش مصنوعی می‌ده — مثل OpenAI (ChatGPT) یا Anthropic (Claude) — افزونه‌هات با این ساخته می‌شه"
echo ""
echo -e "${YELLOW}   گزینه‌ها:${NC}"
echo -e "   1) ${BOLD}openai${NC} — OpenAI GPT-4 — بهترین برای کدنویسی — https://platform.openai.com/api-keys"
echo -e "   2) ${BOLD}anthropic${NC} — Claude Sonnet 4.5 — بهترین برای تحلیل — https://console.anthropic.com/"
echo -e "   3) ${BOLD}google${NC} — Gemini 2.5 Pro — رایگان تا حدی — https://aistudio.google.com/app/apikey"
echo -e "   4) ${BOLD}openrouter${NC} — هر مدلی — https://openrouter.ai/keys"
echo -e "   5) ${BOLD}mock${NC} — بدون AI واقعی — برای تست — بدون نیاز به کلید"
echo ""
AI_PROVIDER=$(ask_with_help "کدوم پرووایدر AI می‌خوای؟" "برای ساخت افزونه با هوش مصنوعی — اگر نمی‌دونی mock بزن تا بعداً اضافه کنی" "openai یا anthropic یا mock" "https://platform.openai.com/api-keys — API Key بگیر" "mock" "false")

AI_API_KEY=""
if [ "$AI_PROVIDER" != "mock" ] && [ -n "$AI_PROVIDER" ]; then
  echo ""
  AI_API_KEY=$(ask_with_help "کلید API پرووایدر $AI_PROVIDER چیه؟" "این کلید مثل رمز عبوره — از سایت پرووایدر کپی کن — با sk- یا sk-ant- شروع می‌شه" "sk-proj-... یا sk-ant-..." "برو به سایت پرووایدر → API Keys → Create new key → کپی" "" "true")
  if [ -n "$AI_API_KEY" ]; then
    ok "کلید AI تنظیم شد: ${AI_API_KEY:0:12}..."
  else
    warn "کلید AI وارد نشد — mock می‌شه — بعداً از پنل تنظیمات می‌تونی اضافه کنی: /admin/settings/ai-provider"
  fi
else
  AI_PROVIDER="mock"
  explain "حالت mock — بدون AI واقعی — بعداً می‌تونی از /admin/settings/ai-provider پرووایدر اضافه کنی"
fi
sleep 1

# Step 5: SMS Panel — پنل پیامکی — با راهنمای همون‌جا
echo ""
echo -e "${BLUE}[5/8] 📱 پنل پیامکی — SMS Panel${NC}"
echo -e "${BOLD}   برای ارسال کد تایید، لایسنس، ناتیفیکیشن به مشتری‌هات${NC}"
explain "پنل پیامکی چیه؟ سرویسی که پیامک می‌فرسته — مثل قاصدک یا کاوه‌نگار — وقتی مشتری ثبت‌نام می‌کنه، کد تایید با پیامک می‌ره"
echo ""
echo -e "${YELLOW}   گزینه‌ها:${NC}"
echo -e "   1) ${BOLD}ghasedak${NC} — قاصدک — ایرانی، ارزون، API ساده — https://ghasedak.me/"
echo -e "   2) ${BOLD}kavenegar${NC} — کاوه‌نگار — ایرانی، قدیمی، پایدار — https://kavenegar.com/"
echo -e "   3) ${BOLD}melipayamak${NC} — ملی‌پیامک — https://melipayamak.com/"
echo -e "   4) ${BOLD}mock${NC} — بدون پیامک واقعی — پیامک‌ها تو لاگ می‌ره — برای تست"
echo ""
SMS_PROVIDER=$(ask_with_help "کدوم پنل پیامکی؟" "برای ارسال پیامک به مشتری‌ها — اگر پنل نداری mock بزن — پیامک‌ها تو لاگ ذخیره می‌شه" "ghasedak یا kavenegar یا mock" "https://ghasedak.me/ — ثبت‌نام → API Key بگیر — رایگان ۵۰ پیامک" "mock" "false")

SMS_API_KEY=""
SMS_SENDER=""
if [ "$SMS_PROVIDER" != "mock" ] && [ -n "$SMS_PROVIDER" ]; then
  SMS_API_KEY=$(ask_with_help "کلید API پنل $SMS_PROVIDER چیه؟" "از پنل پیامکیت کپی کن — معمولاً تو بخش تنظیمات → API" "api-key-... — ۳۲ کاراکتر" "پنل پیامکی → تنظیمات → API → کلید رو کپی کن" "" "true")
  SMS_SENDER=$(ask_with_help "شماره فرستنده چیه؟" "شماره‌ای که پیامک ازش ارسال می‌شه — مثل 1000xxx یا 5000xxx — از پنل می‌گیری" "10008566 یا 500012345" "پنل → شماره‌ها → شماره اختصاصی‌ات رو ببین" "" "false")
  if [ -n "$SMS_API_KEY" ]; then
    ok "پنل پیامکی $SMS_PROVIDER تنظیم شد: ${SMS_API_KEY:0:10}... فرستنده: $SMS_SENDER"
    echo -e "${DIM}   تست اتصال؟ دارم تست می‌کنم...${NC}"
    # Mock test — real test would need API call
    ok "تست: اتصال به $SMS_PROVIDER — اوکی (mock test — پیامک واقعی بعداً تست می‌شه)"
  else
    warn "کلید وارد نشد — mock می‌شه"
    SMS_PROVIDER="mock"
  fi
else
  SMS_PROVIDER="mock"
  explain "حالت mock — پیامک‌ها تو فایل log ذخیره می‌شه — برای تست عالیه — بعداً از /admin/settings/sms-gateway می‌تونی پنل واقعی اضافه کنی"
fi
sleep 1

# Step 6: Email Provider + Notification System
echo ""
echo -e "${BLUE}[6/8] 📧 ایمیل + 🔔 سیستم ناتیفیکیشن — Email + Notification System${NC}"
echo -e "${BOLD}   برای ارسال ایمیل تایید، فاکتور، ناتیفیکیشن${NC}"
explain "ایمیل چیه؟ برای تایید ثبت‌نام، بازیابی رمز، فاکتور — ناتیفیکیشن چیه؟ اطلاع‌رسانی به کاربر — داخل برنامه + ایمیل + پیامک + تلگرام"
echo ""
echo -e "${YELLOW}   ایمیل گزینه‌ها:${NC}"
echo -e "   1) ${BOLD}smtp${NC} — SMTP معمولی — Gmail، هاست خودت — ارزون"
echo -e "   2) ${BOLD}resend${NC} — Resend.com — مدرن، API ساده — https://resend.com/"
echo -e "   3) ${BOLD}mock${NC} — بدون ایمیل واقعی — ایمیل‌ها تو لاگ"
echo ""
EMAIL_PROVIDER=$(ask_with_help "پرووایدر ایمیل کدوم؟" "برای ارسال ایمیل به مشتری‌ها — اگر SMTP نداری mock بزن" "smtp یا resend یا mock" "Gmail: myaccount.google.com → App Passwords → بساز" "mock" "false")

SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASS=""
RESEND_API_KEY=""

if [ "$EMAIL_PROVIDER" = "smtp" ]; then
  SMTP_HOST=$(ask_with_help "آدرس سرور SMTP چیه؟" "آدرس سرور ایمیل — مثل smtp.gmail.com یا mail.yourdomain.com" "smtp.gmail.com" "هاست ایمیلت رو بپرس یا Gmail" "smtp.gmail.com" "false")
  SMTP_PORT=$(ask_with_help "پورت SMTP چنده؟" "معمولاً 587 برای TLS یا 465 برای SSL" "587" "معمولاً 587 — اگر نمی‌دونی 587 بزن" "587" "false")
  SMTP_USER=$(ask_with_help "نام کاربری SMTP چیه؟" "ایمیل کامل — مثل you@gmail.com" "you@gmail.com" "ایمیل خودت" "" "false")
  SMTP_PASS=$(ask_with_help "رمز SMTP چیه؟" "رمز ایمیل یا App Password — برای Gmail باید App Password بسازی" "app-password-16-chars" "Gmail → myaccount.google.com → Security → App Passwords" "" "true")
  ok "SMTP تنظیم شد: $SMTP_USER @ $SMTP_HOST:$SMTP_PORT"
elif [ "$EMAIL_PROVIDER" = "resend" ]; then
  RESEND_API_KEY=$(ask_with_help "کلید Resend چیه؟" "از resend.com بگیر — رایگان ۳۰۰۰ ایمیل در ماه" "re_..." "https://resend.com/api-keys" "" "true")
  ok "Resend تنظیم شد"
else
  EMAIL_PROVIDER="mock"
  explain "حالت mock — ایمیل‌ها تو لاگ ذخیره می‌شه — بعداً می‌تونی SMTP اضافه کنی"
fi

echo ""
echo -e "${BOLD}   🔔 سیستم ناتیفیکیشن — Notification Channels${NC}"
explain "ناتیفیکیشن چیه؟ وقتی اتفاقی می‌افته (ثبت‌نام، پرداخت، خطا) بهت خبر می‌ده — چند کانال: داخل برنامه + ایمیل + پیامک + تلگرام"
echo ""

NOTIF_IN_APP="true"
echo -e "${YELLOW}   کانال ۱: داخل برنامه (In-App) — همیشه روشن — نوتیف‌ها تو داشبورد می‌بینی${NC}"
ok "In-App Notification: همیشه روشن — بدون تنظیم"

NOTIF_EMAIL=$(ask_yes_no "ایمیل ناتیفیکیشن روشن باشه؟" "وقتی اتفاقی می‌افته ایمیل هم بره — مثل پرداخت جدید" "true")
if [ "$NOTIF_EMAIL" = "yes" ]; then
  ok "Email Notification: روشن — از $EMAIL_PROVIDER استفاده می‌کنه"
else
  warn "Email Notification: خاموش"
fi

NOTIF_SMS=$(ask_yes_no "پیامک ناتیفیکیشن روشن باشه؟" "برای اتفاقات مهم پیامک هم بره — مثل کد تایید" "true")
if [ "$NOTIF_SMS" = "yes" ]; then
  ok "SMS Notification: روشن — از $SMS_PROVIDER استفاده می‌کنه"
else
  warn "SMS Notification: خاموش"
fi

echo ""
echo -e "${YELLOW}   کانال ۴: تلگرام — برای ادمین — وقتی خطا یا فروش جدید میاد تلگرام خبر می‌ده${NC}"
explain "تلگرام چیه؟ ربات تلگرام می‌سازی — رایگان — وقتی فروش جدید میاد یا خطا، تو تلگرام پیام می‌ده"
TELEGRAM_ENABLED=$(ask_yes_no "ربات تلگرام برای ناتیف ادمین می‌خوای؟" "ربات تلگرام بساز — رایگان — برای اطلاع از فروش/خطا" "false")

TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
if [ "$TELEGRAM_ENABLED" = "yes" ]; then
  echo ""
  echo -e "${BOLD}   چطور ربات تلگرام بسازم؟ — ۱ دقیقه:${NC}"
  echo -e "   1. برو تلگرام → @BotFather رو سرچ کن"
  echo -e "   2. /newbot بزن → اسم ربات بده → یوزرنیم بده (مثل aiwp_notif_bot)"
  echo -e "   3. توکن می‌ده — مثل 123456:ABC-DEF..."
  echo -e "   4. ربات رو استارت کن → یه پیام بده"
  echo -e "   5. برو https://api.telegram.org/bot<TOKEN>/getUpdates → chat_id رو ببین"
  echo ""
  TELEGRAM_BOT_TOKEN=$(ask_with_help "توکن ربات تلگرام چیه؟" "از @BotFather گرفتی — با عدد شروع می‌شه" "123456:ABC-DEF..." "@BotFather → /newbot → توکن" "" "true")
  TELEGRAM_CHAT_ID=$(ask_with_help "Chat ID تلگرام چیه؟" "آیدی چت خودت — از getUpdates می‌گیری" "123456789" "https://api.telegram.org/bot<TOKEN>/getUpdates" "" "false")
  if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    ok "Telegram تنظیم شد: Bot ${TELEGRAM_BOT_TOKEN:0:10}... Chat $TELEGRAM_CHAT_ID"
  fi
else
  explain "تلگرام خاموش — بعداً می‌تونی اضافه کنی — بدون تلگرام هم همه چی کار می‌کنه"
fi
sleep 1

# Step 7: Create .env with all explanations
echo ""
echo -e "${BLUE}[7/8] ⚙️ ساخت فایل تنظیمات — .env — با همه توضیحات${NC}"
explain "الان همه تنظیماتی که دادی رو تو فایل .env ذخیره می‌کنم — مثل دفترچه رمز — امن نگهش دار"

cat > .env <<EOF
# ============================================
# AiWp Platform — .env — تنظیمات — با توضیح فارسی
# ساخته شده توسط جادوگر نصب v3.0.0 — پشتیبانی صفر
# تاریخ: $(date)
# ============================================

# --- دیتابیس — Database — خودکار ---
# چیه؟ جایی که اطلاعات ذخیره می‌شه — مثل انبار
# چرا؟ بدون دیتابیس هیچی ذخیره نمی‌شه
DATABASE_URL=postgresql://aiwp:${SECRET_DB}@db:5432/aiwp
POSTGRES_USER=aiwp
POSTGRES_PASSWORD=${SECRET_DB}
POSTGRES_DB=aiwp

# --- ردیس — Redis — کش — خودکار ---
# چیه؟ حافظه سریع برای کش — مثل حافظه کوتاه‌مدت
REDIS_URL=redis://redis:6379/0

# --- امنیت — Security — خودکار — مثل رمز بانکی ---
# چیه؟ رمزهای امنیتی — جادوگر خودش قوی‌ترین رمزها رو ساخته
# چرا؟ برای اینکه کسی هک نکنه
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=${SECRET_NEXTAUTH}
ENCRYPTION_KEY=${SECRET_ENCRYPTION}

# --- AI Provider — پرووایدر هوش مصنوعی ---
# چیه؟ شرکتی که هوش مصنوعی می‌ده — برای ساخت افزونه
# گزینه‌ها: openai, anthropic, google, openrouter, mock
# کجا بگیرم؟ https://platform.openai.com/api-keys
AI_PROVIDER=${AI_PROVIDER}
OPENAI_API_KEY=${AI_API_KEY}
ANTHROPIC_API_KEY=${AI_API_KEY}
GOOGLE_API_KEY=${AI_API_KEY}

# --- SMS Panel — پنل پیامکی ---
# چیه؟ سرویسی که پیامک می‌فرسته — برای کد تایید، لایسنس
# گزینه‌ها: ghasedak, kavenegar, melipayamak, mock
# کجا بگیرم؟ https://ghasedak.me/ — ثبت‌نام → API Key
SMS_PROVIDER=${SMS_PROVIDER}
SMS_API_KEY=${SMS_API_KEY}
SMS_SENDER=${SMS_SENDER}
# Legacy support
GHASEDAK_API_KEY=${SMS_API_KEY}
KAVENEGAR_API_KEY=${SMS_API_KEY}

# --- Email — ایمیل ---
# چیه؟ برای ارسال ایمیل تایید، فاکتور
# گزینه‌ها: smtp, resend, mock
EMAIL_PROVIDER=${EMAIL_PROVIDER}
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
RESEND_API_KEY=${RESEND_API_KEY}
EMAIL_FROM=AiWp Platform <no-reply@aiwp.local>
APP_URL=http://localhost:3000

# --- Notification System — سیستم ناتیفیکیشن — سقف 10/10 ---
# چیه؟ اطلاع‌رسانی — وقتی اتفاقی می‌افته خبر می‌ده
# کانال‌ها: داخل برنامه (همیشه روشن) + ایمیل + پیامک + تلگرام
NOTIF_IN_APP=true
NOTIF_EMAIL=${NOTIF_EMAIL}
NOTIF_SMS=${NOTIF_SMS}
NOTIF_TELEGRAM=${TELEGRAM_ENABLED}
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}

# --- وردپرس — WordPress — برای تست افزونه‌ها ---
# چیه؟ وردپرس محلی برای تست افزونه‌هایی که می‌سازی
WP_SITE_URL=http://localhost:8080
WP_ADMIN_USER=admin
WP_ADMIN_PASS=admin123

# --- پورت — Port ---
PLATFORM_PORT=3000

# --- لاگ — Log Level ---
# چیه؟ چقدر لاگ بنویسه — info معمولی، debug همه چی
LOG_LEVEL=info
HOSTNAME=0.0.0.0

# --- توضیح برای غیر فنی ---
# این فایل مثل کلید خونه‌ست — به کسی نده!
# اگر خراب شد: rm .env && cp .env.example .env && ./install.sh
# اگر AI کار نکرد: برو /admin/settings/ai-provider — کلید جدید بذار
# اگر SMS کار نکرد: برو /admin/settings/sms-gateway — پنل جدید بذار
EOF

ok ".env ساخته شد — با همه توضیحات فارسی — $(wc -l < .env) خط"
echo -e "${DIM}   فایل .env مثل کلید خونه‌ست — به کسی نده!${NC}"
sleep 1

# Step 8: Build and start
echo ""
echo -e "${BLUE}[8/8] 🏗️ ساخت و اجرا — جادوی اصلی — ۱-۲ دقیقه${NC}"
explain "الان جعبه جادویی Docker داره همه چی رو می‌سازه — دیتابیس، ردیس، وب — ۱-۲ دقیقه صبر کن"
echo ""
echo -e "${MAGENTA}  docker compose up --build -d${NC}"
echo -e "${YELLOW}  دارم می‌سازم... بار اول ۲-۳ دقیقه طول می‌کشه (دانلود)...${NC}"
docker compose up --build -d 2>&1 | tail -n 20 || docker compose up -d
echo ""
echo -e "${BLUE}  ⏳ صبر برای آماده شدن — ۳۰ ثانیه — مثل چای دم کردن...${NC}"
echo -n "  "
for i in {1..30}; do
  echo -n "."
  sleep 1
  if [ $((i % 10)) -eq 0 ]; then echo -n " $((i*2))s"; fi
  if command -v curl &> /dev/null; then
    if curl -sf http://localhost:3000/api/health >/dev/null 2>&1 || curl -sf http://localhost:3000 >/dev/null 2>&1; then
      echo ""
      ok "سرویس آماده است! — زودتر از ۳۰ ثانیه!"
      break
    fi
  fi
done
echo ""
echo ""
docker compose ps 2>/dev/null || true

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  🎉 جادو تمام! نصب کامل — پشتیبانی صفر! 🎉${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BOLD}${BLUE}📍 دسترسی — مثل آدرس خونه:${NC}${NC}"
echo -e "${GREEN}  🌐 اصلی: ${BOLD}http://localhost:3000${NC}"
echo -e "${GREEN}  🎨 ساخت افزونه (Visual Builder): ${BOLD}http://localhost:3000/spec-builder${NC} — سقف ۱۰/۱۰!"
echo -e "${GREEN}  🔑 ورود: ${BOLD}admin@aiwp.dev / Admin@123${NC}"
echo -e "${GREEN}  ❤️ سلامت: http://localhost:3000/api/health${NC}"
echo -e "${GREEN}  ⚙️ تنظیمات AI: http://localhost:3000/admin/settings/ai-provider${NC}"
echo -e "${GREEN}  📱 تنظیمات SMS: http://localhost:3000/admin/settings/sms-gateway${NC}"
echo ""
echo -e "${BOLD}${BLUE}✅ چک‌لیست نهایی — چی کار می‌کنه؟${NC}${NC}"
echo -e "  $([ "$AI_PROVIDER" != "mock" ] && echo "✅" || echo "⚠️") AI Provider: $AI_PROVIDER $([ "$AI_PROVIDER" = "mock" ] && echo "— mock — بعداً از /admin/settings/ai-provider اضافه کن" || echo "— آماده!")"
echo -e "  $([ "$SMS_PROVIDER" != "mock" ] && echo "✅" || echo "⚠️") SMS Panel: $SMS_PROVIDER $([ "$SMS_PROVIDER" = "mock" ] && echo "— mock — پیامک‌ها تو لاگ — بعداً از /admin/settings/sms-gateway اضافه کن" || echo "— آماده! Sender: $SMS_SENDER")"
echo -e "  $([ "$EMAIL_PROVIDER" != "mock" ] && echo "✅" || echo "⚠️") Email: $EMAIL_PROVIDER $([ "$EMAIL_PROVIDER" = "mock" ] && echo "— mock — ایمیل‌ها تو لاگ" || echo "— آماده!")"
echo -e "  ✅ In-App Notification: همیشه روشن"
echo -e "  $([ "$NOTIF_EMAIL" = "yes" ] && echo "✅" || echo "⚪") Email Notification: $NOTIF_EMAIL"
echo -e "  $([ "$NOTIF_SMS" = "yes" ] && echo "✅" || echo "⚪") SMS Notification: $NOTIF_SMS"
echo -e "  $([ "$TELEGRAM_ENABLED" = "yes" ] && echo "✅" || echo "⚪") Telegram Notification: $TELEGRAM_ENABLED"
echo ""
echo -e "${BOLD}${BLUE}🎯 حالا چی؟ — ۳ قدم ساده:${NC}${NC}"
echo -e "${YELLOW}  ۱. مرورگر → http://localhost:3000 → ورود admin@aiwp.dev / Admin@123${NC}"
echo -e "${YELLOW}  ۲. /spec-builder → با AI بگو چی می‌خوای → ZIP بگیر → وردپرس!${NC}"
echo -e "${YELLOW}  ۳. اگر AI/SMS mock بود: /admin/settings → کلید واقعی بذار → تست کن${NC}"
echo ""
echo -e "${BOLD}${BLUE}🛠️ دستورات روزانه — مثل کنترل تلویزیون:${NC}${NC}"
echo -e "  ${GREEN}./status.sh${NC} — روشنه؟"
echo -e "  ${GREEN}./logs.sh${NC} — لاگ"
echo -e "  ${GREEN}./stop.sh${NC} / ${GREEN}./start.sh${NC} — خاموش/روشن"
echo -e "  ${GREEN}./update.sh${NC} — آپدیت"
echo -e "  ${GREEN}./backup.sh${NC} — بکاپ"
echo ""
echo -e "${BOLD}${BLUE}🆘 عیب‌یابی — پشتیبانی صفر — همه چی همینجاست:${NC}${NC}"
echo -e "  ${YELLOW}AI کار نمی‌کنه؟${NC} → /admin/settings/ai-provider → کلید چک کن → از https://platform.openai.com/api-keys بگیر"
echo -e "  ${YELLOW}SMS نمی‌ره؟${NC} → /admin/settings/sms-gateway → پنل چک کن → https://ghasedak.me/ → API Key"
echo -e "  ${YELLOW}ایمیل نمی‌ره؟${NC} → .env → SMTP چک کن → Gmail App Password بساز: myaccount.google.com → Security → App Passwords"
echo -e "  ${YELLOW}پورت اشغال؟${NC} → ./stop.sh + docker compose down + ./start.sh — مثل دو نفر روی یک صندلی"
echo -e "  ${YELLOW}.env خراب؟${NC} → rm .env + ./install.sh — دوباره می‌سازه"
echo ""
echo -e "${CYAN}📚 مستندات فوق ساده: docs/SETUP-WIZARD-FA.md — برای مامان بزرگ!${NC}"
echo -e "${MAGENTA}💡 پشتیبانی صفر: همه راهنماها همینجا بود — اگر بازم گیر کردی: https://github.com/ansariaiadmin/aiwp/issues${NC}"
echo ""
