# Legacy JS To Nest TypeScript Cleanup Plan

## Summary

The Nest cutover is complete, but some TypeScript modules still import retained legacy JS models, services, helpers, validators, middleware, and socket utilities. This plan removes that remaining compatibility layer in small tasks until all backend runtime code lives under `src/` and follows Nest module/service/schema patterns.

Default strategy:
- Keep API paths and response shapes unchanged.
- Preserve Mongo collection names and stored document shapes.
- Move behavior into existing Nest modules instead of creating a second architecture.
- Delete a legacy JS file only after `src/**`, `test/**`, `emails/**`, and `scripts/**` no longer import it.
- Run build/tests/email checks after every task.

## Current Remaining Legacy Imports From `src/**`

Direct imports currently exist in:
- `src/auth/auth.service.ts`
- `src/commerce/order-fulfillment.service.ts`
- `src/commerce/payment-provider.service.ts`
- `src/foundation-data/foundation-data.schemas.ts`
- `src/marketing-revenue/marketing.service.ts`

Legacy areas still retained:
- `models/`
- `services/`
- `utils/`
- `helpers/`
- `middlewares/validatorMiddleware.js`
- `middlewares/uploadImageMiddleware.js`
- `socket/index.js`

## Execution Tracker

Use this section as the working tracker for the full legacy cleanup. Do not mark a task complete until its verification commands pass and the commit is created.

- [x] Task 1: Inventory and guardrails.
- [x] Task 2: Replace legacy model imports with injected Mongoose models.
- [x] Task 3: Port shared utils and helpers into `src/common`.
- [x] Task 4: Replace legacy validator dependencies.
- [ ] Task 5: Port legacy service helpers still called by Nest.
- [ ] Task 6: Replace socket compatibility bridge.
- [ ] Task 7: Move cron and scripted runtime code.
- [ ] Task 8: Delete remaining legacy folders and dependencies.

Current direct legacy import count from `src/**`: **7**.

Guardrail command for every cleanup PR:

```powershell
Get-ChildItem -Recurse -File src |
  Select-String -Pattern "require\\('../../models|require\\('../../services|require\\('../../helpers|require\\('../../utils|require\\('../../middlewares|require\\('../../socket"
```

Rule: the count must only go down, unless the PR explains a temporary move and includes a follow-up removal item in this file.

## Direct Legacy Import Tracker

### Auth

- [ ] `src/auth/auth.service.ts`: `services/marketing/marketingAnalyticsService` for `getMarketerFromInvitationKey`.

### Commerce

- [x] `src/commerce/commerce-access.service.ts`: `models/userModel`.
- [x] `src/commerce/commerce-access.service.ts`: `utils/validators/courseValidator`.
- [x] `src/commerce/order-fulfillment.service.ts`: `models/userModel`.
- [x] `src/commerce/order-fulfillment.service.ts`: `models/ChatModel`.
- [x] `src/commerce/order-fulfillment.service.ts`: `models/notificationModel`.
- [x] `src/commerce/order-fulfillment.service.ts`: `utils/generatePdf`.
- [x] `src/commerce/order-fulfillment.service.ts`: `utils/sendEmail`.
- [ ] `src/commerce/order-fulfillment.service.ts`: `services/couponService`.
- [ ] `src/commerce/order-fulfillment.service.ts`: `services/userService`.
- [ ] `src/commerce/order-fulfillment.service.ts`: `helpers/marketingHelper`.
- [ ] `src/commerce/payment-provider.service.ts`: `services/couponService`.

### Community Realtime

- [x] `src/community-realtime/community-realtime.service.ts`: `utils/filterOffensiveWords`.
- [x] `src/community-realtime/community-realtime.service.ts`: `utils/sendEmail`.

### Foundation Data

- [x] `src/foundation-data/foundation-data.schemas.ts`: `models/courseModel`.
- [x] `src/foundation-data/foundation-data.schemas.ts`: `models/userModel`.
- [ ] `src/foundation-data/foundation-data.schemas.ts`: `socket/index`.
- [x] `src/foundation-data/foundation-data.schemas.ts`: `utils/pushNotification`.
- [x] `src/foundation-data/foundation-data.service.ts`: `models/courseModel`.
- [x] `src/foundation-data/foundation-data.service.ts`: `models/courseProgressModel`.
- [x] `src/foundation-data/foundation-data.service.ts`: `models/userModel`.
- [x] `src/foundation-data/foundation-data.service.ts`: `utils/pushNotification`.

### Learning Catalog

- [x] `src/learning-catalog/learning-catalog.service.ts`: `models/userSubscriptionModel`.

### Marketing Revenue

- [ ] `src/marketing-revenue/marketing.service.ts`: `services/ChatServices`.
- [x] `src/marketing-revenue/rating-leaderboard.service.ts`: `helpers/generalHelper`.

### Users

