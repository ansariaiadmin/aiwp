#!/usr/bin/env bash
#
# AiWp — one-file launcher for Ubuntu / Debian.
#
# Double-click AiWp.desktop (or run ./start-aiwp.sh) and the platform comes
# up in your browser. On the FIRST run it downloads Node.js and the npm
# dependencies and builds the app; every later run reuses what is already in
# .runtime/ and starts in a couple of seconds.
#
# Nothing is installed system-wide and sudo is never required:
#   - Node.js is unpacked into .runtime/node/
#   - the database is PGlite (an in-process WebAssembly PostgreSQL), so no
#     system PostgreSQL is needed
#   - every step leaves a marker file in .runtime/markers/ so it is skipped
#     next time
#
set -euo pipefail

# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------
NODE_VERSION="${AIWP_NODE_VERSION:-v22.22.3}"
NODE_MAJOR_REQUIRED=22
PORT="${AIWP_PORT:-8787}"
DB_PORT="${AIWP_DB_PORT:-25432}"
ADMIN_EMAIL="${AIWP_ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${AIWP_ADMIN_PASSWORD:-ChangeMe123!}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM="$ROOT/platform"
RUNTIME="$ROOT/.runtime"
NODE_DIR="$RUNTIME/node"
MARKERS="$RUNTIME/markers"
LOG_DIR="$RUNTIME/logs"
PID_DIR="$RUNTIME/pids"

# Colours, disabled when not a terminal.
if [ -t 1 ]; then
  B=$'\e[1m'; G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; C=$'\e[36m'; N=$'\e[0m'
else
  B=""; G=""; Y=""; R=""; C=""; N=""
fi

step()  { printf '\n%s==>%s %s\n' "$B$C" "$N" "$1"; }
ok()    { printf '  %s✓%s %s\n' "$G" "$N" "$1"; }
warn()  { printf '  %s!%s %s\n' "$Y" "$N" "$1"; }
die()   { printf '\n%s✗ %s%s\n\n' "$R" "$1" "$N" >&2; exit 1; }

mkdir -p "$RUNTIME" "$MARKERS" "$LOG_DIR" "$PID_DIR"

# --------------------------------------------------------------------------
# Port helpers — never collide with whatever is already on this machine
# --------------------------------------------------------------------------
_port_busy() { # <port> — true when something is listening on 127.0.0.1:port
  ( echo > /dev/tcp/127.0.0.1/"$1" ) 2>/dev/null
}

pick_port() { # <preferred> — echoes a free port, scanning upward if busy
  local p="$1" i cand
  if ! _port_busy "$p"; then echo "$p"; return 0; fi
  i=1
  while [ "$i" -le 100 ]; do
    cand=$(( p + i ))
    if ! _port_busy "$cand"; then echo "$cand"; return 0; fi
    i=$(( i + 1 ))
  done
  echo "$p"
}

# If a previous instance is already serving, do not start a second one.
if [ -z "${AIWP_PORT:-}" ] && [ -f "$PID_DIR/app.pid" ] && [ -f "$MARKERS/app.port" ]; then
  _APP_PID="$(cat "$PID_DIR/app.pid" 2>/dev/null || true)"
  _APP_PORT="$(cat "$MARKERS/app.port" 2>/dev/null || true)"
  if [ -n "$_APP_PID" ] && kill -0 "$_APP_PID" 2>/dev/null \
     && curl -fsS -o /dev/null "http://localhost:$_APP_PORT/api/health" 2>/dev/null; then
    printf '  AiWp is already running at http://localhost:%s — open it in your browser.\n' "$_APP_PORT"
    exit 0
  fi
fi

# --------------------------------------------------------------------------
# What this run installs — a visible checklist so a first-time user knows
# exactly what is happening and that the one-time setup is in progress.
# --------------------------------------------------------------------------
cat <<EOF

${B}AiWp installer${N} — the first run installs everything once; later runs start fast.

  [1/6] Node.js runtime      downloaded once, kept inside .runtime/
  [2/6] npm dependencies     installed once (pinned by package-lock)
  [3/6] Application build    compiled once into .runtime/
  [4/6] Database (PGlite)    embedded — no system Postgres to install
  [5/6] Administrator        created on first start
  [6/6] Desktop launcher     so the next start is a double-click

