#!/usr/bin/env bash

# Testable release logic; the entry point enforces the exact VPS/root path.
release_error() { printf '[deploy-prod] ERROR: %s\n' "$*" >&2; return 1; }
valid_image() { [[ "$1" =~ ^ghcr\.io/[a-z0-9][a-z0-9._/-]*@sha256:[a-f0-9]{64}$ ]]; }
valid_sha() { [[ "$1" =~ ^[a-f0-9]{40}$ ]]; }
valid_fingerprint() { [[ "$1" =~ ^[a-f0-9]{64}$ ]]; }

lock_descriptor_matches() {
  # macOS fdescfs reports a synthetic device ID; retain portable local tests.
  # The host-specific entry point permits only the Linux production VPS.
  if [[ "$(uname -s)" == Darwin ]]; then
    [[ "$(stat -f '%i' "$1")" == "$(stat -f '%i' /dev/fd/9)" ]]
  else
    [[ "$1" -ef /dev/fd/9 ]]
  fi
}

private_path() {
  local target=$1 permission owner
  [[ -e "$target" && ! -L "$target" ]] || return 1
  owner="$(stat -c '%U' "$target" 2>/dev/null || stat -f '%Su' "$target")" || return 1
  permission="$(stat -c '%a' "$target" 2>/dev/null || stat -f '%Lp' "$target")" || return 1
  [[ "$owner" == "$(id -un)" && "$permission" =~ ^[0-7]{3}$ && "${permission:1:2}" == 00 ]]
}

read_approval() {
  local file=$1 expected_sha=$2 expected_image=$3 expected_evidence=$4 expected_package=$5 key value count=0 seen='|'
  private_path "$file" && [[ -f "$file" ]] || release_error 'Approval file missing, symlinked, or not private.' || return 1
  APPROVED_PROXY='' APPROVED_START='' APPROVED_END='' APPROVED_MEDIA=''
  while IFS='=' read -r key value || [[ -n "$key$value" ]]; do
    [[ "$value" =~ ^[-A-Za-z0-9._:/@+]+$ && "${#value}" -le 256 && "$seen" != *"|$key|"* ]] || release_error 'Malformed or duplicate approval field.' || return 1
    seen+="$key|"
    case "$key" in
      release_sha) [[ "$value" == "$expected_sha" ]] || return 1 ;;
      api_image) [[ "$value" == "$expected_image" ]] || return 1 ;;
      schema_evidence_sha256) [[ "$value" == "$expected_evidence" ]] || return 1 ;;
      release_package_sha256) [[ "$value" == "$expected_package" ]] || return 1 ;;
      project_ref) [[ "$value" == pvbdiftvzoeelibxlxzb ]] || return 1 ;;
      trust_proxy_hops) [[ "$value" =~ ^[0-4]$ ]] || return 1; APPROVED_PROXY=$value ;;
      database_rollback_compatible) [[ "$value" == true ]] || return 1 ;;
      no_other_writers) [[ "$value" == true ]] || return 1 ;;
      approved_by) : ;;
      window_start) [[ "$value" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$ ]] || return 1; APPROVED_START=$value ;;
      window_end) [[ "$value" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$ ]] || return 1; APPROVED_END=$value ;;
      media_public_domain) [[ "$value" =~ ^https://[a-z0-9][a-z0-9.-]*[a-z0-9]$ ]] || return 1; APPROVED_MEDIA=$value ;;
      *) release_error 'Unknown approval field.'; return 1 ;;
    esac
    count=$((count + 1))
  done < "$file"
  [[ "$count" -eq 12 && -n "$APPROVED_PROXY" && -n "$APPROVED_START" && -n "$APPROVED_END" && -n "$APPROVED_MEDIA" ]] || release_error 'Approval evidence incomplete.'
}

production_compose() {
  API_IMAGE=$ACTIVE_IMAGE PRODUCTION_ENV_FILE="$PROD_ROOT/config/backend.env" \
    PRODUCTION_TRUST_PROXY=$ACTIVE_PROXY COMPOSE_IGNORE_ORPHANS=1 \
    timeout "${COMPOSE_TIMEOUT:-120}" docker compose --env-file /dev/null -p sinegasi-prod -f "$ACTIVE_RELEASE/docker-compose.prod.yml" "$@"
}

preserved_containers_unchanged() {
  [[ "$(timeout 3 docker inspect -f '{{.Id}}|{{.State.Running}}' sinegasi-api-dev 2>/dev/null)" == "$DEV_SNAPSHOT" \
    && "$(timeout 3 docker inspect -f '{{.Id}}|{{.State.Running}}' caddy-proxy 2>/dev/null)" == "$CADDY_SNAPSHOT" ]]
}

