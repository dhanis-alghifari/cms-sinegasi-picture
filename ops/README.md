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
cannot overlap, builds `api-dev`, runs the idempotent grade/cash/contest
migrations, recreates only `api-dev`, and waits for `/api/health`.

If Caddy is stopped or missing, the deploy fails closed. Restore it separately
without orphan cleanup:

```bash
docker compose -f docker-compose.caddy.yml up -d caddy
```
