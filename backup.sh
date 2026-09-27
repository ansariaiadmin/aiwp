#!/usr/bin/env bash
set -e
BACKUP_DIR="./backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "بکاپ گیری AiWp — WordPress Plugin Factory + SaaS License Platform / Backup AiWp — WordPress Plugin Factory + SaaS License Platform to $BACKUP_DIR"
if [ -f .env ]; then cp .env "$BACKUP_DIR/"; echo "✓ .env"; fi
if [ -f docker-compose.yml ] && command -v docker &> /dev/null; then
  docker compose ps > "$BACKUP_DIR/ps.txt" 2>&1 || true

  # Discover the real volume name(s) from compose (project name = directory
  # name, e.g. aiwp_pgdata) instead of guessing — a wrong guess made the
  # database backup silently skip every time.
  VOLUMES=$(docker volume ls --format '{{.Name}}' 2>/dev/null | grep -E "^(aiwp|$(basename "$(pwd)"))_" || true)
  if [ -n "$VOLUMES" ]; then
    for VOL in $VOLUMES; do
      docker run --rm -v "$VOL":/volume:ro -v "$(pwd)/$BACKUP_DIR":/backup alpine \
        tar czf "/backup/$(date +%Y%m%d-%H%M%S)-${VOL}.tar.gz" -C /volume 2>/dev/null \
        && echo "✓ volume $VOL" || echo "⚠ volume $VOL could not be backed up"
    done
  else
    echo "⚠ no compose volumes found (is the stack running?)"
  fi
fi
# For file based data
if [ -d data ]; then cp -r data "$BACKUP_DIR/" 2>/dev/null && echo "✓ data/"; fi
if [ -d uploads ]; then cp -r uploads "$BACKUP_DIR/" 2>/dev/null && echo "✓ uploads/"; fi
ls -lh "$BACKUP_DIR"
echo "✓ بکاپ تمام شد / Backup complete: $BACKUP_DIR"
