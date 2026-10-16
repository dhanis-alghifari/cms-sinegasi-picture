#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${ROOT_DIR}/docker-compose.dev.yml}"
API_SERVICE="${API_SERVICE:-api-dev}"
CADDY_CONTAINER="${CADDY_CONTAINER:-caddy-proxy}"
API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:3001/api/health}"
LOCK_FILE="${DEPLOY_LOCK_FILE:-${TMPDIR:-/tmp}/sinegasi-vps-deploy.lock}"
APPLY_MIGRATIONS="${DEV_APPLY_MIGRATIONS:-false}"
export COMPOSE_IGNORE_ORPHANS="${COMPOSE_IGNORE_ORPHANS:-1}"

fail() {
  echo "[deploy-dev] ERROR: $*" >&2
  exit 1
}

for argument in "$@"; do
  [[ "$argument" == "--remove-orphans" ]] && fail "Refusing --remove-orphans; ${CADDY_CONTAINER} is protected."
done

[[ "$API_SERVICE" == "api-dev" && "$COMPOSE_FILE" == "$ROOT_DIR/docker-compose.dev.yml" ]] || fail "DEV_TARGET_REQUIRED"
[[ "$APPLY_MIGRATIONS" == "false" || "$APPLY_MIGRATIONS" == "true" ]] || fail "INVALID_DEV_MIGRATION_MODE"

command -v docker >/dev/null 2>&1 || fail "Docker tidak ditemukan."
command -v curl >/dev/null 2>&1 || fail "curl tidak ditemukan."
command -v flock >/dev/null 2>&1 || fail "flock tidak ditemukan."
[[ -f "$COMPOSE_FILE" ]] || fail "Compose file tidak ditemukan: $COMPOSE_FILE"

is_caddy_running() {
  [[ "$(docker inspect -f '{{.State.Running}}' "$CADDY_CONTAINER" 2>/dev/null || true)" == "true" ]]
}

is_caddy_running || fail "Container ${CADDY_CONTAINER} tidak running; deploy dihentikan untuk melindungi Caddy."

exec 9>>"$LOCK_FILE"
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

resolve_proxy_peer() {
  local address octet
  address="$(docker inspect -f '{{with index .NetworkSettings.Networks "caddy_net"}}{{.IPAddress}}{{end}}' "$CADDY_CONTAINER")" || fail "DEV_PROXY_METADATA_UNAVAILABLE"
  [[ "$address" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || fail "INVALID_DEV_PROXY_ADDRESS"
  for octet in ${address//./ }; do
    [[ "$octet" == "0" || "$octet" != 0* ]] || fail "INVALID_DEV_PROXY_ADDRESS"
    (( 10#$octet <= 255 )) || fail "INVALID_DEV_PROXY_ADDRESS"
  done
  [[ "$address" != "0.0.0.0" && "$address" != "255.255.255.255" ]] || fail "INVALID_DEV_PROXY_ADDRESS"
  printf '%s' "$address"
}

# Only the observed Caddy peer is trusted; never a subnet or inherited wildcard.
DEV_TRUST_PROXY_ADDRESSES="$(resolve_proxy_peer)"
export DEV_TRUST_PROXY_ADDRESSES

compose_dev() {
  docker compose --env-file /dev/null -f "$COMPOSE_FILE" "$@"
}

echo "[deploy-dev] Building ${API_SERVICE}..."
compose_dev build "$API_SERVICE"

[[ "$(resolve_proxy_peer)" == "$DEV_TRUST_PROXY_ADDRESSES" ]] || fail "DEV_PROXY_CHANGED_DURING_BUILD"
if [[ "$APPLY_MIGRATIONS" == "true" ]]; then
  echo "[deploy-dev] Running explicitly requested DEV schema migrations..."
  compose_dev run --rm --no-deps "$API_SERVICE" node dist/scripts/applyMigrations.js
else
  echo "[deploy-dev] Skipping schema migrations (separate approval required)."
fi

echo "[deploy-dev] Recreating ${API_SERVICE}..."
compose_dev up -d --no-deps --force-recreate "$API_SERVICE"

echo "[deploy-dev] Waiting for API health..."
for _ in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 3 "$API_HEALTH_URL" >/dev/null; then
    [[ "$(resolve_proxy_peer)" == "$DEV_TRUST_PROXY_ADDRESSES" ]] || fail "DEV_PROXY_CHANGED_DURING_DEPLOY"
    echo "[deploy-dev] API healthy."
    exit 0
  fi
  sleep 2
done

fail "API tidak healthy setelah 60 detik."
