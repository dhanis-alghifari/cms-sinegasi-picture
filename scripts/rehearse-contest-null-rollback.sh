#!/usr/bin/env bash
# Runs only against ephemeral synthetic containers and already-cached images.
set -Eeuo pipefail
repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
migration="$repo_dir/supabase/migrations/20261106145108_contest_optional_deadline.sql"
pg_image='postgres@sha256:3645570cccdfa447589da9f57dd740faa29b30938e861289a5574b6ca6b03826'
rollback_image='ghcr.io/dhanis-alghifari/cms-sinegasi-picture/api@sha256:d6b998602feefc66d74d484bf5863d415a12721bbca534d7d2fa169e8326e3f4'
command -v docker >/dev/null || { echo 'Docker is required' >&2; exit 1; }
[[ -f "$migration" && ! -L "$migration" ]] || { echo 'Migration not found' >&2; exit 1; }
docker image inspect "$pg_image" "$rollback_image" >/dev/null || { echo 'Both pinned images must already be cached' >&2; exit 1; }
uid=$(docker run --rm --pull never --network none --read-only --cap-drop ALL --security-opt no-new-privileges --entrypoint id "$pg_image" -u postgres)
gid=$(docker run --rm --pull never --network none --read-only --cap-drop ALL --security-opt no-new-privileges --entrypoint id "$pg_image" -g postgres)
[[ "$uid" =~ ^[0-9]+$ && "$gid" =~ ^[0-9]+$ ]] || exit 1
run_id="contest-rollback-test-$(date +%s)-$$-$RANDOM"
container_id=''
cleanup() {
  [[ -n "$container_id" ]] || return 0
  local state
  state=$(docker inspect -f '{{.Id}}|{{index .Config.Labels "sinegasi.contest-rehearsal"}}|{{.HostConfig.NetworkMode}}' "$container_id" 2>/dev/null || true)
  if [[ "$state" == "$container_id|$run_id|none" ]]; then
    docker stop -t 2 "$container_id" >/dev/null || echo "WARNING: failed to stop test container $container_id" >&2
  fi
}
trap cleanup EXIT
container_id=$(docker run -d --rm --pull never --name "$run_id" --label "sinegasi.contest-rehearsal=$run_id" \
  --network none --restart no --memory 384m --memory-swap 384m --cpus 0.5 --pids-limit 64 --shm-size 32m \
  --read-only --user "$uid:$gid" --cap-drop ALL --security-opt no-new-privileges --log-driver none \
  --tmpfs "/var/lib/postgresql/data:rw,noexec,nosuid,nodev,size=256m,uid=$uid,gid=$gid,mode=0700" \
  --tmpfs "/var/run/postgresql:rw,noexec,nosuid,nodev,size=8m,uid=$uid,gid=$gid,mode=0700" \
  --tmpfs "/tmp:rw,noexec,nosuid,nodev,size=32m,uid=$uid,gid=$gid,mode=0700" \
  -e POSTGRES_DB=contest_test -e POSTGRES_HOST_AUTH_METHOD=trust "$pg_image" \
  postgres -c listen_addresses='' -c max_connections=10 -c shared_buffers=16MB)
ready=false
for ((i=0;i<40;i++)); do
  if docker exec "$container_id" psql -X -q -U postgres -d contest_test -c 'SELECT 1' >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]] || { echo 'Synthetic database failed to start' >&2; exit 1; }
docker exec -i "$container_id" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d contest_test <<'SQL'
CREATE TABLE public.contests (id text PRIMARY KEY, nama text NOT NULL, jenis text NOT NULL, level text NOT NULL, tanggal_lomba date NOT NULL, tanggal date, deadline date, status text NOT NULL, status_public text NOT NULL);
CREATE FUNCTION public.validate_contest_deadline_future() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;
CREATE TRIGGER validate_contest_deadline_future BEFORE INSERT OR UPDATE ON public.contests FOR EACH ROW EXECUTE FUNCTION public.validate_contest_deadline_future();
INSERT INTO public.contests VALUES ('existing','Existing','Film','umum','2020-01-01','2020-01-01','2020-01-01','selesai','selesai');
SQL
docker exec -i "$container_id" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d contest_test < "$migration"
docker exec -i "$container_id" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d contest_test <<'SQL'
INSERT INTO public.contests VALUES ('synthetic','Festival Sintetis','Film','umum',NULL,NULL,NULL,'selesai','selesai');
INSERT INTO public.contests VALUES ('open-today','Terbuka','Film','umum',(now() AT TIME ZONE 'Asia/Jakarta')::date,NULL,NULL,'progres','buka');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.contests VALUES ('invalid','Invalid','Film','umum',NULL,NULL,NULL,'progres','buka');
    RAISE EXCEPTION 'Expected deadline error, but insert was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  BEGIN
    UPDATE public.contests SET status_public='buka' WHERE id='synthetic';
    RAISE EXCEPTION 'Expected deadline error, but update was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  BEGIN
    ALTER TABLE public.contests ALTER COLUMN tanggal_lomba SET NOT NULL;
    RAISE EXCEPTION 'Expected null rollback failure, but alter was accepted';
  EXCEPTION WHEN not_null_violation THEN NULL; END;
END $$;
SQL
row=$(docker exec "$container_id" psql -X -At -U postgres -d contest_test -c "SELECT row_to_json(c) FROM public.contests c WHERE id='synthetic'")
docker run --rm --pull never --network none --restart no --memory 128m --memory-swap 128m --cpus 0.5 --pids-limit 64 \
  --read-only --cap-drop ALL --security-opt no-new-privileges --log-driver none --entrypoint node "$rollback_image" \
  -e 'const {mapContestPersistenceRow}=require("./dist/modules/contests/contests.persistence.compatibility.js"); const r=mapContestPersistenceRow(JSON.parse(process.argv[1])); if(r.deadline!==null || r.tanggal!==null) process.exit(1); console.log("ROLLBACK_IMAGE_SYNTHETIC_PG_ROW_OK");' "$row"
echo 'ISOLATED_POSTGRES_MIGRATION_CHECKS_OK'
