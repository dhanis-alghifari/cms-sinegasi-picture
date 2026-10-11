#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

# Never check out code, change dev/Caddy, open ports, or execute SQL here.
[[ $# -eq 3 ]] || {
  printf '%s\n' 'Usage: bash ./ops/deploy-prod.sh RELEASE_SHA GHCR_IMAGE_DIGEST MIGRATION_MANIFEST_SHA256' >&2
  exit 1
}
[[ "$(id -un)" == ubuntu && "$(hostname)" == VM-11-154-ubuntu ]] || {
  printf '%s\n' '[deploy-prod] STOP: run only as ubuntu on the approved VPS.' >&2
  exit 1
}

PRODUCTION_ROOT=/opt/sinegasi-prod
SCRIPT_ROOT="$(cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
[[ "$SCRIPT_ROOT" == "$PRODUCTION_ROOT/releases/$1" ]] || {
  printf '%s\n' '[deploy-prod] STOP: script must be inside its isolated immutable release directory.' >&2
  exit 1
}

# shellcheck source=ops/production-release.sh
source "$SCRIPT_ROOT/ops/production-release.sh"
deploy_production "$PRODUCTION_ROOT" "$1" "$2" "$3" /tmp/sinegasi-vps-deploy.lock
