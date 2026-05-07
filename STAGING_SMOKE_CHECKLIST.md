# Nest Cutover Staging Smoke Checklist

Use this checklist after deploying the Nest cutover to staging, a staging-like local environment, or a production release rehearsal. It is intentionally manual: the goal is to prove real integrations that unit and e2e smoke tests cannot fully cover.

## Before You Start

Use staging or dev credentials only. Do not use production payment secrets unless this is an approved production release rehearsal.

Set these values for the session:

```bash
BASE_URL="https://staging-api.example.com"
ADMIN_TOKEN="<admin jwt>"
USER_TOKEN="<user jwt>"
INSTRUCTOR_TOKEN="<instructor jwt>"
USER_ID="<test user id>"
INSTRUCTOR_ID="<test instructor id>"
COURSE_ID="<active course id>"
PACKAGE_ID="<active package id>"
COURSE_PACKAGE_ID="<active course package id>"
CHAT_ID="<test chat id>"
ROOM_ID="<test room id>"
UPLOAD_PATH="<known uploaded file path returned by the API>"
```

Confirm the deployed branch/SHA:

| Check | Expected | Actual | Status | Notes |
| --- | --- | --- | --- | --- |
| Branch/SHA | `codex/nest-migration-task-flow` or approved release SHA |  |  |  |
| Database | staging/dev database, not production |  |  |  |
| Payment mode | provider test/sandbox mode |  |  |  |
| OpenAI mode | staging key present or AI-disabled behavior expected |  |  |  |

## Required Command Checks

Run from the backend repo before or immediately after deployment:

| Check | Command | Expected Result | Actual Result | Owner | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TypeScript build | `npm run build` | exits `0` |  |  |  |  |
| Smoke tests | `npm test` | all suites pass |  |  |  |  |
| Email templates | `npm run email:check` | exits `0` |  |  |  |  |
| Production audit | `npm audit --omit=dev` | only documented breaking-upgrade residuals remain |  |  |  | Expected residuals include Nest 11, Swagger 11, Multer, Nodemailer, and related transitive upgrades. |

## Boot, Swagger, And Static Assets

| Check | Request | Expected Result | Actual Result | Owner | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Health | `GET $BASE_URL/api/v1/health` | `200`, `status: success`, service is `nexgen-api` |  |  |  |  |
| Swagger UI | open `$BASE_URL/api-docs` | Swagger UI loads |  |  |  |  |
| Swagger JSON | `GET $BASE_URL/api-docs.json` | `200`, valid OpenAPI JSON |  |  |  |  |
| Static upload | `GET $BASE_URL/$UPLOAD_PATH` | `200` file response, or expected auth-free static file behavior |  |  |  | Use a known staging upload path. |

## Auth And Authorization

| Check | Request | Expected Result | Actual Result | Owner | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Login | `POST $BASE_URL/api/v1/auth/login` | `200`, token and user data match legacy shape |  |  |  | Use staging user. |
| Get me | `GET $BASE_URL/api/v1/auth/getMe` with `USER_TOKEN` | `200`, current user returned |  |  |  |  |
| Missing token | protected route without token | `401` or legacy-compatible auth error |  |  |  | Example: `GET /api/v1/auth/getMe`. |
| Role forbidden | admin-only route with `USER_TOKEN` | `403` role error |  |  |  | Example: `GET /api/v1/users`. |

## Foundation And Catalog

| Check | Request | Expected Result | Actual Result | Owner | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Public catalog list | `GET $BASE_URL/api/v1/courses` | `200`, public active courses only |  |  |  |  |
| Public course detail | `GET $BASE_URL/api/v1/courses/courseDetails/$COURSE_ID` | `200`, response shape matches frontend expectation |  |  |  |  |
| Categories list | `GET $BASE_URL/api/v1/categories` | `200`, image URLs resolve |  |  |  |  |
| Validation failure | protected create/update with invalid body | `400`, validation error envelope |  |  |  | Use staging-safe endpoint/body. |
| Protected mutation | admin create/update on staging record | `200`/`201`, record created or updated |  |  |  | Clean up staging record afterward. |

## Uploads

| Check | Request | Expected Result | Actual Result | Owner | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| User image upload | multipart profile/cover upload with auth | saved WebP in existing public URL format |  |  |  | Use staging account. |
| Catalog image upload | admin upload on category/course/package/event/article | saved WebP and returned URL resolves |  |  |  |  |
| Non-image rejection | upload invalid MIME where image required | `400`, unsupported file type error |  |  |  |  |

## Commerce And Webhooks