Downloads below show a live fill bar and a percentage.

EOF

# --------------------------------------------------------------------------
# 0. Sanity checks
# --------------------------------------------------------------------------
cd "$ROOT"

[ -d "$PLATFORM" ] || die "platform/ not found next to this script. Run it from inside the extracted project folder."

command -v curl >/dev/null 2>&1 || command -v wget >/dev/null 2>&1 \
  || die "Neither curl nor wget is installed. Run: sudo apt install curl"

# Live download progress: a 30-cell fill bar plus a percentage, refreshed in
# place on a terminal. On a pipe (CI / captured logs) it stays silent except
# the final line, so output remains readable either way.
_progress_loop() { # <dest> <total-bytes> <curl-pid>
  local dest="$1" total="$2" pid="$3"
  local cur pct fill empty bar i
  local tty=0
  if [ -t 1 ]; then tty=1; fi

  while kill -0 "$pid" 2>/dev/null; do
    cur="$(stat -c%s "$dest" 2>/dev/null || stat -f%z "$dest" 2>/dev/null || echo 0)"
    pct=0
    if [ "$total" -gt 0 ] 2>/dev/null; then
      pct=$(( cur * 100 / total ))
      if [ "$pct" -gt 100 ]; then pct=100; fi
    fi
    fill=$(( pct * 30 / 100 )); empty=$(( 30 - fill ))
    bar=""; i=0; while [ "$i" -lt "$fill" ]; do bar="${bar}#"; i=$((i+1)); done
    i=0; while [ "$i" -lt "$empty" ]; do bar="${bar}."; i=$((i+1)); done
    if [ "$tty" = 1 ]; then
      printf '\r  [%s] %3d%%' "$bar" "$pct"
    fi
    sleep 0.4
  done

  if [ "$tty" = 1 ]; then
    bar=""; i=0; while [ "$i" -lt 30 ]; do bar="${bar}#"; i=$((i+1)); done
    printf '\r  [%s] %3d%%\n' "$bar" 100
  fi
  return 0
}

fetch() { # fetch <url> <dest>
  local url="$1" dest="$2" total pid
  if command -v curl >/dev/null 2>&1; then
    total="$(curl -fsSLI --retry 2 "$url" 2>/dev/null \
      | tr -d '\r' | awk 'tolower($1)=="content-length:" {v=$2} END{print v+0}')"
    curl -fSL --retry 3 -o "$dest" "$url" &
    pid=$!
    _progress_loop "$dest" "${total:-0}" "$pid"
    wait "$pid" || return 1
  else
    wget -q --show-progress -O "$dest" "$url"
  fi
}

# --------------------------------------------------------------------------
# 1. Node.js — reuse a good system install, otherwise download a private one
# --------------------------------------------------------------------------
step "Node.js"

pick_node() {
  # Echoes the bin directory of a usable Node, or nothing.
  local candidate="$1"
  [ -x "$candidate/node" ] || return 1
  local major
  major="$("$candidate/node" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  [ "$major" -ge "$NODE_MAJOR_REQUIRED" ] 2>/dev/null || return 1
  echo "$candidate"
}

NODE_BIN=""
if [ -x "$NODE_DIR/bin/node" ]; then
  NODE_BIN="$(pick_node "$NODE_DIR/bin" || true)"
fi
if [ -z "$NODE_BIN" ] && command -v node >/dev/null 2>&1; then
  NODE_BIN="$(pick_node "$(dirname "$(command -v node)")" || true)"
fi

if [ -n "$NODE_BIN" ]; then
  ok "using $("$NODE_BIN/node" -v) from $NODE_BIN"
