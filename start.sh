#!/usr/bin/env bash
set -e
echo "شروع AiWp — WordPress Plugin Factory + SaaS License Platform / Starting AiWp — WordPress Plugin Factory + SaaS License Platform..."
if [ -f docker-compose.yml ]; then
  docker compose up -d
  docker compose ps
  echo "✓ اجرا شد / Started - http://localhost:3000"
else
  echo "برای شروع، docker-compose.yml باید در ریشه ریپو باشد / docker-compose.yml must be in the repo root."
  exit 1
fi
