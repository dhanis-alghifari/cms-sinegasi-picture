#!/usr/bin/env bash
# Only a new, labelled, network-none container may be mutated or removed.
set -Eeuo pipefail
umask 077
fail() { printf '%s\n' 'BACKUP_RESTORE_STOP' >&2; exit 1; }
[[ "$(id -un)" == ubuntu && "$(hostname)" == VM-11-154-ubuntu ]] || fail
[[ $# -eq 2 ]] || fail
action=$1
bundle=$2
[[ "$bundle" =~ ^/tmp/sinegasi-backup-restore\.[A-Za-z0-9]+$ && -d "$bundle" && ! -L "$bundle" ]] || fail
[[ "$(stat -c '%U:%a' "$bundle")" == ubuntu:700 ]] || fail
run_id=${bundle##*.}
pg_name="sinegasi-backup-restore-$run_id"
client_name="$pg_name-check"
pg_image='postgres@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826'
owned_id() {
  local name=$1 result
  result=$(timeout 5 docker inspect -f '{{.Id}}|{{index .Config.Labels "sinegasi.backup-restore"}}|{{.HostConfig.NetworkMode}}|{{len .HostConfig.PortBindings}}' "$name") || fail
  [[ "$result" == *"|$run_id|none|0" ]] || fail
  printf '%s' "${result%%|*}"
}
case "$action" in
  prepare)
    [[ -z "$(docker ps -aq --filter "name=^/$pg_name$" --filter "name=^/$client_name$")" ]] || fail
    [[ $(awk '/^MemAvailable:/ {print $2}' /proc/meminfo) -ge 1843200 ]] || fail
    for file in productionBackupCore.js verifyBackupRestore.js; do
      [[ -f "$bundle/$file" && ! -L "$bundle/$file" && "$(stat -c '%U' "$bundle/$file")" == ubuntu ]] || fail
    done
    timeout 5 docker image inspect "$pg_image" >/dev/null || fail
    dev_state=$(timeout 5 docker inspect -f '{{.Id}}|{{.State.Running}}' sinegasi-api-dev)
    caddy_state=$(timeout 5 docker inspect -f '{{.Id}}|{{.State.Running}}' caddy-proxy)
    [[ "$dev_state" == *'|true' && "$caddy_state" == *'|true' ]] || fail
    printf '%s\n' "$dev_state" > "$bundle/dev.state"
    printf '%s\n' "$caddy_state" > "$bundle/caddy.state"
    pg_uid=$(docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --entrypoint id "$pg_image" -u postgres)
    pg_gid=$(docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --entrypoint id "$pg_image" -g postgres)
    [[ "$pg_uid" =~ ^[0-9]+$ && "$pg_gid" =~ ^[0-9]+$ ]] || fail
    docker create --name "$pg_name" --label "sinegasi.backup-restore=$run_id" \
      --network none --restart no --memory 384m --memory-swap 384m --cpus 0.5 --pids-limit 64 --shm-size 32m \
      --read-only --user "$pg_uid:$pg_gid" --cap-drop ALL --security-opt no-new-privileges \
      --tmpfs "/var/lib/postgresql/data:rw,noexec,nosuid,nodev,size=256m,uid=$pg_uid,gid=$pg_gid,mode=0700" \
      --tmpfs "/var/run/postgresql:rw,noexec,nosuid,nodev,size=8m,uid=$pg_uid,gid=$pg_gid,mode=0700" \
      --tmpfs "/tmp:rw,noexec,nosuid,nodev,size=32m,uid=$pg_uid,gid=$pg_gid,mode=0700" \
      --log-driver none -e POSTGRES_DB=sinegasi_backup_restore -e POSTGRES_HOST_AUTH_METHOD=trust \
      "$pg_image" postgres -c listen_addresses=127.0.0.1 -c max_connections=10 -c shared_buffers=16MB >/dev/null
    pg_id=$(owned_id "$pg_name")
    docker start "$pg_id" >/dev/null
    ready=false
    for ((attempt=1; attempt<=30; attempt++)); do
      if timeout 3 docker exec "$pg_id" pg_isready -h 127.0.0.1 -U postgres -d sinegasi_backup_restore >/dev/null; then ready=true; break; fi
      sleep 1
    done
    [[ "$ready" == true ]] || fail
    printf '%s\n' 'ISOLATED_RESTORE_PREPARED'
    ;;
  upload)
    pg_id=$(owned_id "$pg_name")
    # Archive is never written to host disk. Cgroup swap is disabled; /tmp is tmpfs.
    timeout 60 docker exec -i "$pg_id" sh -c 'umask 077; test ! -e /tmp/database.dump; dd of=/tmp/database.dump bs=65536 status=none' || fail
    printf '%s\n' 'ISOLATED_ARCHIVE_UPLOADED'
    ;;
  scaffold)
    pg_id=$(owned_id "$pg_name")
    timeout 15 docker exec -i "$pg_id" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d sinegasi_backup_restore >/dev/null 2>&1 || fail
    printf '%s\n' 'ISOLATED_PREREQUISITES_CREATED'
    ;;
  restore)
    pg_id=$(owned_id "$pg_name")
    # public already exists for extension prerequisites. Retain its ACL/comment,
    # but omit only CREATE SCHEMA public, not tables, data, policies or grants.
    timeout 10 docker exec "$pg_id" sh -c 'pg_restore --list /tmp/database.dump | awk '\''/ SCHEMA - public / { print ";" $0; next } { print }'\'' > /tmp/restore.list' || fail
    timeout 60 docker exec "$pg_id" pg_restore --exit-on-error --single-transaction --no-owner \
      --use-list=/tmp/restore.list --schema=public -U postgres -d sinegasi_backup_restore /tmp/database.dump >/dev/null 2>&1 || fail
    printf '%s\n' 'PUBLIC_RESTORE_COMPLETED'
    ;;
  verify)
    pg_id=$(owned_id "$pg_name")
    client_image=$(timeout 5 docker inspect -f '{{.Image}}' sinegasi-api-dev)
    [[ "$client_image" =~ ^sha256:[a-f0-9]{64}$ ]] || fail
    timeout 15 docker run --rm --name "$client_name" --label "sinegasi.backup-restore=$run_id" \
      --network "container:$pg_id" --restart no --memory 128m --memory-swap 128m --cpus 0.5 --pids-limit 64 \
      --read-only --user "$(id -u):$(id -g)" --cap-drop ALL --security-opt no-new-privileges \
      --tmpfs /tmp:rw,noexec,nosuid,nodev,size=8m --log-driver none \
      --mount "type=bind,src=$bundle,dst=/app/rehearsal,readonly" --workdir /app \
      -e ENV_FILE_LOADING=disabled --entrypoint node "$client_image" \
      /app/rehearsal/verifyBackupRestore.js isolated-public-restore
    ;;
  cleanup)
    pg_id=$(owned_id "$pg_name")
    if docker container inspect "$client_name" >/dev/null 2>&1; then
      [[ "$(docker inspect -f '{{index .Config.Labels "sinegasi.backup-restore"}}' "$client_name")" == "$run_id" ]] || fail
      timeout 15 docker rm --force --volumes "$client_name" >/dev/null || fail
    fi
    timeout 15 docker rm --force --volumes "$pg_id" >/dev/null || fail
    [[ "$(timeout 5 docker inspect -f '{{.Id}}|{{.State.Running}}' sinegasi-api-dev)" == "$(<"$bundle/dev.state")" ]] || fail
    [[ "$(timeout 5 docker inspect -f '{{.Id}}|{{.State.Running}}' caddy-proxy)" == "$(<"$bundle/caddy.state")" ]] || fail
    for file in productionBackupCore.js verifyBackupRestore.js rehearse-backup-restore-vps.sh dev.state caddy.state; do
      [[ -f "$bundle/$file" && ! -L "$bundle/$file" && "$(stat -c '%U' "$bundle/$file")" == ubuntu ]] || fail
      rm -- "$bundle/$file"
    done
    rmdir -- "$bundle"
    printf '%s\n' 'RESTORE_CLEANUP_DEV_CADDY_UNCHANGED'
    ;;
  *) fail ;;
esac
