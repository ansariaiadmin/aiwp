@echo off
echo ========================================
echo   AiWp — WordPress Plugin Factory + SaaS License Platform - Auto Installer
echo   کارخانه افزونه وردپرس + پلتفرم لایسنس
echo ========================================
echo.
echo For non-technical - just press Enter
echo.

echo [1/4] Checking Docker...
docker --version
if %errorlevel% neq 0 (
  echo Docker not found - please install Docker Desktop https://docs.docker.com/get-docker/
  pause
  exit /b 1
)
docker compose version
if %errorlevel% neq 0 (
  echo Docker Compose V2 not found
  pause
  exit /b 1
)

echo [2/4] Checking Git...
git --version

echo [3/4] Creating .env with random secrets...
if not exist .env (
  if exist .env.example (
    copy .env.example .env >nul
    rem Generate cryptographically-random hex secrets for the two required vars.
    powershell -NoProfile -Command "$rng=[System.Security.Cryptography.RandomNumberGenerator]::Create(); function New-Sec{$b=New-Object byte[] 32; $rng.GetBytes($b); return [BitConverter]::ToString($b).Replace('-','').ToLower()}; (Get-Content .env) -replace '^SESSION_SECRET=.*',('SESSION_SECRET='+(New-Sec)) -replace '^ENCRYPTION_KEY=.*',('ENCRYPTION_KEY='+(New-Sec)) | Set-Content .env"
    echo .env created from .env.example with random SESSION_SECRET / ENCRYPTION_KEY
  ) else (
    echo Please create .env manually.
    pause
    exit /b 1
  )
) else (
  echo .env already exists
)

echo [4/4] Building and starting...
docker compose up --build -d
timeout /t 30 /nobreak >nul
docker compose ps

rem Run migrations + seed the first admin account with a random password
set "ADMIN_PASSWORD=%RANDOM%%RANDOM%"
powershell -NoProfile -Command "$chars='abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -join ((1..14)|%%{$chars[(Get-Random -Max $chars.Length)]})" > tmp_pass.txt
set /p ADMIN_PASSWORD=<tmp_pass.txt
del tmp_pass.txt
docker compose run --rm platform node scripts/migrate.mjs
docker compose run --rm platform node scripts/seed-admin.mjs --email admin@aiwp.dev --password %ADMIN_PASSWORD% --name Admin

echo.
echo ========================================
echo Installation Complete! / نصب تمام شد!
echo URL: http://localhost:3000
echo Login: admin@aiwp.dev
echo Password: %ADMIN_PASSWORD%
echo (Write it down now - it is not stored anywhere.)
echo ========================================
echo For logs: logs.bat
echo For status: status.bat
echo For update: update.bat
pause
