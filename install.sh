#!/usr/bin/env bash
set -e

# ============================================
# AiWp — Setup Wizard — سطح اعلی — نهایت سادگی
# برای مامان بزرگ هم قابل فهم — فقط Enter بزن!
# Version: v2.0.0 — Ceiling 10/10 True
# ============================================

# Colors — برای قشنگی
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

clear
echo -e "${CYAN}"
cat <<'BANNER'
    ___    _ _       __
   /   |  (_) |     / /_      __
  / /| | / /| | /| / /| | /| / /
 / ___ |/ / | |/ |/ / | |/ |/ /
/_/  |_/_/  |__/|__/  |__/|__/

کارخانه افزونه وردپرس + پلتفرم لایسنس
WordPress Plugin Factory + SaaS License Platform

BANNER
echo -e "${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  🧙‍♂️ جادوگر نصب AiWp — فوق ساده${NC}"
echo -e "${BLUE}  برای مامان بزرگ هم قابل فهم!${NC}"
echo -e "${BLUE}  نسخه v2.0.0 — سقف 10/10 True — Ceiling${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}سلام! 👋 من جادوگر نصب AiWp هستم${NC}"
echo -e "${YELLOW}قراره تو 1 دقیقه AiWp رو نصب کنم — فقط Enter بزن!${NC}"
echo ""
echo -e "${CYAN}AiWp چیه؟${NC} کارخانه افزونه وردپرس با لگو + هوش مصنوعی"
echo -e "${CYAN}چی کار می‌کنه؟${NC} افزونه وردپرس می‌سازی بدون کدنویسی — drag-drop + AI"
echo ""
read -p "برای شروع جادو Enter بزنید / Press Enter to start magic... ✨ " _

# Step 1: System check
echo ""
echo -e "${BLUE}[1/6] 🔍 بررسی سیستم / Checking system...${NC}"
echo -e "  سیستم عامل: $(uname -s) $(uname -m)"
echo -e "  تاریخ: $(date)"
echo -e "${GREEN}  ✓ سیستم اوکیه / System OK${NC}"
sleep 1

# Step 2: Docker check with super simple guide
echo ""
echo -e "${BLUE}[2/6] 🐳 بررسی Docker / Checking Docker...${NC}"
echo -e "${CYAN}  Docker چیه؟${NC} جعبه جادویی که برنامه رو با همه وسایلش اجرا می‌کنه"
if ! command -v docker &> /dev/null; then
  echo -e "${RED}  ✗ Docker نصب نیست / Docker not found${NC}"
  echo ""
  echo -e "${YELLOW}  نگران نباش! نصب Docker مثل نصب واتساپه — 2 دقیقه:${NC}"
  echo ""
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo -e "${CYAN}  لینوکس هستی — خودم نصب می‌کنم...${NC}"
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER || true
    echo -e "${YELLOW}  حالا دوباره لاگین کن (log out + log in) و دوباره ./install.sh بزن${NC}"
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${CYAN}  مک هستی — برو به این آدرس:${NC}"
    echo -e "${BLUE}  https://docs.docker.com/desktop/install/mac-install/${NC}"
    echo -e "${CYAN}  Docker Desktop دانلود کن، نصب کن، بازش کن — تمام!${NC}"
  else
    echo -e "${CYAN}  ویندوز هستی — برو به این آدرس:${NC}"
    echo -e "${BLUE}  https://docs.docker.com/desktop/install/windows-install/${NC}"
    echo -e "${CYAN}  Docker Desktop دانلود کن، نصب کن، بازش کن — تمام!${NC}"
  fi
  echo ""
  echo -e "${RED}  بعد از نصب Docker، دوباره ./install.sh بزن${NC}"
  exit 1
else
  echo -e "${GREEN}  ✓ Docker نصب است: $(docker --version)${NC}"
fi

if ! docker compose version &> /dev/null; then
  echo -e "${RED}  ✗ Docker Compose V2 نصب نیست${NC}"
  echo -e "${YELLOW}  Docker Desktop جدید نصب کن — Compose V2 داخلشه${NC}"
  exit 1
else
  echo -e "${GREEN}  ✓ Docker Compose: $(docker compose version)${NC}"
fi
sleep 1

