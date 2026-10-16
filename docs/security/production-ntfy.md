# Production ntfy — public generic alerts

Status: code preparation only. This document is not deployment evidence, a live
topic reservation, or proof of delivery to a phone. No message is sent by tests.

The operator chose the free, public topic `sinegasi-notif`, separate from DEV.
On ntfy.sh, topics appear when subscribed to or published to; the name is not
reserved or owned by this application. Anyone knowing an unprotected topic may
read its messages or impersonate a publisher. This obvious name is not a secret.
See [topic selection](https://docs.ntfy.sh/publish/#picking-a-topic).

## Allowed content and delivery

Only three existing workflow templates may use anonymous production delivery:

| Event | Link after tapping |
| --- | --- |
| New equipment borrowing submission | `https://sinegasi.pictures/notifications` |
| Equipment return report submitted | `https://sinegasi.pictures/borrowing` |
| Cash dispute submitted | `https://sinegasi.pictures/cash?scope=manage` |

Messages say that a new submission needs review and instruct the recipient to
log in. They contain no student name, transaction ID, asset details, evidence,
password, token or attachment. The free-form `sendNtfyMessage` interface is
blocked in public-generic mode, even if a caller supplies a different topic or
link. Tests inject private-looking fixture values and confirm none are emitted.

The topic still reveals event categories/timing. Spoofed messages and spam are
possible. Treat a push only as a hint: open the official CMS and verify after
login before taking action. This is not a private teacher-only channel and does
not synchronize every in-app bell notification or route messages per student.

Delivery is best effort, with the existing seven-second transport timeout, no
durable outbox and no automatic retry. A transport rejection must not fail the
primary CMS operation. Acceptance by ntfy is not proof of Android receipt.

## Configuration contract

Application defaults remain disabled. Production no longer falls back to the
DEV topic/frontend when explicit configuration is missing. DEV configuration is
unchanged, including the existing authenticated-public-deployment guard.

The candidate `docker-compose.prod.yml` pins this explicit release configuration:

```text
NTFY_ENABLED=true
NTFY_PUBLIC_GENERIC_ENABLED=true
NTFY_SERVER_URL=https://ntfy.sh
NTFY_TOPIC=sinegasi-notif
NTFY_CASH_REVIEW_TOPIC=sinegasi-notif
NTFY_FRONTEND_URL=https://sinegasi.pictures
NTFY_ACCESS_TOKEN=
BACKGROUND_JOBS_ENABLED=false
```

The sender and production runtime preflight reject a changed server, HTTP,
credentials/query/path/fragment in the server URL, another topic/frontend, or a
token in this anonymous mode. The general authenticated sender still requires a
token for public deployments when the public-generic exception is off; a token
alone does not prove read ACL privacy. No CMS auth, CORS, R2, firewall or DB policy
is changed. Compose overrides any stale ntfy values in private runtime config;
there is no need to read or edit `.env` files for this patch.

## Review and rollout — not performed by preparing this patch

1. Review the feature branch based on `develop`. Run the isolated tests below,
   then promote through `develop` and `main` with passing exact-commit CI.
   Pushing `develop` can trigger the existing DEV deployment, so code-only
   preparation must not push automatically.
2. Follow the existing [production gate](../../ops/production-gate/README.md)
   with fresh evidence, review choice, immutable image/archive approval,
   maintenance window and rollback preparation. Do not reuse an expired window
   or bypass schema/recovery gates because no migration is needed.
3. Deploy only the approved backend release. No frontend deployment or new worker
   is needed. Preserve DEV/Caddy and validate backend health.
4. Only with separate approval, send one generic test through the deployed named
   workflow sender without creating a borrowing/cash record. Do not query topic
   history to establish ownership or claim the name is unoccupied. If ntfy
   rejects the name, stop and choose another destination with the operator.
5. Confirm receipt on the Android device and confirm the action opens production
   CMS with normal login/role checks. Keep this manual result distinct from CI.

## Android setup

Install [ntfy for Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy)
and allow notifications. Tap **+ / Subscribe to topic**, use server
`https://ntfy.sh` and topic `sinegasi-notif`. No CMS password or backend key belongs
in the ntfy app. A subscription can exist before backend activation, but it does
not prove integration is live or protect the topic.

If delivery is delayed, check whether the subscription is paused and check
Android notification/battery settings. Follow the app's
[phone subscription guidance](https://docs.ntfy.sh/subscribe/phone/); do not
disable device-wide security controls.

## Disable / rollback

Use the existing exact-digest release rollback with the previous immutable
Compose package, not just an old image with the new configuration. The previous
production package had ntfy disabled. For a later reviewed release, setting
`NTFY_ENABLED=false` in its versioned Compose disables delivery; the runtime
preflight permits that safe-off state. Do not edit private credentials or enable
background jobs as a workaround. Rollback cannot retract already delivered
public messages.

## Isolated verification

Run with `ENV_FILE_LOADING=disabled` and a clean synthetic environment:

```sh
cd backend
env -i PATH="$PATH" LANG=C ENV_FILE_LOADING=disabled NODE_ENV=test \
  PUBLIC_DEPLOYMENT=false BACKGROUND_JOBS_ENABLED=false NTFY_ENABLED=false \
  node --import tsx --test --test-concurrency=1 \
  src/config/ntfyConfig.test.ts src/services/ntfyService.test.ts src/services/ntfyPublicTopic.test.ts
cd ..
node --test ops/production-release.test.mjs
node scripts/verify-guardrails.mjs
```

Transport and Docker/PG adapters are mocked. No `.env`, Keychain, actual ntfy
subscription, topic history, production DB or VPS is accessed by these checks.
