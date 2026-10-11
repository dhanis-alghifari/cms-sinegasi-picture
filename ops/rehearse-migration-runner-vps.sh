#!/usr/bin/env bash
# Synthetic runner checks only. No application DB, secrets, ports or persistent volumes.
set -Eeuo pipefail
umask 077

fail() { printf '[runner-rehearsal] STOP: %s\n' "$*" >&2; exit 1; }
[[ "$(id -un)" == ubuntu && "$(hostname)" == VM-11-154-ubuntu ]] || fail 'Wrong host/user.'
[[ $# -eq 1 ]] || fail 'Supply the private disposable compiled-script directory.'
bundle=$1
[[ "$bundle" =~ ^/tmp/sinegasi-runner-rehearsal\.[A-Za-z0-9]+$ && -d "$bundle" && ! -L "$bundle" ]] || fail 'Unexpected bundle path.'
[[ "$(stat -c '%U:%a' "$bundle")" == ubuntu:700 ]] || fail 'Bundle must be private and owned.'
for file in migrationSafety.js productionMigrations.js rehearseMigrationRunner.js; do
  [[ -f "$bundle/$file" && ! -L "$bundle/$file" && "$(stat -c '%U' "$bundle/$file")" == ubuntu ]] || fail 'Missing/unsafe compiled script.'
done
for command in docker timeout sha256sum awk; do command -v "$command" >/dev/null || fail "Missing $command."; done
available_kib=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
[[ "$available_kib" =~ ^[0-9]+$ && "$available_kib" -ge 1843200 ]] || fail 'Require at least 1.8 GiB available RAM.'
disk_kib=$(df -Pk /tmp | awk 'NR==2 {print $4}')
[[ "$disk_kib" =~ ^[0-9]+$ && "$disk_kib" -ge 3145728 ]] || fail 'Require at least 3 GiB free disk.'
dev_snapshot=$(timeout 5 docker inspect -f '{{.Id}}|{{.State.Running}}' sinegasi-api-dev)
caddy_snapshot=$(timeout 5 docker inspect -f '{{.Id}}|{{.State.Running}}' caddy-proxy)
[[ "$dev_snapshot" == *'|true' && "$caddy_snapshot" == *'|true' ]] || fail 'Dev/Caddy must be running.'
# Reuse only immutable image contents (Node/pg), never an existing container's
# environment, bind mounts, network or runtime configuration.
client_image=$(timeout 5 docker inspect -f '{{.Image}}' sinegasi-api-dev)
[[ "$client_image" =~ ^sha256:[a-f0-9]{64}$ ]] || fail 'Client image identity invalid.'
run_id=${bundle##*.}
pg_name="sinegasi-runner-rehearsal-$run_id"
pg_id=''
client_id=''
cleanup() {
  local result=$? container
  trap - EXIT INT TERM HUP
  for container in "$client_id" "$pg_id"; do
    if [[ -n "$container" ]]; then
      if [[ "$(docker inspect -f '{{index .Config.Labels "sinegasi.rehearsal"}}' "$container" 2>/dev/null || true)" == "$run_id" ]]; then
        docker rm --force --volumes "$container" >/dev/null || result=1
      else
        printf '%s\n' '[runner-rehearsal] Cleanup ownership check failed; inspect disposable container manually.' >&2
        result=1
      fi
    fi
  done
  if [[ "$(timeout 5 docker inspect -f '{{.Id}}|{{.State.Running}}' sinegasi-api-dev 2>/dev/null)" != "$dev_snapshot" \
    || "$(timeout 5 docker inspect -f '{{.Id}}|{{.State.Running}}' caddy-proxy 2>/dev/null)" != "$caddy_snapshot" ]]; then
    printf '%s\n' '[runner-rehearsal] Dev/Caddy preservation check failed.' >&2
    result=1
  fi
  printf '%s\n' '[runner-rehearsal] Disposable containers removed; production SQL package remains unvalidated.'
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

[[ -z "$(docker ps -aq --filter "name=^/$pg_name$" --filter "name=^/$pg_name-client$")" ]] || fail 'Disposable name already exists; never reuse.'
timeout 180 docker pull postgres:17.11-bookworm >/dev/null
pg_image=$(docker image inspect -f '{{index .RepoDigests 0}}' postgres:17.11-bookworm)
[[ "$pg_image" =~ ^postgres@sha256:[a-f0-9]{64}$ ]] || fail 'Postgres digest missing.'
pg_uid=$(docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --entrypoint id "$pg_image" -u postgres)
pg_gid=$(docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --entrypoint id "$pg_image" -g postgres)
[[ "$pg_uid" =~ ^[0-9]+$ && "$pg_gid" =~ ^[0-9]+$ ]] || fail 'Postgres UID/GID invalid.'
printf '[runner-rehearsal] Postgres=%s client=%s\n' "$pg_image" "$client_image"
sha256sum "$bundle/migrationSafety.js" "$bundle/productionMigrations.js" "$bundle/rehearseMigrationRunner.js"
pg_id=$(docker create --name "$pg_name" --label "sinegasi.rehearsal=$run_id" \
  --network none --restart no --memory 384m --memory-swap 384m --cpus 0.5 --pids-limit 64 --shm-size 32m \
  --read-only --user "$pg_uid:$pg_gid" --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs "/var/lib/postgresql/data:rw,noexec,nosuid,nodev,size=256m,uid=$pg_uid,gid=$pg_gid,mode=0700" \
  --tmpfs "/var/run/postgresql:rw,noexec,nosuid,nodev,size=8m,uid=$pg_uid,gid=$pg_gid,mode=0700" \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=8m \
  --log-opt max-size=1m --log-opt max-file=1 \
  -e POSTGRES_DB=sinegasi_migration_rehearsal_runner -e POSTGRES_HOST_AUTH_METHOD=trust \
  "$pg_image" postgres -c listen_addresses=127.0.0.1 -c max_connections=10 -c shared_buffers=16MB)
docker start "$pg_id" >/dev/null
ready=false
for ((attempt=1; attempt<=30; attempt++)); do
  if timeout 3 docker exec "$pg_id" pg_isready -h 127.0.0.1 -U postgres -d sinegasi_migration_rehearsal_runner >/dev/null; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || fail 'Disposable PostgreSQL did not become ready.'
[[ "$(docker inspect -f '{{.HostConfig.NetworkMode}}|{{len .HostConfig.PortBindings}}' "$pg_id")" == 'none|0' ]] || fail 'Network/port isolation missing.'
timeout 5 docker exec "$pg_id" psql -h 127.0.0.1 -U postgres -d sinegasi_migration_rehearsal_runner -Atc 'SHOW server_version;'
# Shares ONLY the isolated network namespace, so PG reports loopback; no host
# published port or SSH tunnel can accidentally target an application DB.
client_id=$(docker create --name "$pg_name-client" --label "sinegasi.rehearsal=$run_id" \
  --network "container:$pg_id" --restart no --memory 128m --memory-swap 128m --cpus 0.5 --pids-limit 64 \
  --read-only --user "$(id -u):$(id -g)" --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=8m --log-opt max-size=1m --log-opt max-file=1 \
  --mount "type=bind,src=$bundle,dst=/app/rehearsal/scripts,readonly" --workdir /app \
  -e ENV_FILE_LOADING=disabled \
  -e ISOLATED_REHEARSAL_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/sinegasi_migration_rehearsal_runner \
  --entrypoint node "$client_image" /app/rehearsal/scripts/rehearseMigrationRunner.js)
docker start "$client_id" >/dev/null
timeout 45 docker wait "$client_id" >/dev/null
docker logs "$client_id"
[[ "$(docker inspect -f '{{.State.ExitCode}}' "$client_id")" == 0 ]] || fail 'Synthetic checks failed.'
[[ "$(timeout 5 docker exec "$pg_id" psql -h 127.0.0.1 -U postgres -d sinegasi_migration_rehearsal_runner -Atc "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public';")" == 0 ]] || fail 'Fixture cleanup failed.'