wait_for_production_health() {
  local attempt
  for ((attempt = 1; attempt <= HEALTH_ATTEMPTS; attempt++)); do
    if [[ "$(timeout 3 docker inspect -f '{{.State.Health.Status}}' sinegasi-api-prod 2>/dev/null || true)" == healthy ]] \
      && curl --fail --silent --show-error --max-time 3 http://127.0.0.1:3002/api/health >/dev/null 2>&1; then
      return 0
    fi
    [[ "$attempt" -eq "$HEALTH_ATTEMPTS" ]] || sleep 2
  done
  return 1
}

prepare_image() {
  local revision
  docker pull "$ACTIVE_IMAGE" >/dev/null || return 1
  revision="$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$ACTIVE_IMAGE")" || return 1
  [[ "$revision" == "$ACTIVE_SHA" ]] || release_error 'Image revision does not match the approved release SHA.' || return 1
  production_compose config --quiet || return 1
  # One-off config import: no published ports, dependencies, DB calls or workers.
  production_compose run --rm --no-deps --pull never -T -e "PRODUCTION_TRUST_PROXY=$ACTIVE_PROXY" -e "PRODUCTION_MEDIA_PUBLIC_DOMAIN=$ACTIVE_MEDIA" api-prod node \
    < "$ACTIVE_RELEASE/ops/production-runtime-preflight.cjs" >/dev/null || return 1
}

verify_candidate_schema() {
  # Read-only metadata adapter, no ports/workers/SQL migration. Credential file
  # is separate from backend.env and requires explicitly provisioned custody.
  COMPOSE_TIMEOUT=150 production_schema_container || return 1
}

production_schema_container() {
  production_compose run --rm --no-deps --pull never -T --user "$(id -u):$(id -g)" \
    -v "$PROD_ROOT/config/schema-gate.json:/run/sinegasi-gate/connection.json:ro" \
    -v "$PROD_ROOT/config/approvals/$ACTIVE_SHA.schema.json:/run/sinegasi-gate/evidence.json:ro" \
    -v "$ACTIVE_RELEASE/ops/production-schema.snapshot.json:/run/sinegasi-gate/snapshot.json:ro" \
    -e "PRODUCTION_SCHEMA_EVIDENCE_SHA256=$REQUESTED_EVIDENCE" -e "PRODUCTION_RELEASE_SHA=$ACTIVE_SHA" \
    -e "PRODUCTION_WINDOW_START=$APPROVED_START" -e "PRODUCTION_WINDOW_END=$APPROVED_END" api-prod node \
    < "$ACTIVE_RELEASE/ops/production-schema-preflight.cjs" >/dev/null
}

restore_previous_release() {
  if [[ -z "$PREVIOUS_SHA" ]]; then
    production_compose stop api-prod >/dev/null || return 1
    printf '%s\n' '[deploy-prod] First deployment failed; only the failed production API was stopped. Dev/Caddy were not changed.' >&2
    return 0
  fi
  ACTIVE_SHA=$PREVIOUS_SHA ACTIVE_IMAGE=$PREVIOUS_IMAGE ACTIVE_PROXY=$PREVIOUS_PROXY ACTIVE_MEDIA=$PREVIOUS_MEDIA
  ACTIVE_RELEASE="$PROD_ROOT/releases/$PREVIOUS_SHA"
  production_compose up -d --no-build --pull never --no-deps --force-recreate api-prod >/dev/null || return 1
  wait_for_production_health || return 1
  printf '%s\n' '[deploy-prod] Previous approved release digest restored and health checked.' >&2
}

production_on_exit() {
  local status=$?
  trap - EXIT INT TERM HUP
  if [[ "$RELEASE_SWITCHED" == true && "$status" -ne 0 ]]; then
    restore_previous_release || printf '%s\n' '[deploy-prod] CRITICAL: rollback failed; use the verified private rescue path. No container logs or secrets dumped.' >&2
  fi
  if ! preserved_containers_unchanged; then
    printf '%s\n' '[deploy-prod] CRITICAL: dev/Caddy state changed; investigate through the private admin path.' >&2
    status=1
  fi
  exit "$status"
}