else
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64)  NODE_ARCH=x64 ;;
    aarch64) NODE_ARCH=arm64 ;;
    armv7l)  NODE_ARCH=armv7l ;;
    *) die "Unsupported CPU architecture: $ARCH" ;;
  esac

  case "$(uname -s)" in
    Linux)  NODE_OS=linux ;;
    Darwin) NODE_OS=darwin ;;
    MINGW*|MSYS*|CYGWIN*) die "For Windows, double-click start-aiwp.bat instead." ;;
    *) die "Unsupported operating system: $(uname -s). Use Linux, macOS, or Windows (.bat)." ;;
  esac

  TARBALL="node-$NODE_VERSION-$NODE_OS-$NODE_ARCH.tar.xz"
  URL="https://nodejs.org/dist/$NODE_VERSION/$TARBALL"

  warn "no usable Node.js >= $NODE_MAJOR_REQUIRED found; downloading $NODE_VERSION ($NODE_ARCH)"
  warn "this happens once — it is unpacked into .runtime/node/"

  mkdir -p "$NODE_DIR"
  fetch "$URL" "$RUNTIME/$TARBALL" || die "Could not download Node.js from $URL"
  tar -xJf "$RUNTIME/$TARBALL" -C "$NODE_DIR" --strip-components=1 || die "Failed to unpack Node.js"
  rm -f "$RUNTIME/$TARBALL"

  NODE_BIN="$NODE_DIR/bin"
  [ -x "$NODE_BIN/node" ] || die "Node.js unpacked but $NODE_BIN/node is missing"
  ok "installed $("$NODE_BIN/node" -v) into .runtime/node/"
fi

export PATH="$NODE_BIN:$PATH"
NODE="$NODE_BIN/node"
NPM="$NODE_BIN/npm"

# --------------------------------------------------------------------------
# 2. npm dependencies — reinstalled only when package-lock.json changes
# --------------------------------------------------------------------------
step "npm dependencies"

LOCK_HASH="$("$NODE" -e '
  const c=require("crypto"),f=require("fs");
  console.log(c.createHash("sha256").update(f.readFileSync(process.argv[1])).digest("hex").slice(0,16));
' "$PLATFORM/package-lock.json")"

if [ -f "$MARKERS/npm-$LOCK_HASH" ]; then
  ok "already installed (cached)"
else
  warn "installing — this takes a few minutes on the first run"
  ( cd "$PLATFORM" && "$NPM" ci --no-audit --no-fund ) >"$LOG_DIR/npm-install.log" 2>&1 \
    || { tail -25 "$LOG_DIR/npm-install.log" >&2; die "npm ci failed — full log: $LOG_DIR/npm-install.log"; }
  rm -f "$MARKERS"/npm-*
  touch "$MARKERS/npm-$LOCK_HASH"
  ok "installed"
fi

# --------------------------------------------------------------------------
# 3. Database — PGlite, an in-process WebAssembly PostgreSQL
# --------------------------------------------------------------------------
step "Database (PGlite)"

# Web port: honour an explicit override, otherwise take a free one so a busy
# 3000/8000/etc. on this machine never blocks AiWp.
if [ -z "${AIWP_PORT:-}" ]; then PORT="$(pick_port "$PORT")"; fi

# Database port: reuse our own running instance when its saved port is still
# serving; otherwise take a free one, so a real PostgreSQL on 5432 is never
# touched (and never mistaken for ours).
if [ -z "${AIWP_DB_PORT:-}" ]; then
  _SAVED_DB_PORT="$(cat "$MARKERS/db.port" 2>/dev/null || true)"
  if [ -n "$_SAVED_DB_PORT" ] && [ -f "$PID_DIR/db.pid" ] \
     && kill -0 "$(cat "$PID_DIR/db.pid" 2>/dev/null)" 2>/dev/null \
     && _port_busy "$_SAVED_DB_PORT"; then
    DB_PORT="$_SAVED_DB_PORT"
  else
    DB_PORT="$(pick_port "$DB_PORT")"
  fi
fi

export DATABASE_URL="postgresql://aiwp:aiwp@127.0.0.1:$DB_PORT/aiwp"
export DATABASE_POOL_MAX=1

# Starts a command detached, recording the PID of the *actual* process.
#
# `cd DIR && nohup CMD &` backgrounds a subshell, so `$!` is the wrapper's
# PID and the real process keeps running after the wrapper is killed — which
# left orphaned PGlite servers behind. Using `exec` makes the subshell
# *become* the command, so the recorded PID is the one that needs killing.
start_bg() { # start_bg <pid-name> <log-name> <workdir> <command...>
  local name="$1" logname="$2" dir="$3"; shift 3
  ( cd "$dir" && exec "$@" ) >"$LOG_DIR/$logname.log" 2>&1 &
  echo $! >"$PID_DIR/$name.pid"
}

