#!/usr/bin/env bash
set -e
# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  AiWp — WordPress Plugin Factory + SaaS License Platform${NC}"
echo -e "${BLUE}  نصب خودکار - Auto Installer v1.0.1${NC}"
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

# Docker is required for the web platform (docker compose up below).
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

# Optional local toolchain (not required — everything runs inside Docker,
# but useful hints for the PHP factory workflow)
echo -e "${BLUE}[4/6] بررسی وابستگی‌ها / Checking dependencies...${NC}"
if command -v node &> /dev/null; then
  echo -e "${GREEN}✓ Node: $(node --version)${NC}"
else
  echo -e "${YELLOW}Node یافت نشد ولی Docker کافی است / Node not found but Docker is enough${NC}"
fi
if command -v php &> /dev/null; then
  echo -e "${GREEN}✓ PHP: $(php -r 'echo PHP_VERSION;')${NC}"
else
  echo -e "${YELLOW}PHP یافت نشد (فقط برای کارخانه پلاگین لازم است / only needed for the plugin factory)${NC}"
fi
echo ""

# Generate .env
echo -e "${BLUE}[5/6] ساخت فایل تنظیمات / Creating config...${NC}"
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo -e "${GREEN}کپی .env.example به .env / Copying .env.example to .env${NC}"
    cp .env.example .env
    # Generate real secrets for SESSION_SECRET / ENCRYPTION_KEY.
    # base64 can contain '/', '+' and '=' which break naive sed replacement,
    # so we strip them and use hex-safe characters only (>=48 chars keeps the
    # 32-char minimum that platform/src/lib/env.ts enforces).
    gen_secret() {
      if command -v openssl &> /dev/null; then
        openssl rand -hex 32 2>/dev/null
      elif [ -r /dev/urandom ]; then
        head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
      else
        return 1
      fi
    }
    SECRET="$(gen_secret)" || SECRET=""
    SECRET2="$(gen_secret)" || SECRET2=""
    if [ -n "$SECRET" ] && [ -n "$SECRET2" ]; then
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^SESSION_SECRET=.*|SESSION_SECRET=$SECRET|" .env
        sed -i '' "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$SECRET2|" .env
      else
        sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$SECRET|" .env
        sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$SECRET2|" .env
      fi
      echo -e "${GREEN}✓ رمزهای تصادفی ساخته شد / Random secrets generated${NC}"
    else
      echo -e "${YELLOW}رمزساز یافت نشد، SESSION_SECRET و ENCRYPTION_KEY را دستی در .env عوض کنید / no secret generator found, edit .env manually${NC}"
    fi
  else
    echo -e "${YELLOW}.env.example وجود ندارد، .env خالی می‌سازیم / .env.example not found, creating empty .env${NC}"
    touch .env
  fi
  echo -e "${GREEN}✓ فایل .env ساخته شد / .env created - لطفا آن را ویرایش کنید اگر نیاز است${NC}"
else
  echo -e "${BLUE}.env از قبل وجود دارد / .env already exists, skipping${NC}"
fi
echo ""

# Build and start
echo -e "${BLUE}[6/6] ساخت و اجرا / Building and starting...${NC}"
if [ ! -f docker-compose.yml ]; then
  echo -e "${RED}docker-compose.yml یافت نشد / not found — آیا مخزن کامل را clone کرده‌اید؟ / did you clone the full repo?${NC}"
  exit 1
fi
echo "docker compose up --build -d"
docker compose up --build -d
echo ""
echo -e "${BLUE}صبر برای آماده شدن / Waiting to be ready (up to 90s)...${NC}"
_READY=0
for i in {1..45}; do
  echo -n "."
  sleep 2
  if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
    echo ""
    echo -e "${GREEN}✓ سرویس آماده است / Service ready!${NC}"
    _READY=1
    break
  fi
done
echo ""
docker compose ps

# Run DB migrations + create the first admin account (seed-admin.mjs requires
# a password of at least 10 characters).
ADMIN_EMAIL="admin@aiwp.dev"
ADMIN_PASSWORD="$(openssl rand -hex 6 2>/dev/null || echo 'ChangeMe-Now-123')"
if [ "$_READY" = "1" ]; then
  echo -e "${BLUE}اجرای مهاجرت دیتابیس / Running migrations...${NC}"
  docker compose run --rm platform node scripts/migrate.mjs || true
  echo -e "${BLUE}ساخت حساب ادمین / Seeding admin account...${NC}"
  docker compose run --rm platform node scripts/seed-admin.mjs --email "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD" --name "Admin" || \
    echo -e "${YELLOW}سید ادمین ناموفق بود؛ دستی بسازید / seed failed, run it manually:${NC}\n  docker compose run --rm platform node scripts/seed-admin.mjs --email <you@example.com> --password '<10+ chars>'"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ نصب تمام شد! / Installation Complete! 🎉${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}اطلاعات دسترسی / Access Info:${NC}"
echo -e "  آدرس / URL: http://localhost:3000"
echo -e "  ورود / Login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}"
echo -e "  سلامت / Health: http://localhost:3000/api/health"
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