deploy_production() {
  PROD_ROOT=$1 ACTIVE_SHA=$2 ACTIVE_IMAGE=$3 REQUESTED_EVIDENCE=$4 REQUESTED_PACKAGE=$5
  local shared_lock=${6:-/tmp/sinegasi-vps-deploy.lock}
  local directory state_key state_value state_count=0 state_seen='|' current_image previous_evidence='' previous_package=''
  for command in docker curl flock stat mktemp timeout; do
    command -v "$command" >/dev/null 2>&1 || release_error "Required tool unavailable: $command" || return 1
  done
  valid_sha "$ACTIVE_SHA" && valid_image "$ACTIVE_IMAGE" && valid_fingerprint "$REQUESTED_EVIDENCE" && valid_fingerprint "$REQUESTED_PACKAGE" \
    || release_error 'Require full release SHA, immutable GHCR digest, schema evidence and release archive SHA256.' || return 1
  HEALTH_ATTEMPTS=${DEPLOY_HEALTH_ATTEMPTS:-30}
  [[ "$HEALTH_ATTEMPTS" =~ ^([1-9]|[12][0-9]|30)$ ]] || release_error 'Health attempts must be between 1 and 30.' || return 1
  ACTIVE_RELEASE="$PROD_ROOT/releases/$ACTIVE_SHA"
  [[ "$(cd -P -- "$PROD_ROOT" && pwd)" == "$PROD_ROOT" ]] || return 1
  for directory in "$PROD_ROOT" "$PROD_ROOT/config" "$PROD_ROOT/config/approvals" "$PROD_ROOT/releases" "$PROD_ROOT/state" "$ACTIVE_RELEASE"; do
    [[ -d "$directory" ]] && private_path "$directory" || release_error 'Production directories must be private, owned, and not symlinks.' || return 1
  done
  private_path "$PROD_ROOT/config/backend.env" && [[ -f "$PROD_ROOT/config/backend.env" ]] \
    || release_error 'Private runtime configuration missing; do not copy dev secrets.' || return 1
  [[ -f "$ACTIVE_RELEASE/docker-compose.prod.yml" && ! -L "$ACTIVE_RELEASE/docker-compose.prod.yml" \
    && -f "$ACTIVE_RELEASE/ops/production-runtime-preflight.cjs" && ! -L "$ACTIVE_RELEASE/ops" \
    && ! -L "$ACTIVE_RELEASE/ops/production-runtime-preflight.cjs" ]] || return 1
  read_approval "$PROD_ROOT/config/approvals/$ACTIVE_SHA.txt" "$ACTIVE_SHA" "$ACTIVE_IMAGE" "$REQUESTED_EVIDENCE" "$REQUESTED_PACKAGE" || return 1
  ACTIVE_PROXY=$APPROVED_PROXY ACTIVE_MEDIA=$APPROVED_MEDIA
  private_path "$PROD_ROOT/config/schema-gate.json" && [[ -f "$PROD_ROOT/config/schema-gate.json" ]] \
    && private_path "$PROD_ROOT/config/approvals/$ACTIVE_SHA.schema.json" && [[ -f "$PROD_ROOT/config/approvals/$ACTIVE_SHA.schema.json" ]] \
    && [[ -f "$ACTIVE_RELEASE/ops/production-schema-preflight.cjs" && ! -L "$ACTIVE_RELEASE/ops/production-schema-preflight.cjs" \
      && -f "$ACTIVE_RELEASE/ops/production-schema.snapshot.json" && ! -L "$ACTIVE_RELEASE/ops/production-schema.snapshot.json" ]] \
    || release_error 'Explicit private schema gate custody/evidence and reviewed adapter required.' || return 1

  # Provision this shared lock privately first. Read-only open cannot truncate
  # a raced symlink target; inode/ownership checks fail closed before Docker.
  [[ -f "$shared_lock" ]] && private_path "$shared_lock" || release_error 'Shared deployment lock must already exist and be private.' || return 1
  exec 9<"$shared_lock"
  lock_descriptor_matches "$shared_lock" && private_path "$shared_lock" || return 1
  flock -n 9 || release_error 'Another VPS deployment holds the shared lock.' || return 1
  DEV_SNAPSHOT="$(timeout 3 docker inspect -f '{{.Id}}|{{.State.Running}}' sinegasi-api-dev 2>/dev/null)" || return 1
  CADDY_SNAPSHOT="$(timeout 3 docker inspect -f '{{.Id}}|{{.State.Running}}' caddy-proxy 2>/dev/null)" || return 1
  [[ "$DEV_SNAPSHOT" == *'|true' && "$CADDY_SNAPSHOT" == *'|true' ]] || release_error 'Existing dev/Caddy must be running; restore separately.' || return 1
  PREVIOUS_SHA='' PREVIOUS_IMAGE='' PREVIOUS_PROXY='' PREVIOUS_MEDIA='' RELEASE_SWITCHED=false
  trap production_on_exit EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  trap 'exit 129' HUP
  current_image="$(timeout 3 docker inspect -f '{{.Config.Image}}' sinegasi-api-prod 2>/dev/null || true)"
  if [[ -e "$PROD_ROOT/state/current-release.txt" ]]; then
    private_path "$PROD_ROOT/state/current-release.txt" || return 1
    while IFS='=' read -r state_key state_value || [[ -n "$state_key$state_value" ]]; do
      [[ "$state_seen" != *"|$state_key|"* ]] || return 1
      state_seen+="$state_key|"
      case "$state_key" in
        release_sha) valid_sha "$state_value" || return 1; PREVIOUS_SHA=$state_value ;;
        api_image) valid_image "$state_value" || return 1; PREVIOUS_IMAGE=$state_value ;;
        schema_evidence_sha256) valid_fingerprint "$state_value" || return 1; previous_evidence=$state_value ;;
        release_package_sha256) valid_fingerprint "$state_value" || return 1; previous_package=$state_value ;;
        *) return 1 ;;
      esac
      state_count=$((state_count + 1))
    done < "$PROD_ROOT/state/current-release.txt"
    [[ "$state_count" -eq 4 && "$current_image" == "$PREVIOUS_IMAGE" ]] || release_error 'Current production container and release metadata differ; reconcile manually.' || return 1
    read_approval "$PROD_ROOT/config/approvals/$PREVIOUS_SHA.txt" "$PREVIOUS_SHA" "$PREVIOUS_IMAGE" "$previous_evidence" "$previous_package" || return 1
    PREVIOUS_PROXY=$APPROVED_PROXY PREVIOUS_MEDIA=$APPROVED_MEDIA
    ACTIVE_SHA=$PREVIOUS_SHA ACTIVE_IMAGE=$PREVIOUS_IMAGE ACTIVE_PROXY=$PREVIOUS_PROXY ACTIVE_MEDIA=$PREVIOUS_MEDIA
    ACTIVE_RELEASE="$PROD_ROOT/releases/$ACTIVE_SHA"
    private_path "$ACTIVE_RELEASE" && [[ ! -L "$ACTIVE_RELEASE/ops" \
      && -f "$ACTIVE_RELEASE/docker-compose.prod.yml" && ! -L "$ACTIVE_RELEASE/docker-compose.prod.yml" \
      && -f "$ACTIVE_RELEASE/ops/production-runtime-preflight.cjs" && ! -L "$ACTIVE_RELEASE/ops/production-runtime-preflight.cjs" ]] || return 1
    # Check previous digest/config before cutover. DB compatibility still needs
    # human rehearsal evidence; this never restores or modifies the database.
    prepare_image || return 1
    ACTIVE_SHA=$2 ACTIVE_IMAGE=$3 ACTIVE_RELEASE="$PROD_ROOT/releases/$2"
    read_approval "$PROD_ROOT/config/approvals/$ACTIVE_SHA.txt" "$ACTIVE_SHA" "$ACTIVE_IMAGE" "$REQUESTED_EVIDENCE" "$REQUESTED_PACKAGE" || return 1
    ACTIVE_PROXY=$APPROVED_PROXY ACTIVE_MEDIA=$APPROVED_MEDIA
  else
    [[ -z "$current_image" ]] || release_error 'Untracked production container exists; never overwrite it automatically.' || return 1
  fi
  prepare_image || return 1
  preserved_containers_unchanged || return 1
  verify_candidate_schema || return 1
  RELEASE_SWITCHED=true
  production_compose up -d --no-build --pull never --no-deps --force-recreate api-prod >/dev/null || return 1
  wait_for_production_health && preserved_containers_unchanged || release_error 'Production health/preservation verification failed.' || return 1
  local state_temp
  state_temp="$(mktemp "$PROD_ROOT/state/current-release.XXXXXX")" || return 1
  printf 'release_sha=%s\napi_image=%s\nschema_evidence_sha256=%s\nrelease_package_sha256=%s\n' "$ACTIVE_SHA" "$ACTIVE_IMAGE" "$REQUESTED_EVIDENCE" "$REQUESTED_PACKAGE" > "$state_temp" || return 1
  mv -- "$state_temp" "$PROD_ROOT/state/current-release.txt" || return 1
  RELEASE_SWITCHED=false
  printf '[deploy-prod] Approved release %s is healthy; read-only schema gate passed. Tunnel/Pages/browser/media acceptance remain separate.\n' "$ACTIVE_SHA"
}