if _port_busy "$DB_PORT"; then
  ok "port $DB_PORT already in use — reusing the running database"
else
  # PGLITE_DATA_DIR makes the database persist across restarts. Without it
  # PGlite keeps everything in memory and a reboot would silently wipe every
  # account, product, order and licence.
  PGLITE_PORT="$DB_PORT" PGLITE_DATA_DIR="$RUNTIME/pgdata" \
    start_bg db db "$PLATFORM" "$NODE" scripts/dev-pglite-server.mjs
  for _ in $(seq 1 40); do
    grep -q "listening" "$LOG_DIR/db.log" 2>/dev/null && break
    sleep 0.25
  done
  grep -q "listening" "$LOG_DIR/db.log" 2>/dev/null \
    || { tail -20 "$LOG_DIR/db.log" >&2; die "PGlite failed to start — log: $LOG_DIR/db.log"; }
  echo "$DB_PORT" > "$MARKERS/db.port"
  ok "started on 127.0.0.1:$DB_PORT"
fi

# Migrations are idempotent, so they run on every start and are cheap.
( cd "$PLATFORM" && "$NODE" scripts/migrate.mjs ) >"$LOG_DIR/migrate.log" 2>&1 \
  || { tail -20 "$LOG_DIR/migrate.log" >&2; die "Migrations failed — log: $LOG_DIR/migrate.log"; }
ok "migrations applied"

# --------------------------------------------------------------------------
# 4. Build — redone only when the source changes
# --------------------------------------------------------------------------
step "Build"

SRC_HASH="$(find "$PLATFORM/src" "$PLATFORM/next.config.ts" "$PLATFORM/drizzle" -type f -print0 2>/dev/null \
  | sort -z | xargs -0 cat 2>/dev/null | sha256sum | cut -c1-16)"

if [ -f "$MARKERS/build-$SRC_HASH" ] && [ -f "$PLATFORM/.next/standalone/server.js" ]; then
  ok "already built (cached)"
else
  warn "building — this takes a minute on the first run"
  ( cd "$PLATFORM" && NEXT_TELEMETRY_DISABLED=1 "$NPM" run build ) >"$LOG_DIR/build.log" 2>&1 \
    || { tail -30 "$LOG_DIR/build.log" >&2; die "Build failed — log: $LOG_DIR/build.log"; }
  rm -f "$MARKERS"/build-*
  touch "$MARKERS/build-$SRC_HASH"
  ok "built"
fi

# Next.js `output: "standalone"` deliberately does not copy the public
# directory or the build's hashed static chunks into the standalone bundle —
# the deployer must. Without this step every icon, the webmanifest, the
# service worker, and every hashed CSS/JS file 404s and the app renders as
# bare, unstyled HTML. It runs on every start (not just on rebuild) because
# a public/ change must not require a full rebuild, and it is cheap.
mkdir -p "$PLATFORM/.next/standalone/.next"
rm -rf "$PLATFORM/.next/standalone/public" "$PLATFORM/.next/standalone/.next/static"
cp -r "$PLATFORM/public" "$PLATFORM/.next/standalone/public"
cp -r "$PLATFORM/.next/static" "$PLATFORM/.next/standalone/.next/static"

# --------------------------------------------------------------------------
# 5. Seed the first admin account (only ever once)
# --------------------------------------------------------------------------
# Seed only when the database genuinely has no super admin.
#
# Two failure modes to avoid:
#   - Seeding once via a marker file: if the database is ever wiped or
#     restored, the install is left with no way to sign in at all.
#   - Seeding on every start: seed-admin.mjs rewrites the password hash, so
#     a password the administrator changed would silently revert to the
#     default on the next launch.
# So ask the database directly.
step "Administrator account"
ADMIN_COUNT="$(cd "$PLATFORM" && "$NODE" -e '
  const postgres = require("postgres");
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  sql`select count(*)::int as n from users where role in (${"SUPER_ADMIN"}, ${"ADMIN"})`
    .then((r) => { console.log(r[0].n); return sql.end(); })
    .catch(() => { console.log("0"); process.exit(0); });
