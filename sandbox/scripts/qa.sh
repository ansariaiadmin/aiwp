#!/usr/bin/env bash
#
# Spins up a disposable WordPress + MariaDB sandbox (sandbox/docker-compose.yml),
# installs a built plugin ZIP, activates it, runs `wp plugin check` (if the
# plugin-check plugin is available) and phpcs against the installed copy,
# then prints a PASS/FAIL summary and tears the sandbox down.
#
# Usage: sandbox/scripts/qa.sh <path/to/plugin-slug-version.zip>
#
# Requires: docker, docker compose.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SANDBOX_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$SANDBOX_DIR")"

ZIP_PATH="${1:-}"

if [[ -z "$ZIP_PATH" ]]; then
	echo "Usage: sandbox/scripts/qa.sh <path/to/plugin-slug-version.zip>" >&2
	exit 1
fi

if [[ ! -f "$ZIP_PATH" ]]; then
	echo "FAIL: ZIP not found: $ZIP_PATH" >&2
	exit 1
fi

ZIP_BASENAME="$(basename "$ZIP_PATH")"
SLUG="$(basename "$ZIP_PATH" | sed -E 's/-[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?\.zip$//')"

PASS=1
SUMMARY=()

cleanup() {
	echo "==> Tearing down sandbox..."
	docker compose -f "$SANDBOX_DIR/docker-compose.yml" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Starting sandbox (WordPress + MariaDB)..."
docker compose -f "$SANDBOX_DIR/docker-compose.yml" up -d --wait mariadb wordpress wpcli

WP() {
	docker compose -f "$SANDBOX_DIR/docker-compose.yml" exec -T wpcli wp --path=/var/www/html --allow-root "$@"
}

echo "==> Waiting for WordPress to be installable..."
for _ in $(seq 1 30); do
	if WP core is-installed >/dev/null 2>&1; then
		break
	fi
	sleep 2
done

if ! WP core is-installed >/dev/null 2>&1; then
	echo "==> Installing WordPress core..."
	WP core install \
		--url="http://localhost:8765" \
		--title="WP Plugin Factory Sandbox" \
		--admin_user=admin \
		--admin_password=admin \
		--admin_email=admin@example.test \
		--skip-email
fi

echo "==> Installing plugin ZIP: $ZIP_BASENAME"
if WP plugin install "/build/$ZIP_BASENAME" --force; then
	SUMMARY+=("PASS: plugin install")
else
	SUMMARY+=("FAIL: plugin install")
	PASS=0
fi

echo "==> Activating plugin: $SLUG"
if [[ "$PASS" -eq 1 ]] && WP plugin activate "$SLUG"; then
	SUMMARY+=("PASS: plugin activate")
else
	SUMMARY+=("FAIL: plugin activate")
	PASS=0
fi

echo "==> Checking for PHP fatal errors in the debug log..."
if WP eval 'echo "no-fatal-check-ok";' >/dev/null 2>&1; then
	SUMMARY+=("PASS: no fatal errors after activation")
else
	SUMMARY+=("FAIL: fatal error detected after activation")
	PASS=0
fi

echo "==> Running \`wp plugin check\` (if available)..."
if WP plugin is-installed plugin-check >/dev/null 2>&1 || WP plugin install plugin-check --activate >/dev/null 2>&1; then
	if WP plugin check "$SLUG" --format=table; then
		SUMMARY+=("PASS: wp plugin check")
	else
		SUMMARY+=("FAIL: wp plugin check reported issues")
		PASS=0
	fi
else
	SUMMARY+=("SKIP: wp plugin check (plugin-check unavailable, likely offline sandbox)")
fi

echo "==> Running phpcs against the installed copy (if vendor/bin/phpcs exists)..."
if [[ -x "$REPO_ROOT/vendor/bin/phpcs" ]]; then
	if "$REPO_ROOT/vendor/bin/phpcs" --standard=WordPress-Core --extensions=php "$SANDBOX_DIR/wp-data/html/wp-content/plugins/$SLUG"; then
		SUMMARY+=("PASS: phpcs (installed copy)")
	else
		SUMMARY+=("FAIL: phpcs (installed copy)")
		PASS=0
	fi
else
	SUMMARY+=("SKIP: phpcs (run \`composer install\` first)")
fi

echo ""
echo "================ QA SUMMARY ================"
for line in "${SUMMARY[@]}"; do
	echo " $line"
done
echo "=============================================="

if [[ "$PASS" -eq 1 ]]; then
	echo "OVERALL: PASS"
	exit 0
else
	echo "OVERALL: FAIL"
	exit 1
fi