| Check | Request | Expected Result | Actual Result | Owner | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Stripe checkout | `PUT $BASE_URL/api/v1/orders/stripe/courseCheckout/$COURSE_ID` | `200`, `{ status: "success", session }` |  |  |  | Test mode only. |
| Plisio checkout | `PUT $BASE_URL/api/v1/orders/plisio/courseCheckout/$COURSE_ID` | `200`, `{ status: "success", redirectUrl }` |  |  |  | Test/sandbox only. |
| Lahza checkout | `PUT $BASE_URL/api/v1/orders/lahza/courseCheckout/$COURSE_ID` | `200`, `{ status: "success", redirectUrl }` |  |  |  | Test/sandbox only. |
| Stripe raw webhook | `POST $BASE_URL/api/v1/orders/webhook/stripe` with provider test payload/signature | raw body accepted, handler returns expected provider response |  |  |  | Signature must be generated from raw payload. |
| Plisio raw webhook | `POST $BASE_URL/api/v1/orders/webhook/plisio` | `200`, duplicate-safe acknowledgement |  |  |  |  |
| Lahza raw webhook | `POST $BASE_URL/api/v1/orders/webhook/lahza` | `200`, duplicate-safe acknowledgement |  |  |  |  |
| Duplicate webhook | replay same provider event | no duplicate fulfillment/order/subscription/progress |  |  |  | Check logs and DB records. |

## Marketing, Cron, And Revenue

| Check | Request/Action | Expected Result | Actual Result | Owner | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| App boot with schedule | start staging app | no cron registration errors |  |  |  | Monthly reset uses `@Cron('0 0 0 1 * *')`. |
| Public leaderboard | `GET $BASE_URL/api/v1/leaderBoard` | `200` or documented empty-state response |  |  |  |  |
| Public marketer rating | `GET $BASE_URL/api/v1/marketerRating` | `200`, legacy-compatible shape |  |  |  |  |
| Monthly reset | manual trigger not performed by default | skipped unless staging data is prepared |  |  |  | Do not run against production-like data casually. |

## Realtime And Notifications

Use a Socket.IO client against `BASE_URL`.

| Check | Event/Action | Expected Result | Actual Result | Owner | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Connect | Socket.IO connect | connection succeeds with CORS |  |  |  |  |
| Presence | emit `addUser` with `USER_ID` | user recorded online, no server error |  |  |  |  |
| Join room | emit `joinRoom` with `USER_ID`, `ROOM_ID` | socket joins room |  |  |  |  |
| Group message | emit `sendMessage` with `roomId` | other room client receives `receiveMessage` |  |  |  |  |
| Private offline message | emit `sendMessage` to offline receiver | sender receives `errorMessage` |  |  |  |  |
| Notification | trigger backend notification or gateway emitter | target receives `notification` when online |  |  |  |  |
| Disconnect | disconnect socket | time-spent fields update without server error |  |  |  | Check staging user document if safe. |

## AI And Knowledge

| Check | Request | Expected Result | Actual Result | Owner | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Protected sessions list | `GET $BASE_URL/api/v1/ai-chat/sessions` with `USER_TOKEN` | `200`, session list |  |  |  |  |
| Protected session create | `POST $BASE_URL/api/v1/ai-chat/sessions` | `200`/`201`, session created |  |  |  |  |
| Guest chat without AI key | `POST $BASE_URL/api/v1/ai-chat` | documented AI config error if staging AI disabled |  |  |  | Acceptable when `OPENAI_API_KEY` or vector store is absent. |
| Guest chat with AI key | `POST $BASE_URL/api/v1/ai-chat` | `200`, returns `chatId`, `guestKey`, `answer`, recommendations/handoff fields |  |  |  | Only when staging AI is configured. |
| Admin knowledge status | `GET $BASE_URL/api/v1/ai-knowledge/sync-status` with `ADMIN_TOKEN` | `200`, sync counts |  |  |  |  |

## Release Gates And Rollback

Block release if any of these fail:

- auth login/getMe/protected-route behavior.
- checkout creation or webhook raw-body handling.
- upload save and returned public URL behavior.
- Swagger UI or JSON boot.
- Socket.IO gateway boot/connect.
- cron boot.
- app build, test, or email check.

Allowed with explicit release note:

- `npm audit --omit=dev` residual vulnerabilities that require breaking dependency upgrades already deferred in `NEST_MIGRATION_TASK_FLOW.md`.
- AI chat returning configuration errors when staging intentionally has no OpenAI key/vector store.

Rollback rule:

- Revert to the last known good deployment artifact for the same database.
- Do not run destructive data cleanup unless the failed smoke step created known staging-only test records.
- Capture failing request, response body, logs, SHA, and environment variables involved before rollback when possible.