' 2>/dev/null || echo 0)"

if [ "${ADMIN_COUNT:-0}" = "0" ]; then
  ( cd "$PLATFORM" && "$NODE" scripts/seed-admin.mjs --email "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD" ) >"$LOG_DIR/seed.log" 2>&1 || true
  warn "created $ADMIN_EMAIL — password is in the summary below, change it after signing in"
else
  ok "already present ($ADMIN_COUNT account(s) with admin rights)"
fi

# --------------------------------------------------------------------------
# 6. Start the app
# --------------------------------------------------------------------------
step "Starting AiWp"

if _port_busy "$PORT"; then
  warn "port $PORT is busy — is AiWp already running? Open http://localhost:$PORT"
  exit 0
fi

# Secrets must outlive the process. The database persists in .runtime/pgdata,
# so a key generated fresh on every start silently invalidates every
# encrypted setting already stored in it — the AI provider key, the payment
# gateway keys, the SMS keys all become permanently undecryptable while the
# rows still look intact. They are generated once, kept beside the data they
# protect, and only overridden by an explicit environment variable.
SECRETS_FILE="$RUNTIME/secrets.env"

if [ ! -f "$SECRETS_FILE" ]; then
  {
    printf 'SESSION_SECRET=%s\n' "$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
    printf 'ENCRYPTION_KEY=%s\n' "$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  } > "$SECRETS_FILE"
  chmod 600 "$SECRETS_FILE"
  ok "generated $SECRETS_FILE (delete it to reset all stored secrets)"
fi

# shellcheck disable=SC1090
. "$SECRETS_FILE"

HOSTNAME=127.0.0.1 PORT="$PORT" NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
DATABASE_URL="$DATABASE_URL" DATABASE_POOL_MAX=1 \
SESSION_SECRET="${AIWP_SESSION_SECRET:-$SESSION_SECRET}" \
ENCRYPTION_KEY="${AIWP_ENCRYPTION_KEY:-$ENCRYPTION_KEY}" \
APP_URL="http://localhost:$PORT" LOG_LEVEL=info \
start_bg app app "$PLATFORM/.next/standalone" "$NODE" server.js

URL="http://localhost:$PORT"
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "$URL/api/health" 2>/dev/null; then break; fi
  sleep 0.5
done

curl -fsS -o /dev/null "$URL/api/health" 2>/dev/null \
  || { tail -30 "$LOG_DIR/app.log" >&2; die "The app did not come up — log: $LOG_DIR/app.log"; }
echo "$PORT" > "$MARKERS/app.port"

ok "running at $URL"

# --------------------------------------------------------------------------
# 7. Open the browser and report
# --------------------------------------------------------------------------
cat <<EOF

${B}AiWp is running${N}

  Storefront   $URL/store
  Sign in      $URL/login
  Admin        $URL/admin

  Administrator  ${B}$ADMIN_EMAIL${N}
  Password       ${B}$ADMIN_PASSWORD${N}

  ${Y}Change that password after your first sign-in.${N}

  Logs     $LOG_DIR/
  Stop     ./stop-aiwp.sh

EOF

# --------------------------------------------------------------------------
# 8. Make the next start a double-click (first-run convenience)
# --------------------------------------------------------------------------
# A non-technical user should never need a terminal again: now that the app
# has proven it can start, install the desktop menu entry so the NEXT start
# is a double-click on the AiWp icon. Best-effort and idempotent — a failure
# here never stops an app that is already running. Set AIWP_NO_LAUNCHER=1 to
# skip (e.g. headless servers).
if [ "${AIWP_NO_LAUNCHER:-0}" != "1" ] && [ -x "$ROOT/install-launcher.sh" ]; then
  if "$ROOT/install-launcher.sh" >/dev/null 2>&1; then
    ok "desktop launcher ready — next time, double-click the AiWp icon"
  fi
fi

if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL/store" >/dev/null 2>&1 || true
fi