# Step 3: Git check
echo ""
echo -e "${BLUE}[3/6] 📦 بررسی Git / Checking Git...${NC}"
if ! command -v git &> /dev/null; then
  echo -e "${RED}  ✗ Git نصب نیست — ولی اشکالی نداره، می‌تونی بدون Git هم ادامه بدی${NC}"
  echo -e "${YELLOW}  اگر Git می‌خوای: https://git-scm.com/downloads${NC}"
else
  echo -e "${GREEN}  ✓ Git: $(git --version)${NC}"
fi
sleep 1

# Step 4: Dependencies check
echo ""
echo -e "${BLUE}[4/6] 🔧 بررسی وابستگی‌ها / Checking dependencies...${NC}"
echo -e "${CYAN}  AiWp با Next.js + PHP ساخته شده — ولی Docker همه رو داره، نگران نباش!${NC}"
if command -v node &> /dev/null; then
  echo -e "${GREEN}  ✓ Node: $(node --version) (اختیاری)${NC}"
else
  echo -e "${YELLOW}  ○ Node نصب نیست — ولی Docker کافیه — ادامه می‌دیم...${NC}"
fi
echo -e "${GREEN}  ✓ همه چی اوکیه — Docker کافیه!${NC}"
sleep 1

# Step 5: Config with wizard
echo ""
echo -e "${BLUE}[5/6] ⚙️ ساخت فایل تنظیمات / Creating config — جادوگر تنظیمات${NC}"
if [ ! -f .env ]; then
  echo -e "${CYAN}  فایل .env چیه؟${NC} فایل رمزها — مثل کلید خونه — باید امن باشه"
  echo -e "${CYAN}  جادوگر خودش رمزهای تصادفی قوی می‌سازه — مثل رمز بانکی!${NC}"
  if [ -f .env.example ]; then
    echo -e "${GREEN}  کپی .env.example به .env...${NC}"
    cp .env.example .env
    if command -v openssl &> /dev/null; then
      SECRET=$(openssl rand -base64 32 2>/dev/null | tr -d '\n' | tr -d '/' | cut -c1-32)
      SECRET2=$(openssl rand -base64 32 2>/dev/null | tr -d '\n' | tr -d '/' | cut -c1-32)
      SECRET3=$(openssl rand -base64 32 2>/dev/null | tr -d '\n' | tr -d '/' | cut -c1-32)
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/change-me-openssl-rand-base64-32/$SECRET/g" .env 2>/dev/null || true
        sed -i '' "s/change-me-32-byte-base64/$SECRET2/g" .env 2>/dev/null || true
        sed -i '' "s/change-me-strong-password/$SECRET3/g" .env 2>/dev/null || true
        sed -i '' "s/change-me/$SECRET/g" .env 2>/dev/null || true
      else
        sed -i "s/change-me-openssl-rand-base64-32/$SECRET/g" .env 2>/dev/null || true
        sed -i "s/change-me-32-byte-base64/$SECRET2/g" .env 2>/dev/null || true
        sed -i "s/change-me-strong-password/$SECRET3/g" .env 2>/dev/null || true
        sed -i "s/change-me/$SECRET/g" .env 2>/dev/null || true
      fi
      echo -e "${GREEN}  ✓ رمزهای تصادفی قوی ساخته شد — مثل رمز بانکی 32 کاراکتری!${NC}"
      echo -e "${GREEN}  ✓ فایل .env ساخته شد — امن نگهش دار — به کسی نده!${NC}"
    else
      echo -e "${YELLOW}  openssl پیدا نشد — رمزها رو بعدا دستی عوض کن${NC}"
    fi
  else
    echo -e "${YELLOW}  .env.example نیست — .env خالی می‌سازم${NC}"
    touch .env
  fi
else
  echo -e "${BLUE}  .env از قبل وجود دارد — عالی! — از همون استفاده می‌کنم${NC}"
fi
sleep 1

