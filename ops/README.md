# Guarded development deploy

Run this on the VPS from the repository root after updating `develop`:

```bash
cd /opt/sinegasi
git fetch origin develop
git pull --ff-only origin develop
./ops/deploy-dev.sh
```

The script deliberately does not use `--remove-orphans`. It verifies that
`caddy-proxy` is running before and after the deploy, takes a lock so deploys
cannot overlap, builds `api-dev`, runs every pending numbered SQL migration
through `dist/scripts/applyMigrations.js`, recreates only `api-dev`, and waits
for `/api/health`. Compose orphan notices are suppressed with
`COMPOSE_IGNORE_ORPHANS=1`; the script still verifies `caddy-proxy` directly and
never uses `--remove-orphans`.

Development and production workflows share one VPS checkout, so GitHub Actions
serializes deployments. Each workflow checks out its target branch immediately
before deploying; the deploy scripts also share a VPS lock for manual runs.

Production uses the same contract from the `main` branch:

```bash
cd /opt/sinegasi
git fetch origin main
git checkout main
git pull --ff-only origin main
./ops/deploy-prod.sh
```

The migration runner records each filename and SHA-256 checksum in
`public.schema_migrations`, uses a PostgreSQL advisory lock, and is safe to run
on every push. Existing databases are baselined through migration `074` on the
first run; new migrations such as `075_*.sql` are then applied automatically.

If Caddy is stopped or missing, the deploy fails closed. Restore it separately
without orphan cleanup:

```bash
docker compose -f docker-compose.caddy.yml up -d caddy
```