- [x] `src/users/users.service.ts`: `models/orderModel`.
- [x] `src/users/users.service.ts`: `models/MessageModel`.
- [x] `src/users/users.service.ts`: `models/ChatModel`.
- [x] `src/users/users.service.ts`: `models/notificationModel`.
- [x] `src/users/users.service.ts`: `models/reactionModel`.
- [x] `src/users/users.service.ts`: `models/commentModel`.
- [x] `src/users/users.service.ts`: `models/courseProgressModel`.
- [x] `src/users/users.service.ts`: `models/MarketingModel`.
- [x] `src/users/users.service.ts`: `models/courseModel`.
- [x] `src/users/users.service.ts`: `models/articalModel`.
- [x] `src/users/users.service.ts`: `models/packageModel`.
- [x] `src/users/users.service.ts`: `models/coursePackageModel`.
- [x] `src/users/users.service.ts`: `models/liveModel`.

## Task 1: Inventory And Guardrails

- [x] Add a tracking checklist to this file for every direct `require('../../...')` inside `src/**`.
- [x] Add a script or documented command for finding remaining legacy imports:
  - `Get-ChildItem -Recurse -File src | Select-String -Pattern "require\\('../../models|require\\('../../services|require\\('../../helpers|require\\('../../utils|require\\('../../middlewares|require\\('../../socket"`
- [x] Add a CI/test expectation that the count of direct legacy imports must only go down during cleanup tasks.
- [x] Do not change runtime behavior in this task.

Verification:
- [x] `npm run build`
- [x] `npm test`
- [x] `npm run email:check`

Commit:
- `docs: add legacy ts cleanup inventory`

## Task 2: Replace Legacy Model Imports With Injected Mongoose Models

Move all model access used by Nest services to `@InjectModel(...)` and registered schemas.

Targets:
- `src/commerce/commerce-access.service.ts`
- `src/commerce/order-fulfillment.service.ts`
- `src/foundation-data/foundation-data.schemas.ts`
- `src/foundation-data/foundation-data.service.ts`
- `src/learning-catalog/learning-catalog.service.ts`
- `src/users/users.service.ts`

Rules:
- Use existing Nest schemas where already present.
- If a needed schema is only in legacy JS, port it into the matching Nest module schema file first.
- Keep explicit collection names.
- Avoid `mongoose.model(...)` calls inside `src/**`.
- Keep schema hooks/plugins/transforms that affect behavior, especially image URL transforms, i18n, notification hooks, review hooks, and progress hooks.

Delete only when safe:
- Delete individual legacy model files only after no retained JS service/helper still imports them.
- Otherwise leave the file for a later task and mark it as still retained.

Verification:
- [x] model injection unit tests for affected services.
- [x] existing smoke suite.
- [x] no `require('../../models` remains inside `src/**`.
- [x] `npm run build`
- [x] `npm test`
- [x] `npm run email:check`

Commit:
- `refactor: replace legacy model imports with nest models`

## Task 3: Port Shared Utils And Helpers Into `src/common`

Move reusable utility behavior into typed Nest/common services or pure TS helpers.

Targets:
- `utils/generatePdf.js`
- `utils/sendEmail.js`
- `utils/pushNotification.js`
- `utils/filterOffensiveWords.js`
- `utils/apiFeatures.js`
- `utils/generateCertificate.js`
- `utils/generateInvoicePdf.js`
- `helpers/generalHelper.js`
- `helpers/marketingHelper.js`
- course/package/coursePackage/exam helper files

Rules:
- Put framework-independent helpers under `src/common/utils`.
- Put injectable side-effect helpers under `src/common/services`.
- Keep existing output paths, filenames, PDF layouts, email payloads, image URL behavior, and push notification payloads.
- Replace imports in commerce, community, foundation, marketing, and users services.

Delete only when safe:
- Remove legacy helper/util files after no `src/**`, retained JS service, script, or email code imports them.

Verification:
- [x] focused tests for PDF filename/output metadata where practical.
- [x] mocked email/push tests.
- [x] active Nest utility imports for `generatePdf`, `sendEmail`, `pushNotification`, `filterOffensiveWords`, and `generalHelper` removed from `src/**`.
- [x] dormant utilities such as certificate/invoice generators remain deferred because no active Nest import needed them in Task 3.
- [x] `npm run build`
- [x] `npm test`
- [x] `npm run email:check`

Commit:
- `refactor: port shared legacy utilities to typescript`

## Task 4: Replace Legacy Validator Dependencies

Remove retained validator compatibility from runtime Nest code.

Targets:
- `utils/validators/courseValidator.js`
- `middlewares/validatorMiddleware.js`
- all other `utils/validators/*` and `utils/public/publicValidator.js`

Rules:
- Replace any remaining Nest usage of JS validators with DTOs, pipes, guards, or service-level checks.
- Move reusable business validation into typed services, not DTO decorators, when validation needs database access.
- Preserve known fixes from migration:
  - accessible course validation must await DB lookups.
  - no handler should send direct Express responses from shared validation.

Delete only when safe:
- Delete `middlewares/validatorMiddleware.js` after all `utils/validators/*` are deleted or no longer imported.
- Remove `express-validator` only after no retained file imports it.

