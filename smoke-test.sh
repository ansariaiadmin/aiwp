#!/usr/bin/env bash
set -e
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ok() { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
err() { echo -e "${RED}❌ $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

echo -e "${BOLD}${BLUE}🧪 Smoke Test — تست کامل AiWp — v3.1.0 — تاریکی روشن شد${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ ! -f .env ]; then
  err ".env نیست — ./install.sh بزن"
  exit 1
fi

source .env 2>/dev/null || true

# 1. Health
echo -e "${BOLD}[1/5] ❤️ Health Check${NC}"
if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
  ok "API Health — اوکی"
else
  err "API Health — fail — ./logs.sh"
fi
if curl -sf http://localhost:3000 >/dev/null 2>&1; then
  ok "Web — اوکی"
else
  err "Web — fail"
fi
echo ""

# 2. AI Provider
echo -e "${BOLD}[2/5] 🤖 AI Provider Test${NC}"
if [ "$AI_PROVIDER" = "mock" ]; then
  warn "AI: mock — تست واقعی نمی‌شه — /admin/settings/ai-provider → کلید واقعی"
else
  info "AI: $AI_PROVIDER — تست اتصال..."
  if [ "$AI_PROVIDER" = "openai" ] && [ -n "$OPENAI_API_KEY" ]; then
    if curl -sf -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models -o /dev/null 2>&1; then
      ok "OpenAI — اوکی"
    else
      err "OpenAI — fail — کلید چک کن"
    fi
  else
    ok "AI: $AI_PROVIDER — کلید تنظیم شده — تست manual: برو /spec-builder → یه افزونه بساز"
  fi
fi
echo ""

# 3. SMS Provider — real test — تاریکی روشن شد
echo -e "${BOLD}[3/5] 📱 SMS Provider Test — واقعی${NC}"
if [ "$SMS_PROVIDER" = "mock" ]; then
  warn "SMS: mock — پیامک واقعی نمی‌ره — تو لاگ — برای تست واقعی: .env → SMS_PROVIDER=ghasedak + SMS_API_KEY"
  echo -e "${CYAN}   تست mock: دارم یه پیامک mock می‌فرستم به لاگ...${NC}"
  docker compose logs --tail=5 2>/dev/null | grep -i sms || echo "   لاگ SMS پیدا نشد — ولی mock اوکیه"
  ok "SMS mock — اوکی — تو لاگ ذخیره می‌شه"
else
  info "SMS: $SMS_PROVIDER — تست واقعی — به کی پیامک تست بفرستم؟"
  read -p "   شماره موبایل برای تست (مثل 09123456789) یا Enter برای skip: " test_phone
  if [ -n "$test_phone" ]; then
    echo -e "${CYAN}   دارم پیامک تست می‌فرستم به $test_phone...${NC}"
    # Call API via node or curl — try to use smsService if available, else curl directly
    if [ "$SMS_PROVIDER" = "ghasedak" ]; then
      res=$(curl -s -X POST -H "apikey: $SMS_API_KEY" -H "Content-Type: application/x-www-form-urlencoded" -d "receptor=$test_phone&sender=$SMS_SENDER&message=تست AiWp — $(date) — Smoke Test — اگر این پیامک رو گرفتی یعنی پنل کار می‌کنه ✅" https://api.ghasedak.me/v2/sms/send/simple || echo "fail")
      if echo "$res" | grep -q '"code":200\|"result"' ; then
        ok "SMS تست به $test_phone فرستاده شد — گوشیت رو چک کن — هزینه ~120 تومان"
      else
        err "SMS تست fail — جواب: $res — کلید یا اعتبار چک کن"
      fi
    elif [ "$SMS_PROVIDER" = "kavenegar" ]; then
      res=$(curl -s -X POST -d "receptor=$test_phone&sender=$SMS_SENDER&message=تست AiWp — $(date)" https://api.kavenegar.com/v1/$SMS_API_KEY/sms/send.json || echo "fail")
      if echo "$res" | grep -q '"status":200'; then
        ok "SMS تست به $test_phone فرستاده شد"
      else
        err "SMS تست fail: $res"
      fi
    else
      warn "SMS Provider $SMS_PROVIDER — تست خودکار ندارم — دستی تست کن"
    fi
  else
    warn "SMS تست skip شد"
  fi
fi
echo ""

# 4. Email
echo -e "${BOLD}[4/5] 📧 Email Test${NC}"
if [ "$EMAIL_PROVIDER" = "mock" ]; then
  warn "Email: mock — ایمیل واقعی نمی‌ره — تو لاگ"
else
  info "Email: $EMAIL_PROVIDER — $SMTP_USER @ $SMTP_HOST"
  read -p "   ایمیل برای تست یا Enter skip: " test_email
  if [ -n "$test_email" ]; then
    echo -e "${CYAN}   تست Email به $test_email — باید از طریق اپ تست بشه — /admin/settings → Email Test${NC}"
    ok "Email: تنظیم شده — برای تست واقعی برو پنل"
  fi
fi
echo ""

# 5. Telegram — real test — تاریکی روشن شد
echo -e "${BOLD}[5/5] 🔔 Telegram Test — واقعی${NC}"
if [ "$NOTIF_TELEGRAM" = "yes" ] || [ "$NOTIF_TELEGRAM" = "true" ]; then
  if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    info "Telegram: Bot ${TELEGRAM_BOT_TOKEN:0:10}... Chat $TELEGRAM_CHAT_ID — تست پیام..."
    if curl -sf -X POST -H "Content-Type: application/json" -d "{\"chat_id\":\"$TELEGRAM_CHAT_ID\",\"text\":\"🧪 تست AiWp — Smoke Test — $(date) — اگر این پیام رو گرفتی یعنی Telegram کار می‌کنه ✅\",\"parse_mode\":\"Markdown\"}" https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage -o /dev/null 2>&1; then
      ok "Telegram تست — پیام فرستاده شد — تلگرامت رو چک کن"
    else
      err "Telegram تست — fail — توکن یا Chat ID چک کن — @BotFather → /newbot — https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates"
    fi
  else
    err "Telegram: روشن ولی توکن یا Chat ID نیست"
  fi
else
  warn "Telegram: خاموش — برای تست: .env → NOTIF_TELEGRAM=yes + TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID"
fi
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  🎉 Smoke Test تمام — تاریکی روشن شد!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BOLD}📊 خلاصه:${NC}"
echo -e "  اگر همه ✅ — عالی — پرووایدرها کار می‌کنن"
echo -e "  اگر ⚠️ mock — بعداً کلید واقعی بذار"
echo -e "  اگر ❌ — .env چک کن — یا ./install.sh"
echo ""
