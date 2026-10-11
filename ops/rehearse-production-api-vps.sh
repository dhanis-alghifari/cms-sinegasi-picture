#!/usr/bin/env bash
# Extends the existing fresh-schema rehearsal; never mounts application secrets.
set -Eeuo pipefail
umask 077
fail() { printf '%s\n' 'API_REHEARSAL_STOP' >&2; exit 1; }
[[ "$(id -un)" == ubuntu && "$(hostname)" == VM-11-154-ubuntu && $# -eq 2 ]] || fail
action=$1
bundle=$2
[[ "$bundle" =~ ^/tmp/sinegasi-schema-rehearsal\.[A-Za-z0-9]+$ && -d "$bundle" && ! -L "$bundle" ]] || fail
[[ "$(stat -c '%U:%a' "$bundle")" == ubuntu:700 ]] || fail
run_id=${bundle##*.}
pg_name="sinegasi-schema-rehearsal-$run_id"
rest_name="$pg_name-rest"
client_name="$pg_name-check"
rest_image='postgrest/postgrest@sha256:bca3f86f69d8ef7aa1e5ee65e66ce9a20c6c147be637517a7be8399e102901d1'
owned_pg() {
  local result
  result=$(timeout 5 docker inspect -f '{{.Id}}|{{index .Config.Labels "sinegasi.schema-rehearsal"}}|{{.HostConfig.NetworkMode}}|{{len .HostConfig.PortBindings}}' "$pg_name") || fail
  [[ "$result" == *"|$run_id|none|0" ]] || fail
  printf '%s' "${result%%|*}"
}
case "$action" in
  prepare)
    pg_id=$(owned_pg)
    [[ -z "$(docker ps -aq --filter "name=^/$rest_name$")" ]] || fail
    timeout 5 docker image inspect "$rest_image" >/dev/null || fail
    # Disposable server certificate with explicit trust; TLS verification stays ON.
    openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj '/CN=localhost' \
      -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1' -addext 'basicConstraints=critical,CA:TRUE' \
      -keyout "$bundle/fixture-tls.key" -out "$bundle/fixture-tls.crt" >/dev/null 2>&1 || fail
    timeout 10 docker exec "$pg_id" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d sinegasi_schema_fresh \
      -c 'CREATE ROLE authenticator LOGIN NOINHERIT; GRANT anon, authenticated, service_role TO authenticator;' >/dev/null 2>&1 || fail
    docker create --name "$rest_name" --label "sinegasi.schema-rehearsal=$run_id" \
      --network "container:$pg_id" --restart no --memory 128m --memory-swap 128m --cpus 0.5 --pids-limit 64 \
      --read-only --user "$(id -u):$(id -g)" --cap-drop ALL --security-opt no-new-privileges --log-driver none \
      -e PGRST_DB_URI=postgres://authenticator@127.0.0.1:5432/sinegasi_schema_fresh \
      -e PGRST_DB_ANON_ROLE=anon -e PGRST_DB_SCHEMAS=public -e PGRST_DB_POOL=3 -e PGRST_DB_CONFIG=false \
      -e PGRST_JWT_SECRET=sinegasi-isolated-postgrest-fixture-only-never-live-2026 \
      -e PGRST_SERVER_HOST=127.0.0.1 -e PGRST_SERVER_PORT=3000 -e PGRST_LOG_LEVEL=crit "$rest_image" >/dev/null
    docker start "$rest_name" >/dev/null
    printf '%s\n' 'ISOLATED_POSTGREST_PREPARED'
    ;;
  verify)
    pg_id=$(owned_pg)
    client_image=$(timeout 5 docker inspect -f '{{.Image}}' sinegasi-api-dev)
    [[ "$client_image" =~ ^sha256:[a-f0-9]{64}$ ]] || fail
    timeout 120 docker run --rm --name "$client_name" --label "sinegasi.schema-rehearsal=$run_id" \
      --network "container:$pg_id" --restart no --memory 256m --memory-swap 256m --cpus 0.5 --pids-limit 64 \
      --read-only --user "$(id -u):$(id -g)" --cap-drop ALL --security-opt no-new-privileges \
      --tmpfs /tmp:rw,noexec,nosuid,nodev,size=16m --log-driver none \
      --mount "type=bind,src=$bundle,dst=/app/rehearsal,readonly" --workdir /app \
      -e ENV_FILE_LOADING=disabled -e NODE_EXTRA_CA_CERTS=/app/rehearsal/fixture-tls.crt \
      --entrypoint node "$client_image" /app/rehearsal/scripts/verifyProductionApi.js isolated-api
    ;;
  cleanup)
    # Validate exact ownership/network before deleting ONLY this generated run.
    pg_id=''
    if docker container inspect "$pg_name" >/dev/null 2>&1; then pg_id=$(owned_pg); fi
    for name in "$client_name" "$rest_name"; do
      if docker container inspect "$name" >/dev/null 2>&1; then
        state=$(timeout 5 docker inspect -f '{{.Id}}|{{index .Config.Labels "sinegasi.schema-rehearsal"}}|{{.HostConfig.NetworkMode}}|{{len .HostConfig.PortBindings}}' "$name") || fail
        [[ -n "$pg_id" && "$state" == *"|$run_id|container:$pg_id|0" ]] || fail
        timeout 15 docker rm --force --volumes "${state%%|*}" >/dev/null || fail
      fi
    done
    if [[ -n "$pg_id" ]]; then timeout 15 docker rm --force --volumes "$pg_id" >/dev/null || fail; fi
    for pair in 'dev:sinegasi-api-dev' 'caddy:caddy-proxy'; do
      file=${pair%%:*}
      name=${pair#*:}
      if [[ -f "$bundle/$file.state" ]]; then
        [[ ! -L "$bundle/$file.state" && "$(timeout 5 docker inspect -f '{{.Id}}|{{.State.Running}}' "$name")" == "$(<"$bundle/$file.state")" ]] || fail
      fi
    done
    # The path was allocated by mktemp for this run, owner/mode/prefix validated above.
    # It contains only reviewed compiled modules and synthetic, expired-after-one-day TLS material.
    rm -r -- "$bundle"
    printf '%s\n' 'API_CLEANUP_DEV_CADDY_UNCHANGED'
    ;;
  *) fail ;;
esac