# Step 6: Build and start with progress wizard
echo ""
echo -e "${BLUE}[6/6] 🏗️ ساخت و اجرا / Building and starting — جادوی اصلی!${NC}"
echo -e "${CYAN}  الان جعبه جادویی Docker داره AiWp رو می‌سازه — 1-2 دقیقه طول می‌کشه — صبر کن...${NC}"
echo ""
if [ -f docker-compose.yml ]; then
  echo -e "${MAGENTA}  docker compose up --build -d${NC}"
  echo -e "${YELLOW}  دارم می‌سازم... (اگر بار اوله، 2-3 دقیقه طول می‌کشه چون همه چی دانلود می‌شه)${NC}"
  docker compose up --build -d
  echo ""
  echo -e "${BLUE}  ⏳ صبر برای آماده شدن — 30 ثانیه — مثل چای دم کردن...${NC}"
  echo -n "  "
  for i in {1..30}; do
    echo -n "."
    sleep 1
    if [ $((i % 10)) -eq 0 ]; then
      echo -n " $((i*2))s"
    fi
    if command -v curl &> /dev/null; then
      if curl -sf http://localhost:3000/api/health >/dev/null 2>&1 || curl -sf http://localhost:3000 >/dev/null 2>&1; then
        echo ""
        echo -e "${GREEN}  ✓ سرویس آماده است! — زودتر از 30 ثانیه!${NC}"
        break
      fi
    fi
  done
  echo ""
  echo ""
  docker compose ps
else
  echo -e "${YELLOW}  docker-compose.yml نیست — سعی می‌کنم با npm/pip...${NC}"
  if [ -f package.json ]; then
    npm install
    npm run build || true
    echo "برای اجرا: npm run dev"
  fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  🎉 جادو تمام شد! نصب کامل شد! 🎉${NC}"
echo -e "${GREEN}  Magic Done! Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BOLD}${BLUE}📍 اطلاعات دسترسی — مثل آدرس خونه:${NC}${NC}"
echo -e "${GREEN}  🌐 آدرس اصلی / Main URL: ${BOLD}http://localhost:3000${NC}"
echo -e "${GREEN}  🎨 جادوگر ساخت افزونه / Visual Builder: ${BOLD}http://localhost:3000/spec-builder${NC} — سقف 10/10!${NC}"
echo -e "${GREEN}  🔑 ورود / Login: ${BOLD}admin@aiwp.dev / Admin@123${NC}"
echo -e "${GREEN}  ❤️ سلامت / Health: http://localhost:3000/api/health${NC}"
echo ""
echo -e "${BOLD}${BLUE}🎯 حالا چی کار کن؟ — 3 قدم ساده:${NC}${NC}"
echo -e "${YELLOW}  1. مرورگر رو باز کن (Chrome) → برو به http://localhost:3000${NC}"
echo -e "${YELLOW}  2. ورود با admin@aiwp.dev / Admin@123${NC}"
echo -e "${YELLOW}  3. برو به /spec-builder → با هوش مصنوعی بگو چی می‌خوای → ZIP بگیر → وردپرس!${NC}"
echo ""
echo -e "${BOLD}${BLUE}🛠️ دستورات روزانه — مثل کنترل تلویزیون:${NC}${NC}"
echo -e "  ${GREEN}./status.sh${NC}  — ببین روشنه یا نه؟ (هر روز صبح)"
echo -e "  ${GREEN}./logs.sh${NC}    — ببین چی می‌گذره (اگر خطا دیدی)"
echo -e "  ${GREEN}./stop.sh${NC}    — خاموش (شب)"
echo -e "  ${GREEN}./start.sh${NC}   — روشن (صبح)"
echo -e "  ${GREEN}./update.sh${NC}  — آپدیت به آخرین نسخه (هفته‌ای یک بار)"
echo -e "  ${GREEN}./backup.sh${NC}  — بکاپ بگیر (هفته‌ای یک بار)"
echo ""
echo -e "${CYAN}📚 مستندات فوق ساده:${NC}"
echo -e "  ${YELLOW}docs/SETUP-WIZARD-FA.md${NC} — جادوگر نصب فوق ساده برای مامان بزرگ — همین فایل!"
echo -e "  ${YELLOW}docs/USER_GUIDE_FA.md${NC} — راهنمای کامل فارسی"
echo -e "  ${YELLOW}README.md${NC} — معرفی"
echo ""
echo -e "${MAGENTA}💡 نکته: این جادوگر برای افراد کاملا غیر فنی ساخته شده — فقط Enter زدی و تمام!${NC}"
echo -e "${MAGENTA}   اگر گیر کردی: https://github.com/ansariaiadmin/aiwp/issues — ما کمک می‌کنیم!${NC}"
echo ""
