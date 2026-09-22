#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/docker-compose.dev.yml}"
API_SERVICE="${API_SERVICE:-api-dev}"
CADDY_CONTAINER="${CADDY_CONTAINER:-caddy-proxy}"
API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:3001/api/health}"
LOCK_FILE="${DEPLOY_LOCK_FILE:-${TMPDIR:-/tmp}/sinegasi-dev-deploy.lock}"

fail() {
  echo "[deploy-dev] ERROR: $*" >&2
  exit 1
}

for argument in "$@"; do
  [[ "$argument" == "--remove-orphans" ]] && fail "Refusing --remove-orphans; ${CADDY_CONTAINER} is protected."
done

command -v docker >/dev/null 2>&1 || fail "Docker tidak ditemukan."
command -v curl >/dev/null 2>&1 || fail "curl tidak ditemukan."
command -v flock >/dev/null 2>&1 || fail "flock tidak ditemukan."
[[ -f "$COMPOSE_FILE" ]] || fail "Compose file tidak ditemukan: $COMPOSE_FILE"

is_caddy_running() {
  [[ "$(docker inspect -f '{{.State.Running}}' "$CADDY_CONTAINER" 2>/dev/null || true)" == "true" ]]
}

is_caddy_running || fail "Container ${CADDY_CONTAINER} tidak running; deploy dihentikan untuk melindungi Caddy."

exec 9>"$LOCK_FILE"
flock -n 9 || fail "Deploy lain sedang berjalan (${LOCK_FILE})."

on_exit() {
  local exit_code=$?
  if ! is_caddy_running; then
    echo "[deploy-dev] CRITICAL: ${CADDY_CONTAINER} tidak running setelah deploy." >&2
    [[ "$exit_code" -eq 0 ]] && exit_code=1
  fi
  exit "$exit_code"
}

trap on_exit EXIT

cd "$ROOT_DIR"

echo "[deploy-dev] Building ${API_SERVICE}..."
docker compose -f "$COMPOSE_FILE" build "$API_SERVICE"

for migration in applyGradesMigration applyCashMigration applyContestMigration; do
  echo "[deploy-dev] Running ${migration}..."
  docker compose -f "$COMPOSE_FILE" run --rm --no-deps "$API_SERVICE" \
    node "dist/scripts/${migration}.js"
done

echo "[deploy-dev] Recreating ${API_SERVICE}..."
docker compose -f "$COMPOSE_FILE" up -d --force-recreate "$API_SERVICE"

echo "[deploy-dev] Waiting for API health..."
for _ in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 3 "$API_HEALTH_URL" >/dev/null; then
    echo "[deploy-dev] API healthy: ${API_HEALTH_URL}"
    docker compose -f "$COMPOSE_FILE" ps "$API_SERVICE"
    exit 0
  fi
  sleep 2
done

docker compose -f "$COMPOSE_FILE" logs --tail=200 "$API_SERVICE" >&2
fail "API tidak healthy setelah 60 detik."