Verification:
- [x] commerce course-purchase access tests for open, missing, placement-gated, progress-gated, denied, and duplicate-order cases.
- [x] no `courseValidator` import remains inside `src/**`.
- [x] root legacy validator files remain because retained JS payment provider files still import them.
- [x] `npm run build`
- [x] `npm test`
- [x] `npm run email:check`

Commit:
- `refactor: remove legacy express validators from nest runtime`

## Task 5: Port Legacy Service Helpers Still Called By Nest

Move the few legacy service functions still called by Nest into typed Nest services.

Targets:
- `services/marketing/marketingAnalyticsService.js`
- `services/couponService.js`
- `services/userService.js`
- `services/ChatServices.js`

Current Nest callers:
- auth invitation lookup.
- commerce coupon validation and coupon usage increments.
- order fulfillment purchaser/marketing side effects.
- marketing group chat creation.

Rules:
- Prefer adding methods to existing Nest services:
  - `MarketingAnalyticsService`
  - `FoundationDataService` or a dedicated `CouponRulesService`
  - `UsersService`
  - `CommunityRealtimeService`
- Keep response shapes and side effects stable.
- Do not import Express `req/res/next` patterns.

Delete only when safe:
- Delete legacy service files once no retained JS code imports them.
- Remove `express-async-handler` only after all retained service/validator files that import it are gone.

Verification:
- auth signup invitation-key tests.
- coupon checkout scope/usage tests.
- order fulfillment tests.
- marketer group chat tests.
- `npm run build`
- `npm test`
- `npm run email:check`

Commit:
- `refactor: port legacy service helpers into nest services`

## Task 6: Replace Socket Compatibility Bridge

Remove `socket/index.js` by moving notification emission fully into Nest.

Targets:
- `socket/index.js`
- `src/foundation-data/foundation-data.schemas.ts`
- `src/community-realtime/realtime.gateway.ts`

Rules:
- Use a Nest notification emitter service as the single runtime path.
- Avoid importing the gateway directly inside schemas.
- If schema post-save hooks need emission, move notification creation/emission to service methods where possible.
- Preserve events:
  - `notification`
  - `receiveMessage`
  - `errorMessage`

Delete only when safe:
- Delete `socket/index.js` after no schema/service imports it.

Verification:
- notification creation emits to online user.
- offline user path does not throw.
- realtime gateway tests still pass.
- `npm run build`
- `npm test`
- `npm run email:check`

Commit:
- `refactor: replace legacy socket bridge with nest emitter`

## Task 7: Move Cron And Scripted Runtime Code

Port retained runtime cron behavior and decide what scripts remain intentionally outside `src`.

Targets:
- `utils/cronJob/automatedTasks.js`
- any retained service code used only by that cron file.

Rules:
- Runtime cron jobs belong in Nest services using `@nestjs/schedule`.
- One-off scripts may stay under `scripts/` if they are not app runtime.
- Remove `node-cron` only after no retained runtime file imports it.

Verification:
- cron registration boot test or documented manual boot check.
- monthly marketing reset tests remain green.
- `npm run build`
- `npm test`
- `npm run email:check`

Commit:
- `refactor: move remaining cron runtime into nest schedule`

## Task 8: Delete Remaining Legacy Folders And Dependencies

After Tasks 1-7, remove legacy folders that have zero imports.

Delete candidates:
- `models/`
- `services/`
- `utils/validators/`
- unused `utils/`
- unused `helpers/`
- `middlewares/`
- `socket/`

Dependency cleanup candidates:
- `express-async-handler`
- `express-validator`
- `node-cron`
- any package only used by deleted legacy code.

Rules:
- Before deletion, run a repo-wide import search across `src/`, `test/`, `emails/`, `scripts/`, and retained config files.
- Keep static assets like `utils/iconicLogo.png` only if still used by PDF/certificate generation.
- Update `NEST_MIGRATION_TASK_FLOW.md` and `FRONT_CHANGES.md` only if behavior changes.

Verification:
- `npm run build`
- `npm test`
- `npm run email:check`
- `npm audit --omit=dev`
- staging checklist from `STAGING_SMOKE_CHECKLIST.md`
- final search must return no direct `require('../../models|../../services|../../helpers|../../utils|../../middlewares|../../socket')` inside `src/**`.

Commit:
- `chore: remove remaining legacy js runtime`

## Done Criteria

- All backend runtime code is under `src/`.
- No `src/**` file imports from root `models/`, `services/`, `helpers/`, `middlewares/`, `socket/`, or root `utils/`.
- Old Express patterns are gone from runtime code:
  - no `express-async-handler`.
  - no `express-validator`.
  - no `req/res/next` service logic except explicit webhook handlers that need raw Express response behavior.
- `npm run build`, `npm test`, and `npm run email:check` pass.
- Production audit is improved where non-breaking fixes are available; breaking dependency upgrades remain in a separate dependency-upgrade task.
- Staging smoke checklist passes before production rollout.
