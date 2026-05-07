# Nest Cutover Staging Smoke Results

## Summary

This report records the release-readiness status for the Nest-only backend cutover after the legacy JavaScript runtime cleanup.

Current decision: **blocked pending manual staging smoke execution**.

Automated local verification passed. Manual integration checks are not marked as passed because no staging `BASE_URL`, tokens, payment sandbox payloads, Socket.IO clients, or AI staging configuration were provided for this run.

## Environment Metadata

| Field | Value |
| --- | --- |
| Branch | `codex/nest-migration-task-flow` |
| Commit SHA | `9b67273` |
| Result date | `2026-05-07` |
| Target environment | Not executed against staging yet |
| `BASE_URL` | Pending |
| Admin token | Pending, not stored |
| User token | Pending, not stored |
| Instructor token | Pending, not stored |
| Test IDs | Pending, not stored |
| Payment mode | Must be staging/test/sandbox only |
| OpenAI mode | Pending staging config confirmation |

## Command Checks

| Check | Command | Expected Result | Actual Result | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| TypeScript build | `npm run build` | exits `0` | exits `0` | Pass | Ran locally from backend repo. |
| Smoke tests | `npm test` | all suites pass | 9 suites passed, 113 tests passed | Pass | Ran locally from backend repo. |
| Email templates | `npm run email:check` | exits `0` | exits `0` | Pass | Ran locally from backend repo. |
| Production audit | `npm audit --omit=dev` | only documented breaking-upgrade residuals remain | exits `1`, 15 vulnerabilities | Known residual | Residuals require force/breaking upgrades for Nest, Swagger, Multer, Nodemailer, and related transitive packages. |

## Manual HTTP And Integration Checks

| Group | Checks | Status | Notes |
| --- | --- | --- | --- |
| Boot and health | `GET /api/v1/health` | Pending | Requires staging/local-like `BASE_URL`. |
| Swagger | `/api-docs`, `/api-docs.json` | Pending | Requires deployed app. |
| Auth | login, `getMe`, missing token, role forbidden | Pending | Requires staging users and tokens. |
| Static uploads | known `/uploads/...` asset or upload-then-fetch | Pending | Requires staging upload path or safe upload fixture. |
| Foundation/catalog | public list/detail and protected validation failure | Pending | Requires staging course/category IDs and admin token. |
| Commerce/webhooks | checkout response, raw webhook acknowledgement, duplicate idempotency | Pending | Requires payment provider sandbox payloads and signatures. |
| Marketing cron | schedule boot confirmation, no manual monthly reset unless prepared | Pending | Requires staging app logs. |
| Realtime | Socket.IO connect, `addUser`, `joinRoom`, `leaveRoom`, `sendMessage`, `receiveMessage`, `notification`, `errorMessage`, disconnect time-spent | Pending | Requires Socket.IO client and staging users/chats. |
| AI | protected sessions and optional guest chat | Pending | Requires staging AI config or confirmed disabled-key expectation. |

## Required Webhook Paths

These exact paths must be used during manual provider testing:

- `/api/v1/orders/webhook/stripe`
- `/api/v1/orders/webhook/plisio`
- `/api/v1/orders/webhook/lahza`

## Required Socket.IO Events

These event names must be validated during manual realtime testing:

- `addUser`
- `joinRoom`
- `leaveRoom`
- `sendMessage`
- `receiveMessage`
- `notification`
- `errorMessage`

## Release Gate

Release remains blocked until the manual staging checks are completed.

Block release on any failure in:

- app boot.
- auth login or protected route behavior.
- upload save and returned public URL behavior.
- checkout creation or webhook raw-body handling.
- Socket.IO gateway boot/connect.
- cron boot.
- Swagger UI or JSON boot.

Allowed only with explicit release note:

- `npm audit --omit=dev` residual vulnerabilities whose available fixes require breaking dependency upgrades.
- AI chat configuration errors when staging intentionally has no OpenAI key/vector store.

## Next Recommended Task

After staging smoke passes, plan a dedicated dependency hardening task for Nest 11, Swagger 11, Multer, Nodemailer, and related transitive audit fixes.
