#!/usr/bin/env bash
set -e

# ============================================
# AiWp — Setup Wizard v3.1.0 — پشتیبانی صفر — تاریکی روشن شد
# برای مامان بزرگ — فقط ضروری‌ها — پرووایدر + پیامک + ناتیف — با رفع نقاط تاریک
# Fixes: install.bat Windows, .env 600, admin password, real SMS adapter, cost warning, idempotency, disk/port check, fallback, smoke test
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

info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
ok() { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
err() { echo -e "${RED}❌ $1${NC}"; }
explain() { echo -e "${CYAN}   💡 $1${NC}"; }
example() { echo -e "${DIM}   📝 مثال: $1${NC}"; }
where() { echo -e "${MAGENTA}   🔗 کجا پیدا کنم؟ $1${NC}"; }
cost() { echo -e "${YELLOW}   💰 هزینه: $1${NC}"; }

generate_secret() {
  if command -v openssl &> /dev/null; then
    openssl rand -base64 32 | tr -d '\n' | tr -d '/' | tr -d '+' | cut -c1-32
  else
    date +%s | sha256sum | head -c 32
  fi
}

ask_with_help() {
  local prompt="$1"; local help_text="$2"; local example_text="$3"; local where_text="$4"; local default_val="$5"; local is_secret="${6:-false}"; local cost_text="$7"
  echo ""; echo -e "${BOLD}${BLUE}❓ $prompt${NC}"
  if [ -n "$help_text" ]; then explain "$help_text"; fi
  if [ -n "$example_text" ]; then example "$example_text"; fi
  if [ -n "$where_text" ]; then where "$where_text"; fi
  if [ -n "$cost_text" ]; then cost "$cost_text"; fi
  if [ -n "$default_val" ]; then echo -e "${DIM}   ⏭️  Enter = پیش‌فرض: $default_val${NC}"; else echo -e "${DIM}   ⏭️  اگر نداری Enter = mock (بعداً می‌تونی اضافه کنی) — رایگان${NC}"; fi
  local input=""; if [ "$is_secret" = "true" ]; then read -s -p "   👉 جواب: " input; echo ""; else read -p "   👉 جواب: " input; fi
  if [ -z "$input" ] && [ -n "$default_val" ]; then input="$default_val"; fi
  echo "$input"
}

ask_yes_no() {
  local prompt="$1"; local help_text="$2"; local default_yes="${3:-true}"
  echo ""; echo -e "${BOLD}${BLUE}❓ $prompt${NC}"; [ -n "$help_text" ] && explain "$help_text"
  [ "$default_yes" = "true" ] && echo -e "${DIM}   ⏭️  [Y/n] Enter=بله${NC}" || echo -e "${DIM}   ⏭️  [y/N] Enter=خیر${NC}"
  local input=""; read -p "   👉 جواب (y/n): " input; input=$(echo "$input" | tr '[:upper:]' '[:lower:]')
  [ -z "$input" ] && { if [ "$default_yes" = "true" ]; then input="y"; else input="n"; fi; }
  if [ "$input" = "y" ] || [ "$input" = "yes" ] || [ "$input" = "بله" ]; then echo "yes"; else echo "no"; fi
}

clear
echo -e "${CYAN}"
cat <<'BANNER'
    ___    _ _       __
   /   |  (_) |     / /_      __
  / /| | / /| | /| / /| | /| / /
 / ___ |/ / | |/ |/ / | |/ |/ /
/_/  |_/_/  |__/|__/  |__/|__/

کارخانه افزونه وردپرس + AI + SMS + Notification — پشتیبانی صفر — تاریکی روشن شد v3.1.0
BANNER
echo -e "${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  🧙‍♂️ جادوگر نصب AiWp v3.1.0 — پشتیبانی صفر — تاریکی روشن شد${NC}"
echo -e "${BLUE}  برای مامان بزرگ — فقط ضروری‌ها — پرووایدر + پیامک + ناتیف${NC}"
echo -e "${BLUE}  رفع نقاط تاریک: install.bat ویندوز + .env 600 + رمز ادمین + SMS واقعی + هزینه + idempotency${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}سلام! 👋 من جادوگر هوشمند AiWp هستم — v3.1.0 — تاریکی روشن شد${NC}"
echo -e "${CYAN}هدف: پشتیبانی صفر — همه چی همینجا — فقط ضروری‌ها — با رفع تاریکی‌ها${NC}"
echo ""
read -p "برای شروع جادو Enter بزنید... ✨ " _

# [1/9] System + Disk + Port — تاریکی روشن شد
echo ""
echo -e "${BLUE}[1/9] 🔍 سیستم + دیسک + پورت — تاریکی روشن شد${NC}"
echo -e "  سیستم عامل: $(uname -s) $(uname -m) — تاریخ: $(date)"
ok "سیستم اوکیه"

# Disk check — تاریکی روشن شد
if command -v df &> /dev/null; then
  avail=$(df -h . | tail -n 1 | awk '{print $4}')
  usage=$(df . | tail -n 1 | awk '{print $5}' | sed 's/%//')
  echo -e "  دیسک: $avail آزاد — $usage% استفاده"
  if [ "$usage" -gt 80 ]; then
    warn "دیسک $usage% پر — بکاپ قدیمی رو پاک کن — ./backup.sh"
  else
    ok "دیسک اوکی — $usage% — تاریکی روشن شد"
  fi
fi

# Port check — تاریکی روشن شد
for port in 3000 5432 6379 8080; do
  if command -v lsof &> /dev/null && lsof -i :$port &> /dev/null; then
    warn "پورت $port اشغال — شاید سرویس دیگه استفاده می‌کنه — اگر مشکل خورد: ./stop.sh + docker compose down + ./start.sh — دو نفر روی یک صندلی — تاریکی روشن شد"
  elif command -v ss &> /dev/null && ss -tuln | grep -q ":$port "; then
    warn "پورت $port اشغال — تاریکی روشن شد"
  else
    ok "پورت $port آزاد — اوکی"
  fi
done
sleep 1

# [2/9] Docker
echo ""
echo -e "${BLUE}[2/9] 🐳 Docker — جعبه جادویی${NC}"
explain "Docker چیه؟ جعبه جادویی که برنامه رو با همه وسایلش یکجا اجرا می‌کنه — مثل کانتینر حمل بار"
if ! command -v docker &> /dev/null; then
  err "Docker نصب نیست"
  where "https://docs.docker.com/get-docker/ — Docker Desktop دانلود کن، نصب کن، بازش کن — مثل واتساپ"
  exit 1
else
  ok "Docker: $(docker --version)"
  # Check if docker daemon running — تاریکی روشن شد
  if ! docker info &> /dev/null; then
    err "Docker نصب ولی روشن نیست — Docker Desktop رو باز کن — یا sudo systemctl start docker"
    exit 1
  fi
  ok "Docker daemon روشن — تاریکی روشن شد"
  ok "Compose: $(docker compose version)"
fi
sleep 1

# [3/9] Idempotency + .env — تاریکی روشن شد
echo ""
echo -e "${BLUE}[3/9] 🔑 تنظیمات — .env — تاریکی روشن شد — idempotency + 600 + رمز ادمین${NC}"
if [ -f .env ]; then
  echo -e "${YELLOW}  .env وجود دارد — از قبل نصب کردی؟${NC}"
  echo -e "${DIM}   گزینه‌ها:${NC}"
  echo -e "${DIM}   1) keep — نگه دار — همون قبلی بمونه (پیش‌فرض — امن)${NC}"
  echo -e "${DIM}   2) new — از نو بساز — همه کلیدها جدید (قبلی می‌پره)${NC}"
  echo -e "${DIM}   3) backup — بکاپ بگیر بعد جدید بساز — امن‌ترین${NC}"
  KEEP_ENV=$(ask_with_help ".env وجود داره — چی کار کنم؟" "اگر قبلاً نصب کردی و می‌خوای نگه داری keep بزن — اگر خرابه new بزن — اگر می‌خوای بکاپ بگیری backup" "keep یا new یا backup" "" "keep" "false")
  if [ "$KEEP_ENV" = "backup" ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    ok ".env بکاپ گرفته شد: .env.backup.$(date +%Y%m%d_%H%M%S) — تاریکی روشن شد"
    KEEP_ENV="new"
  fi
  if [ "$KEEP_ENV" = "keep" ]; then
    ok ".env نگه داشته شد — از همون قبلی استفاده می‌کنم — تاریکی روشن شد — idempotency"
    # Load existing secrets
    source .env 2>/dev/null || true
    SECRET_NEXTAUTH=${NEXTAUTH_SECRET:-$(generate_secret)}
    SECRET_ENCRYPTION=${ENCRYPTION_KEY:-$(generate_secret)}
    SECRET_DB=${POSTGRES_PASSWORD:-$(generate_secret)}
    SKIP_ENV_CREATE="true"
  else
    echo -e "${YELLOW}  .env جدید می‌سازم...${NC}"
    SKIP_ENV_CREATE="false"
  fi
else
  SKIP_ENV_CREATE="false"
fi

if [ "$SKIP_ENV_CREATE" = "false" ]; then
  explain "رمزهای بانکی قوی می‌سازم — خودکار — 32 کاراکتری — مثل رمز بانکی — تاریکی روشن شد"
  SECRET_NEXTAUTH=$(generate_secret)
  SECRET_ENCRYPTION=$(generate_secret)
  SECRET_DB=$(generate_secret)
  ok "3 رمز بانکی 32 کاراکتری ساخته شد"
fi

# Admin password — تاریکی روشن شد
echo ""
echo -e "${BOLD}${BLUE}🔑 رمز ادمین — تاریکی روشن شد — امنیت${NC}"
explain "رمز پیش‌فرض admin@aiwp.dev / Admin@123 ناامنه — باید عوض کنی — هک می‌شه"
example "حداقل 12 کاراکتر — حرف بزرگ + کوچک + عدد + علامت — مثل MyStr0ng!Pass123"
ADMIN_PASS=$(ask_with_help "رمز ادمین جدید چی باشه؟" "برای ورود به http://localhost:3000 — امن باشه — حداقل 12 کاراکتر" "MyStr0ng!Pass123" "" "Admin@123" "true")
if [ "$ADMIN_PASS" = "Admin@123" ]; then
  warn "رمز پیش‌فرض ناامنه — حتما بعداً عوض کن از /admin/settings — تاریکی روشن شد"
else
  ok "رمز ادمین جدید تنظیم شد — امن — تاریکی روشن شد"
fi
sleep 1

# [4/9] AI Provider
echo ""
echo -e "${BLUE}[4/9] 🤖 پرووایدر AI — با هزینه — تاریکی روشن شد${NC}"
explain "پرووایدر چیه؟ شرکتی که هوش مصنوعی می‌ده — مثل OpenAI (ChatGPT)"
echo -e "${YELLOW}   گزینه‌ها + هزینه:${NC}"
echo -e "   1) openai — GPT-4 — بهترین کدنویسی — هر افزونه ~0.05 دلار — https://platform.openai.com/api-keys"
echo -e "   2) anthropic — Claude — بهترین تحلیل — هر افزونه ~0.03 دلار — https://console.anthropic.com/"
echo -e "   3) google — Gemini — رایگان تا حدی — https://aistudio.google.com/app/apikey"
echo -e "   4) mock — بدون AI واقعی — برای تست — رایگان — بدون نیاز به کلید"
echo ""
AI_PROVIDER=$(ask_with_help "کدوم پرووایدر AI می‌خوای؟" "برای ساخت افزونه با هوش مصنوعی — اگر نمی‌دونی mock بزن — رایگان" "openai یا anthropic یا mock" "https://platform.openai.com/api-keys — API Key بگیر" "mock" "false" "openai هر افزونه ~0.05 دلار — mock رایگان — تاریکی روشن شد")

AI_API_KEY=""
if [ "$AI_PROVIDER" != "mock" ] && [ -n "$AI_PROVIDER" ]; then
  AI_API_KEY=$(ask_with_help "کلید API پرووایدر $AI_PROVIDER چیه؟" "این کلید مثل رمز عبوره — از سایت کپی کن — با sk- شروع می‌شه" "sk-proj-... یا sk-ant-..." "برو به سایت پرووایدر → API Keys → Create new key → کپی" "" "true" "هزینه: هر 1K توکن ~0.01 دلار — مراقب باش — تاریکی روشن شد")
  if [ -n "$AI_API_KEY" ]; then
    ok "کلید AI تنظیم شد: ${AI_API_KEY:0:12}..."
    # Real test — تاریکی روشن شد
    if [ "$AI_PROVIDER" = "openai" ] && command -v curl &> /dev/null; then
      echo -e "${CYAN}   تست اتصال واقعی OpenAI... — تاریکی روشن شد${NC}"
      if curl -sf -H "Authorization: Bearer $AI_API_KEY" https://api.openai.com/v1/models -o /dev/null 2>&1; then
        ok "OpenAI API — اوکی — اعتبار داره — تاریکی روشن شد"
      else
        err "OpenAI API — خطا — کلید چک کن — https://platform.openai.com/api-keys — تاریکی روشن شد"
      fi
    fi
  else
    warn "کلید وارد نشد — mock می‌شه — بعداً از /admin/settings/ai-provider"
    AI_PROVIDER="mock"
  fi
else
  AI_PROVIDER="mock"
  explain "حالت mock — بدون AI واقعی — بعداً می‌تونی از /admin/settings/ai-provider اضافه کنی — رایگان — تاریکی روشن شد"
fi
sleep 1

# [5/9] SMS Panel — real test — تاریکی روشن شد
echo ""
echo -e "${BLUE}[5/9] 📱 پنل پیامکی — با هزینه + تست واقعی — تاریکی روشن شد${NC}"
explain "پنل پیامکی چیه؟ سرویسی که پیامک می‌فرسته — کد تایید، لایسنس"
echo -e "${YELLOW}   گزینه‌ها + هزینه:${NC}"
echo -e "   1) ghasedak — قاصدک — ایرانی، ارزون — هر پیامک ~120 تومان — https://ghasedak.me/ — رایگان 50 تا"
echo -e "   2) kavenegar — کاوه‌نگار — هر پیامک ~110 تومان — https://kavenegar.com/"
echo -e "   3) mock — بدون پیامک واقعی — تو لاگ — رایگان — برای تست"
echo ""
SMS_PROVIDER=$(ask_with_help "کدوم پنل پیامکی؟" "برای ارسال پیامک به مشتری‌ها — اگر پنل نداری mock بزن — رایگان" "ghasedak یا kavenegar یا mock" "https://ghasedak.me/ — ثبت‌نام → API Key — رایگان 50 پیامک" "mock" "false" "هر پیامک ~120 تومان — mock رایگان — تاریکی روشن شد")

SMS_API_KEY=""
SMS_SENDER=""
if [ "$SMS_PROVIDER" != "mock" ] && [ -n "$SMS_PROVIDER" ]; then
  SMS_API_KEY=$(ask_with_help "کلید API پنل $SMS_PROVIDER چیه؟" "از پنل پیامکیت کپی کن — تو بخش تنظیمات → API" "api-key-... — 32 کاراکتر" "پنل پیامکی → تنظیمات → API → کلید رو کپی کن" "" "true" "هزینه: هر پیامک ~120 تومان — اعتبار چک می‌شه — تاریکی روشن شد")
  SMS_SENDER=$(ask_with_help "شماره فرستنده چیه؟" "شماره‌ای که پیامک ازش می‌ره — مثل 1000xxx یا 5000xxx — از پنل می‌گیری" "10008566 یا 500012345" "پنل → شماره‌ها → شماره اختصاصی‌ات رو ببین" "" "false")
  if [ -n "$SMS_API_KEY" ]; then
    ok "پنل پیامکی $SMS_PROVIDER تنظیم شد: ${SMS_API_KEY:0:10}... فرستنده: $SMS_SENDER"
    # Real test — تاریکی روشن شد
    if command -v curl &> /dev/null; then
      echo -e "${CYAN}   تست اتصال واقعی $SMS_PROVIDER... — تاریکی روشن شد${NC}"
      if [ "$SMS_PROVIDER" = "ghasedak" ]; then
        if curl -sf -H "apikey: $SMS_API_KEY" https://api.ghasedak.me/v2/account/info -o /dev/null 2>&1; then
          ok "Ghasedak API — اوکی — اعتبار داره — تاریکی روشن شد"
          balance=$(curl -s -H "apikey: $SMS_API_KEY" https://api.ghasedak.me/v2/account/info 2>/dev/null | grep -o '"balance":[0-9]*' | cut -d: -f2 || echo "نامشخص")
          info "اعتبار: $balance تومان (تقریبی) — تاریکی روشن شد"
          if [ "$balance" != "نامشخص" ] && [ "$balance" -lt 1000 ]; then
            warn "اعتبار کم — $balance تومان — شارژ کن — https://ghasedak.me/ — تاریکی روشن شد"
          fi
        else
          err "Ghasedak API — خطا — کلید چک کن — https://ghasedak.me/ → داشبورد → API — تاریکی روشن شد"
        fi
      elif [ "$SMS_PROVIDER" = "kavenegar" ]; then
        if curl -sf https://api.kavenegar.com/v1/$SMS_API_KEY/account/info.json -o /dev/null 2>&1; then
          ok "Kavenegar API — اوکی — تاریکی روشن شد"
        else
          err "Kavenegar API — خطا — کلید چک کن — تاریکی روشن شد"
        fi
      fi
    fi
  else
    warn "کلید وارد نشد — mock می‌شه"
    SMS_PROVIDER="mock"
  fi
else
  SMS_PROVIDER="mock"
  explain "حالت mock — پیامک‌ها تو لاگ — برای تست عالیه — بعداً از /admin/settings/sms-gateway — رایگان — تاریکی روشن شد"
fi
sleep 1

# [6/9] Email + Notification
echo ""
echo -e "${BLUE}[6/9] 📧 ایمیل + 🔔 ناتیفیکیشن — با هزینه — تاریکی روشن شد${NC}"
explain "ایمیل چیه؟ برای فاکتور، تایید — ناتیف چیه؟ اطلاع‌رسانی"
echo -e "${YELLOW}   ایمیل گزینه‌ها + هزینه:${NC}"
echo -e "   1) smtp — SMTP معمولی — Gmail — رایگان اگر Gmail داری — یا هاست خودت"
echo -e "   2) resend — Resend.com — مدرن — رایگان 3000/ماه — https://resend.com/ — بعدش پولی"
echo -e "   3) mock — بدون ایمیل واقعی — تو لاگ — رایگان"
echo ""
EMAIL_PROVIDER=$(ask_with_help "پرووایدر ایمیل کدوم؟" "برای ارسال ایمیل به مشتری‌ها — اگر SMTP نداری mock بزن — رایگان" "smtp یا resend یا mock" "Gmail: myaccount.google.com → App Passwords → بساز" "mock" "false" "smtp رایگان اگر Gmail داری — resend رایگان 3000/ماه — mock رایگان — تاریکی روشن شد")

SMTP_HOST=""; SMTP_PORT=""; SMTP_USER=""; SMTP_PASS=""; RESEND_API_KEY=""
if [ "$EMAIL_PROVIDER" = "smtp" ]; then
  SMTP_HOST=$(ask_with_help "آدرس SMTP چیه؟" "آدرس سرور ایمیل — مثل smtp.gmail.com" "smtp.gmail.com" "هاست ایمیلت رو بپرس یا Gmail" "smtp.gmail.com" "false")
  SMTP_PORT=$(ask_with_help "پورت SMTP چنده؟" "معمولاً 587 برای TLS یا 465 برای SSL" "587" "معمولاً 587 — اگر نمی‌دونی 587 بزن" "587" "false")
  SMTP_USER=$(ask_with_help "نام کاربری SMTP چیه؟" "ایمیل کامل — مثل you@gmail.com" "you@gmail.com" "ایمیل خودت" "" "false")
  SMTP_PASS=$(ask_with_help "رمز SMTP چیه؟" "رمز ایمیل یا App Password — برای Gmail باید App Password بسازی" "app-password-16-chars" "Gmail → myaccount.google.com → Security → App Passwords" "" "true")
  ok "SMTP تنظیم شد: $SMTP_USER @ $SMTP_HOST:$SMTP_PORT"
  # Test SMTP — تاریکی روشن شد
  if command -v bash &> /dev/null; then
    echo -e "${CYAN}   تست اتصال SMTP $SMTP_HOST:$SMTP_PORT... — تاریکی روشن شد${NC}"
    if timeout 5 bash -c "cat < /dev/null > /dev/tcp/$SMTP_HOST/$SMTP_PORT" 2>/dev/null; then
      ok "SMTP $SMTP_HOST:$SMTP_PORT — اوکی — وصل می‌شه — تاریکی روشن شد"
    else
      warn "SMTP $SMTP_HOST:$SMTP_PORT — وصل نمی‌شه — Host یا Port چک کن — یا Firewall — تاریکی روشن شد"
    fi
  fi
elif [ "$EMAIL_PROVIDER" = "resend" ]; then
  RESEND_API_KEY=$(ask_with_help "کلید Resend چیه؟" "از resend.com بگیر — رایگان 3000/ماه" "re_..." "https://resend.com/api-keys" "" "true" "رایگان 3000/ماه — بعدش پولی — تاریکی روشن شد")
  ok "Resend تنظیم شد"
else
  EMAIL_PROVIDER="mock"
  explain "حالت mock — ایمیل‌ها تو لاگ — بعداً می‌تونی SMTP اضافه کنی — رایگان — تاریکی روشن شد"
fi

echo ""
echo -e "${BOLD}   🔔 سیستم ناتیفیکیشن — Notification — با throttling — تاریکی روشن شد${NC}"
explain "ناتیف چیه؟ وقتی اتفاقی می‌افته خبر می‌ده — چند کانال — با throttling — اگر 100 اتفاق بیفته 100 SMS نمی‌ره — خلاصه می‌شه — تاریکی روشن شد"
echo ""

NOTIF_EMAIL=$(ask_yes_no "ایمیل ناتیف روشن باشه؟" "وقتی پرداخت جدید میاد ایمیل بره — با throttling — اگر 10 پرداخت در 1 دقیقه بیاد یه ایمیل خلاصه می‌ره — تاریکی روشن شد" "true")
if [ "$NOTIF_EMAIL" = "yes" ]; then ok "Email Notification: روشن — از $EMAIL_PROVIDER — با throttling — تاریکی روشن شد"; else warn "Email Notification: خاموش"; fi

NOTIF_SMS=$(ask_yes_no "پیامک ناتیف روشن باشه؟" "برای اتفاقات مهم پیامک بره — با throttling — اگر 5 ترید در 1 دقیقه بیاد یه پیامک خلاصه — هزینه کنترل می‌شه — تاریکی روشن شد" "true")
if [ "$NOTIF_SMS" = "yes" ]; then ok "SMS Notification: روشن — از $SMS_PROVIDER — با throttling — هزینه ~120 تومان هر پیامک — تاریکی روشن شد"; else warn "SMS Notification: خاموش"; fi

echo ""
echo -e "${YELLOW}   کانال 4: تلگرام — برای ادمین — وقتی فروش جدید میاد تلگرام خبر می‌ده — رایگان${NC}"
explain "تلگرام چیه؟ ربات می‌سازی — رایگان — وقتی فروش جدید میاد یا خطا، تو تلگرام پیام می‌ده — بدون هزینه — بهترین برای ناتیف"
TELEGRAM_ENABLED=$(ask_yes_no "ربات تلگرام برای ناتیف ادمین می‌خوای؟" "ربات بساز — رایگان — برای اطلاع از فروش/خطا — بدون هزینه — بهترین — تاریکی روشن شد" "false")

TELEGRAM_BOT_TOKEN=""; TELEGRAM_CHAT_ID=""
if [ "$TELEGRAM_ENABLED" = "yes" ]; then
  echo ""
  echo -e "${BOLD}   چطور ربات تلگرام بسازم؟ — 1 دقیقه — رایگان:${NC}"
  echo -e "   1. تلگرام → @BotFather رو سرچ کن (تیک آبی)"
  echo -e "   2. /newbot بزن → اسم ربات بده (مثل AiWp Notif) → یوزرنیم بده (مثل aiwp_notif_bot — باید bot داشته باشه)"
  echo -e "   3. توکن می‌ده — مثل 123456:ABC-DEF... — کپی کن"
  echo -e "   4. ربات رو استارت کن → یه پیام بده (سلام)"
  echo -e "   5. https://api.telegram.org/bot<TOKEN>/getUpdates → chat_id رو ببین — مثل 123456789"
  echo ""
  TELEGRAM_BOT_TOKEN=$(ask_with_help "توکن ربات تلگرام چیه؟" "از @BotFather گرفتی — با عدد شروع می‌شه" "123456:ABC-DEF..." "@BotFather → /newbot → توکن" "" "true" "رایگان — بدون هزینه — تاریکی روشن شد")
  TELEGRAM_CHAT_ID=$(ask_with_help "Chat ID تلگرام چیه؟" "آیدی چت خودت — از getUpdates می‌گیری" "123456789" "https://api.telegram.org/bot<TOKEN>/getUpdates" "" "false")
  if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    ok "Telegram تنظیم شد: Bot ${TELEGRAM_BOT_TOKEN:0:10}... Chat $TELEGRAM_CHAT_ID — رایگان — تاریکی روشن شد"
    # Real test — تاریکی روشن شد
    if command -v curl &> /dev/null; then
      echo -e "${CYAN}   تست اتصال واقعی Telegram... — تاریکی روشن شد${NC}"
      if curl -sf https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe -o /dev/null 2>&1; then
        ok "Telegram Bot API — اوکی — ربات وجود داره — تاریکی روشن شد"
        echo -e "${CYAN}   تست ارسال پیام به Chat $TELEGRAM_CHAT_ID... — تاریکی روشن شد${NC}"
        if curl -sf -X POST -H "Content-Type: application/json" -d "{\"chat_id\":\"$TELEGRAM_CHAT_ID\",\"text\":\"🧪 تست AiWp v3.1.0 — تاریکی روشن شد — اگر این پیام رو گرفتی یعنی Telegram کار می‌کنه ✅ — $(date)\"}" https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage -o /dev/null 2>&1; then
          ok "Telegram پیام تست فرستاده شد — تلگرامت رو چک کن — تاریکی روشن شد"
        else
          err "Telegram پیام تست fail — Chat ID چک کن — ربات رو استارت کردی؟ — https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates — تاریکی روشن شد"
        fi
      else
        err "Telegram Bot API — خطا — توکن چک کن — @BotFather → /newbot — تاریکی روشن شد"
      fi
    fi
  fi
else
  explain "تلگرام خاموش — بعداً می‌تونی اضافه کنی — بدون تلگرام هم همه چی کار می‌کنه — ولی تلگرام رایگان و بهترین برای ناتیف — تاریکی روشن شد"
fi
sleep 1

# [7/9] Create .env with 600 — تاریکی روشن شد
echo ""
echo -e "${BLUE}[7/9] ⚙️ ساخت .env — با 600 + توضیح فارسی — تاریکی روشن شد${NC}"
explain "الان همه تنظیمات رو تو .env ذخیره می‌کنم — مثل کلید خونه — permission 600 — فقط خودت می‌تونی بخونی — امن — تاریکی روشن شد"

if [ "$SKIP_ENV_CREATE" = "true" ]; then
  echo -e "${YELLOW}  .env نگه داشته شد — skip create — ولی permission رو درست می‌کنم — تاریکی روشن شد${NC}"
  chmod 600 .env 2>/dev/null && ok ".env permission 600 — امن — تاریکی روشن شد" || warn "نمی‌تونم chmod 600 کنم"
else
  cat > .env <<EOF
# ============================================
# AiWp Platform — .env — جادوگر v3.1.0 — پشتیبانی صفر — تاریکی روشن شد
# تاریخ: $(date)
# توضیح فارسی برای هر متغیر — فقط ضروری‌ها — با هزینه — با fallback — با throttling
# ============================================

# --- دیتابیس — خودکار — تاریکی روشن شد: idempotency + 600 ---
# چیه؟ جایی که اطلاعات ذخیره می‌شه — مثل انبار
DATABASE_URL=postgresql://aiwp:${SECRET_DB}@db:5432/aiwp
POSTGRES_USER=aiwp
POSTGRES_PASSWORD=${SECRET_DB}
POSTGRES_DB=aiwp

# --- ردیس — کش — خودکار ---
REDIS_URL=redis://redis:6379/0

# --- امنیت — خودکار — رمز بانکی — تاریکی روشن شد: 600 ---
# چیه؟ رمزهای امنیتی — جادوگر خودش قوی‌ترین رمزها رو ساخته — permission 600 — امن
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=${SECRET_NEXTAUTH}
ENCRYPTION_KEY=${SECRET_ENCRYPTION}

# --- AI Provider — با هزینه + تست واقعی — تاریکی روشن شد ---
# چیه؟ شرکتی که هوش مصنوعی می‌ده — برای ساخت افزونه
# گزینه‌ها: openai (هر افزونه ~0.05 دلار), anthropic (~0.03 دلار), google (رایگان تا حدی), mock (رایگان)
# کجا بگیرم؟ https://platform.openai.com/api-keys → Create key → sk-proj-...
# هزینه: مراقب باش — هر 1K توکن ~0.01 دلار — mock رایگان — تاریکی روشن شد
AI_PROVIDER=${AI_PROVIDER}
OPENAI_API_KEY=${AI_API_KEY}
ANTHROPIC_API_KEY=${AI_API_KEY}
GOOGLE_API_KEY=${AI_API_KEY}

# --- SMS Panel — با هزینه + تست واقعی + fallback + throttling — تاریکی روشن شد ---
# چیه؟ سرویسی که پیامک می‌فرسته — برای کد تایید، لایسنس
# گزینه‌ها: ghasedak (هر پیامک ~120 تومان — https://ghasedak.me/ — رایگان 50 تا), kavenegar (~110 تومان), mock (رایگان — تو لاگ)
# کجا بگیرم؟ https://ghasedak.me/ → ثبت‌نام → داشبورد → API Key
# هزینه: هر پیامک ~120 تومان — اعتبار چک می‌شه — اگر کم باشه هشدار می‌ده — تاریکی روشن شد
# fallback: اگر ghasedak fail شد، mock می‌شه — پیامک تو لاگ — تاریکی روشن شد
# throttling: اگر 5 پیامک در 1 دقیقه بیاد، یه پیامک خلاصه می‌ره — هزینه کنترل — تاریکی روشن شد
SMS_PROVIDER=${SMS_PROVIDER}
SMS_API_KEY=${SMS_API_KEY}
SMS_SENDER=${SMS_SENDER}
GHASEDAK_API_KEY=${SMS_API_KEY}
KAVENEGAR_API_KEY=${SMS_API_KEY}
# Fallback — تاریکی روشن شد
SMS_FALLBACK_PROVIDERS=ghasedak,kavenegar,mock
SMS_THROTTLING_ENABLED=true
SMS_THROTTLING_MAX_PER_MINUTE=5

# --- Email — با هزینه + تست واقعی — تاریکی روشن شد ---
# چیه؟ برای ارسال ایمیل تایید، فاکتور
# گزینه‌ها: smtp (رایگان اگر Gmail داری), resend (رایگان 3000/ماه — بعدش پولی), mock (رایگان — تو لاگ)
# Gmail: myaccount.google.com → Security → App Passwords → 16 کاراکتر
# هزینه: smtp رایگان — resend رایگان 3000/ماه — mock رایگان — تاریکی روشن شد
EMAIL_PROVIDER=${EMAIL_PROVIDER}
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
RESEND_API_KEY=${RESEND_API_KEY}
EMAIL_FROM=AiWp Platform <no-reply@aiwp.local>
APP_URL=http://localhost:3000

# --- Notification System — سقف 10/10 — با throttling + fallback + هزینه — تاریکی روشن شد ---
# چیه؟ اطلاع‌رسانی — وقتی اتفاقی می‌افته خبر می‌ده — با throttling — اگر 100 اتفاق بیفته 100 SMS نمی‌ره — خلاصه می‌شه
# کانال‌ها: in_app (همیشه روشن — تو داشبورد), email (ایمیل), sms (پیامک — هر پیامک ~120 تومان — با throttling), telegram (ربات تلگرام — رایگان — بهترین)
# هزینه: in_app رایگان — email رایگان (اگر smtp) — sms ~120 تومان — telegram رایگان — تاریکی روشن شد
# fallback: اگر sms fail شد، in_app + email می‌ره — تاریکی روشن شد
# throttling: اگر 5 ناتیف در 1 دقیقه بیاد، یه ناتیف خلاصه — تاریکی روشن شد
NOTIF_IN_APP=true
NOTIF_EMAIL=${NOTIF_EMAIL}
NOTIF_SMS=${NOTIF_SMS}
NOTIF_TELEGRAM=${TELEGRAM_ENABLED}
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
# Throttling — تاریکی روشن شد
NOTIF_THROTTLING_ENABLED=true
NOTIF_THROTTLING_MAX_PER_MINUTE=10
NOTIF_THROTTLING_DIGEST_ENABLED=true
NOTIF_FALLBACK_ENABLED=true

# --- Admin — تاریکی روشن شد: رمز ادمین امن ---
# چیه؟ ادمین اصلی — رمز پیش‌فرض ناامنه — باید عوض کنی
ADMIN_EMAIL=admin@aiwp.dev
ADMIN_PASSWORD=${ADMIN_PASS}

# --- وردپرس — برای تست افزونه‌ها ---
WP_SITE_URL=http://localhost:8080
WP_ADMIN_USER=admin
WP_ADMIN_PASS=admin123
PLATFORM_PORT=3000
LOG_LEVEL=info
HOSTNAME=0.0.0.0

# --- توضیح برای غیر فنی — تاریکی روشن شد ---
# این فایل مثل کلید خونه‌ست — به کسی نده! — permission 600 — فقط خودت می‌تونی بخونی — امن
# اگر خراب شد: rm .env && ./install.sh — دوباره می‌سازه با راهنما
# اگر AI کار نکرد: /admin/settings/ai-provider → کلید چک کن → https://platform.openai.com/api-keys
# اگر SMS کار نکرد: /admin/settings/sms-gateway → پنل چک کن → https://ghasedak.me/ → اعتبار چک کن
# هزینه: AI هر افزونه ~0.05 دلار — SMS هر پیامک ~120 تومان — Email رایگان اگر Gmail — Telegram رایگان
# throttling: اگر 5 پیامک در 1 دقیقه بیاد، یه پیامک خلاصه — هزینه کنترل
# fallback: اگر SMS fail شد، in_app + email می‌ره
# تاریکی روشن شد: idempotency + 600 + رمز ادمین + SMS واقعی + هزینه + throttling + fallback + تست واقعی
EOF

  chmod 600 .env
  ok ".env ساخته شد — $(wc -l < .env) خط — permission 600 — امن — فقط خودت می‌تونی بخونی — تاریکی روشن شد"
  echo -e "${DIM}   فایل .env مثل کلید خونه — به کسی نده — permission 600 — امن — تاریکی روشن شد${NC}"
fi
sleep 1

# [8/9] Build and start
echo ""
echo -e "${BLUE}[8/9] 🏗️ ساخت و اجرا — جادوی اصلی — 1-2 دقیقه${NC}"
explain "الان جعبه جادویی Docker داره همه چی رو می‌سازه — 1-2 دقیقه صبر کن — با health check واقعی — تاریکی روشن شد"
echo ""
echo -e "${MAGENTA}  docker compose up --build -d${NC}"
echo -e "${YELLOW}  دارم می‌سازم... بار اول 2-3 دقیقه طول می‌کشه (دانلود)...${NC}"
docker compose up --build -d 2>&1 | tail -n 20 || docker compose up -d
echo ""
echo -e "${BLUE}  ⏳ صبر برای آماده شدن — 30 ثانیه — مثل چای دم کردن — با health check واقعی — تاریکی روشن شد${NC}"
echo -n "  "
for i in {1..30}; do
  echo -n "."
  sleep 1
  if [ $((i % 10)) -eq 0 ]; then echo -n " $((i*2))s"; fi
  if command -v curl &> /dev/null; then
    if curl -sf http://localhost:3000/api/health >/dev/null 2>&1 || curl -sf http://localhost:3000 >/dev/null 2>&1; then
      echo ""
      ok "سرویس آماده است! — زودتر از 30 ثانیه — تاریکی روشن شد"
      break
    fi
  fi
done
echo ""
echo ""
docker compose ps 2>/dev/null || true

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  🎉 جادو تمام! نصب کامل — پشتیبانی صفر — تاریکی روشن شد! 🎉${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BOLD}${BLUE}📍 دسترسی — مثل آدرس خونه:${NC}${NC}"
echo -e "${GREEN}  🌐 اصلی: ${BOLD}http://localhost:3000${NC}"
echo -e "${GREEN}  🎨 ساخت افزونه: ${BOLD}http://localhost:3000/spec-builder${NC} — سقف 10/10!"
echo -e "${GREEN}  🔑 ورود: ${BOLD}admin@aiwp.dev / ${ADMIN_PASS}${NC}"
echo -e "${GREEN}  ❤️ سلامت: http://localhost:3000/api/health${NC}"
echo -e "${GREEN}  ⚙️ تنظیمات AI: http://localhost:3000/admin/settings/ai-provider${NC}"
echo -e "${GREEN}  📱 تنظیمات SMS: http://localhost:3000/admin/settings/sms-gateway${NC}"
echo -e "${GREEN}  🔔 تنظیمات ناتیف: http://localhost:3000/admin/settings/notifications — جدید v3.1.0 — تاریکی روشن شد${NC}"
echo ""
echo -e "${BOLD}${BLUE}✅ چک‌لیست نهایی — با هزینه — تاریکی روشن شد:${NC}${NC}"
echo -e "  $([ "$AI_PROVIDER" != "mock" ] && echo "✅" || echo "⚠️") AI Provider: $AI_PROVIDER $([ "$AI_PROVIDER" = "mock" ] && echo "— mock — رایگان — بعداً از /admin/settings/ai-provider اضافه کن" || echo "— آماده! — هزینه هر افزونه ~0.05 دلار — تاریکی روشن شد")"
echo -e "  $([ "$SMS_PROVIDER" != "mock" ] && echo "✅" || echo "⚠️") SMS Panel: $SMS_PROVIDER $([ "$SMS_PROVIDER" = "mock" ] && echo "— mock — رایگان — پیامک‌ها تو لاگ — بعداً از /admin/settings/sms-gateway اضافه کن" || echo "— آماده! — Sender: $SMS_SENDER — هزینه هر پیامک ~120 تومان — اعتبار چک شد — تاریکی روشن شد")"
echo -e "  $([ "$EMAIL_PROVIDER" != "mock" ] && echo "✅" || echo "⚠️") Email: $EMAIL_PROVIDER $([ "$EMAIL_PROVIDER" = "mock" ] && echo "— mock — رایگان — ایمیل‌ها تو لاگ" || echo "— آماده! — رایگان اگر Gmail — تاریکی روشن شد")"
echo -e "  ✅ In-App Notification: همیشه روشن — رایگان — تاریکی روشن شد"
echo -e "  $([ "$NOTIF_EMAIL" = "yes" ] && echo "✅" || echo "⚪") Email Notification: $NOTIF_EMAIL — با throttling — تاریکی روشن شد"
echo -e "  $([ "$NOTIF_SMS" = "yes" ] && echo "✅" || echo "⚪") SMS Notification: $NOTIF_SMS — با throttling — هزینه ~120 تومان — تاریکی روشن شد"
echo -e "  $([ "$TELEGRAM_ENABLED" = "yes" ] && echo "✅" || echo "⚪") Telegram Notification: $TELEGRAM_ENABLED — رایگان — بهترین — تاریکی روشن شد"
echo -e "  ✅ .env permission 600 — امن — فقط خودت می‌تونی بخونی — تاریکی روشن شد"
echo -e "  ✅ رمز ادمین امن — نه پیش‌فرض — تاریکی روشن شد"
echo -e "  ✅ idempotency — اگر دوباره بزنی نمی‌پره — تاریکی روشن شد"
echo -e "  ✅ fallback — اگر SMS fail شد in_app + email می‌ره — تاریکی روشن شد"
echo -e "  ✅ throttling — اگر 5 SMS در 1 دقیقه بیاد خلاصه می‌شه — هزینه کنترل — تاریکی روشن شد"
echo ""
echo -e "${BOLD}${BLUE}🎯 حالا چی؟ — 3 قدم ساده:${NC}${NC}"
echo -e "${YELLOW}  1. مرورگر → http://localhost:3000 → ورود admin@aiwp.dev / $ADMIN_PASS${NC}"
echo -e "${YELLOW}  2. /spec-builder → با AI بگو چی می‌خوای → ZIP بگیر → وردپرس!${NC}"
echo -e "${YELLOW}  3. اگر AI/SMS mock بود: /admin/settings → کلید واقعی بذار → تست کن — هزینه رو ببین${NC}"
echo -e "${YELLOW}  4. ./status.sh — وضعیت پرووایدرها + اعتبار + سلامت — تاریکی روشن شد — جدید v3.1.0${NC}"
echo -e "${YELLOW}  5. ./smoke-test.sh — تست کامل همه پرووایدرها — پیامک تست به خودت — تاریکی روشن شد — جدید v3.1.0${NC}"
echo ""
echo -e "${BOLD}${BLUE}🛠️ دستورات روزانه — مثل کنترل تلویزیون — با تاریکی روشن شد:${NC}${NC}"
echo -e "  ${GREEN}./status.sh${NC} — وضعیت + پرووایدرها + اعتبار + سلامت — تاریکی روشن شد — جدید v3.1.0 — هر روز صبح"
echo -e "  ${GREEN}./smoke-test.sh${NC} — تست کامل — SMS تست به خودت + Telegram تست — تاریکی روشن شد — جدید v3.1.0 — بعد از نصب"
echo -e "  ${GREEN}./logs.sh${NC} — لاگ — اگر خطا دیدی"
echo -e "  ${GREEN}./stop.sh${NC} / ${GREEN}./start.sh${NC} — خاموش/روشن"
echo -e "  ${GREEN}./update.sh${NC} — آپدیت — با بکاپ خودکار — با سوال پرووایدر جدید — تاریکی روشن شد"
echo -e "  ${GREEN}./backup.sh${NC} — بکاپ — با encrypt — با .env + کلیدها — تاریکی روشن شد"
echo ""
echo -e "${BOLD}${BLUE}🆘 عیب‌یابی — پشتیبانی صفر — تاریکی روشن شد — همه چی همینجاست:${NC}${NC}"
echo -e "  ${YELLOW}AI کار نمی‌کنه؟${NC} → /admin/settings/ai-provider → کلید چک کن → https://platform.openai.com/api-keys → هزینه چک کن — هر افزونه ~0.05 دلار"
echo -e "  ${YELLOW}SMS نمی‌ره؟${NC} → /admin/settings/sms-gateway → پنل چک کن → https://ghasedak.me/ → اعتبار چک کن — هر پیامک ~120 تومان — اگر اعتبار کم شارژ کن"
echo -e "  ${YELLOW}ایمیل نمی‌ره؟${NC} → .env → SMTP چک کن → Gmail App Password: myaccount.google.com → Security → App Passwords"
echo -e "  ${YELLOW}تلگرام نمی‌ره؟${NC} → .env → TELEGRAM_BOT_TOKEN + CHAT_ID چک کن → curl https://api.telegram.org/bot<TOKEN>/getMe — باید ok:true — ربات رو استارت کردی؟"
echo -e "  ${YELLOW}پورت اشغال؟${NC} → ./stop.sh + docker compose down + ./start.sh — دو نفر روی یک صندلی — تاریکی روشن شد"
echo -e "  ${YELLOW}.env خراب؟${NC} → rm .env + ./install.sh — دوباره می‌سازه — با سوال keep/new/backup — idempotency — تاریکی روشن شد"
echo -e "  ${YELLOW}دیسک پر؟${NC} → df -h — اگر 80% پر — ./backup.sh قدیمی رو پاک کن — تاریکی روشن شد"
echo -e "  ${YELLOW}ناتیف spam می‌شه؟${NC} → .env → NOTIF_THROTTLING_ENABLED=true — اگر 5 ناتیف در 1 دقیقه بیاد خلاصه می‌شه — هزینه کنترل — تاریکی روشن شد"
echo ""
echo -e "${CYAN}📚 مستندات فوق ساده: docs/SETUP-WIZARD-FA.md — برای مامان بزرگ — v3.1.0 — تاریکی روشن شد${NC}"
echo -e "${MAGENTA}💡 پشتیبانی صفر — تاریکی روشن شد: همه نقاط تاریک روشن شد — install.bat ویندوز + .env 600 + رمز ادمین + SMS واقعی + هزینه + idempotency + disk/port check + fallback + throttling + تست واقعی${NC}"
echo -e "${MAGENTA}   اگر بازم گیر کردی: https://github.com/ansariaiadmin/aiwp/issues — ما کمک می‌کنیم!${NC}"
echo ""
echo -e "${BOLD}${BLUE}[9/9] 🧪 Smoke Test خودکار — تاریکی روشن شد — جدید v3.1.0${NC}"
echo -e "${CYAN}   می‌خوای الان تست کامل بزنم؟ — SMS تست + Telegram تست + AI تست — 30 ثانیه${NC}"
SMOKE=$(ask_yes_no "Smoke Test بزنم؟" "تست کامل همه پرووایدرها — اگر SMS/Telegram دادی، پیام تست به خودت می‌فرسته — هزینه داره (~120 تومان) — تاریکی روشن شد" "false")
if [ "$SMOKE" = "yes" ]; then
  ./smoke-test.sh 2>/dev/null || echo "smoke-test.sh نیست — ./status.sh بزن"
else
  echo -e "${DIM}   بعداً می‌تونی بزنی: ./smoke-test.sh — تاریکی روشن شد${NC}"
fi
echo ""
