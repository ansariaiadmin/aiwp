#!/usr/bin/env bash
set -e
# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  AnsariAiWP — WordPress Plugin Factory + SaaS License Platform${NC}"
echo -e "${BLUE}  by Mohammad Ansari — https://ansariai.ir${NC}"
echo -e "${BLUE}  نصب خودکار - Auto Installer v1.0.5${NC}"
echo -e "${BLUE}  کارخانه افزونه وردپرس + پلتفرم لایسنس${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}برای افراد غیر فنی - فقط Enter بزنید تا نصب خودکار شروع شود${NC}"
echo -e "${YELLOW}For non-technical users - just press Enter to start auto install${NC}"
echo ""
read -p "برای ادامه Enter بزنید / Press Enter to continue..." _

# Check OS
echo -e "${BLUE}[1/6] بررسی سیستم / Checking system...${NC}"
uname -a
echo ""

# Check Docker
echo -e "${BLUE}[2/6] بررسی Docker / Checking Docker...${NC}"
if ! command -v docker &> /dev/null; then
  echo -e "${RED}Docker نصب نیست / Docker not found${NC}"
  echo "لطفا Docker را نصب کنید: https://docs.docker.com/get-docker/"
  echo "Please install Docker: https://docs.docker.com/get-docker/"
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "در حال تلاش نصب خودکار Docker / Trying auto install..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER || true
    echo -e "${YELLOW}لطفا دوباره لاگین کنید و دوباره نصب را اجرا کنید / Please re-login and run again${NC}"
  fi
  exit 1
else
  echo -e "${GREEN}✓ Docker نصب است / Docker found: $(docker --version)${NC}"
fi

if ! docker compose version &> /dev/null; then
  echo -e "${RED}Docker Compose V2 نصب نیست / Docker Compose not found${NC}"
  echo "لطفا Docker Desktop یا Compose V2 نصب کنید"
  exit 1
else
  echo -e "${GREEN}✓ Docker Compose: $(docker compose version)${NC}"
fi
echo ""

# Check Git
echo -e "${BLUE}[3/6] بررسی Git / Checking Git...${NC}"
if ! command -v git &> /dev/null; then
  echo -e "${RED}Git نصب نیست / Git not found - لطفا نصب کنید${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Git: $(git --version)${NC}"
echo ""

echo -e "${BLUE}[4/6] آماده‌سازی محیط / Preparing environment...${NC}"

# Generate .env
echo -e "${BLUE}[5/6] ساخت فایل تنظیمات / Creating config...${NC}"
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo -e "${GREEN}کپی .env.example به .env / Copying .env.example to .env${NC}"
    cp .env.example .env
    # Generate secrets (hex avoids '/' breaking sed replacements)
    if command -v openssl &> /dev/null; then
      SECRET=$(openssl rand -hex 32)
      SECRET2=$(openssl rand -hex 32)
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|change-me-session-secret-32-chars-minimum|$SECRET|g" .env
        sed -i '' "s|change-me-encryption-key-16-chars-minimum|$SECRET2|g" .env
      else
        sed -i "s|change-me-session-secret-32-chars-minimum|$SECRET|g" .env
        sed -i "s|change-me-encryption-key-16-chars-minimum|$SECRET2|g" .env
      fi
      echo -e "${GREEN}✓ رمزهای تصادفی ساخته شد / Random secrets generated${NC}"
    else
      echo -e "${RED}openssl یافت نشد — بدون آن app بوت نمی‌شود / openssl not found, app cannot boot${NC}"
      exit 1
    fi
  else
    echo -e "${RED}.env.example وجود ندارد / .env.example not found${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ فایل .env ساخته شد / .env created${NC}"
else
  echo -e "${BLUE}.env از قبل وجود دارد / .env already exists, skipping${NC}"
fi
echo ""

# Build and start
echo -e "${BLUE}[6/6] ساخت و اجرا / Building and starting...${NC}"
ADMIN_PASS=$(openssl rand -hex 6 2>/dev/null || echo "ChangeMe-$(date +%s)")
if [ -f docker-compose.yml ]; then
  echo "docker compose up --build -d"
  docker compose up --build -d
  echo ""
  echo -e "${BLUE}صبر برای آماده شدن / Waiting to be ready...${NC}"
  READY=0
  for i in {1..45}; do
    echo -n "."
    sleep 2
    if command -v curl &> /dev/null; then
      if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
        echo ""
        echo -e "${GREEN}✓ سرویس آماده است / Service ready!${NC}"
        READY=1
        break
      fi
    fi
  done
  echo ""
  docker compose ps

  # Run DB migrations inside the app container (idempotent).
  echo -e "${BLUE}مهاجرت دیتابیس / Running database migrations...${NC}"
  if docker compose exec -T platform node scripts/migrate.mjs 2>/dev/null; then
    echo -e "${GREEN}✓ مهاجرت انجام شد / Migrations applied${NC}"
  else
    echo -e "${YELLOW}مهاجرت خودکار انجام نشد؛ بعداً اجرا کنید: docker compose exec platform node scripts/migrate.mjs${NC}"
    echo -e "${YELLOW}Auto-migrate failed; run manually later: docker compose exec platform node scripts/migrate.mjs${NC}"
  fi

  # Seed the first admin account with a random password.
  echo -e "${BLUE}ساخت حساب ادمین / Seeding admin account...${NC}"
  if docker compose exec -T platform node scripts/seed-admin.mjs \
       --email "admin@ansariai.local" --password "$ADMIN_PASS" --name "AnsariAiWP Admin" 2>/dev/null; then
    echo -e "${GREEN}✓ ادمین ساخته شد / Admin created${NC}"
  else
    echo -e "${YELLOW}ساخت ادمین خودکار انجام نشد؛ راهنما: docs/USER_GUIDE_EN.md / Admin seed skipped${NC}"
    ADMIN_PASS="(seed failed — see docs)"
  fi
else
  echo -e "${RED}docker-compose.yml یافت نشد / not found in $(pwd)${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ نصب تمام شد! / Installation Complete! 🎉${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}اطلاعات دسترسی / Access Info:${NC}"
echo -e "  آدرس / URL: http://localhost:3000"
echo -e "  ورود / Login: admin@ansariai.local / ${ADMIN_PASS}"
echo -e "  سلامت / Health: http://localhost:3000/api/health"
echo -e "${YELLOW}⚠️ همین رمز را ذخیره کنید — بعداً قابل بازیابی نیست / Save this password now; it cannot be recovered later.${NC}"
echo ""
echo -e "${BLUE}دستورات مفید / Useful Commands:${NC}"
echo -e "  ./status.sh  - وضعیت / Status"
echo -e "  ./logs.sh    - لاگ‌ها / Logs"
echo -e "  ./stop.sh    - توقف / Stop"
echo -e "  ./start.sh   - شروع / Start"
echo -e "  ./update.sh  - آپدیت / Update"
echo -e "  ./backup.sh  - بکاپ / Backup"
echo ""
echo -e "${YELLOW}مستندات کامل / Full docs: ./docs/USER_GUIDE_FA.md${NC}"
echo ""
