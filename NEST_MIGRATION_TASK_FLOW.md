# NestJS + TypeScript Migration Task Flow

This file is the working task flow for migrating the current Express/Mongoose backend to NestJS + TypeScript in place.

The migration should be done as a sequence of small, reviewable tasks. For every task, Codex must first read the old implementation, then build the new Nest implementation, write smoke tests, verify TypeScript/build health, review the diff, and commit.

## Global Rules For Every Migration Task

1. Read the old implementation first.
   - Inspect the current route file, service file, model file, validator file, middleware usage, helpers, and any frontend-impacting response shape.
   - Identify dependencies on auth, uploads, payments, Socket.IO, cron, i18n, Mongoose hooks, localization, and shared helpers.
   - Do not assume behavior from file names. Verify the actual implementation.

2. Make the new Nest implementation.
   - Controllers own HTTP concerns.
   - Services own business logic.
   - DTOs own request validation.
   - Guards/decorators own auth and roles.
   - Interceptors own uploads and response shaping where needed.
   - Exception filters own error formatting and logging.
   - Keep Mongo collection names and stored document shapes unless a task explicitly says otherwise.

3. Write smoke tests.
   - Add at least one success test.
   - Add one validation failure test when the endpoint accepts input.
   - Add one authorization failure test when the endpoint is protected.
   - Payment/webhook modules must include raw-body and duplicate-event tests.
   - Socket.IO modules must include gateway tests or a documented manual test script.

4. Verify TypeScript and runtime health.
   - Run the TypeScript build/check introduced by the base migration.
   - Run the smoke tests for the migrated module.
   - Run any existing relevant checks, including `npm run email:check` when email code is touched.
   - Do not leave type errors for later tasks.

5. Review all changes.
   - Run `git diff --stat`.
   - Read the changed files.
   - Check for copied Express `req/res` logic in services.
   - Check for hardcoded IDs, skipped awaits, direct 500 responses, and unlogged errors.
   - Update `FRONT_CHANGES.md` for every frontend-impacting API change.

6. Commit.
   - Commit only after tests/type checks pass or after clearly documenting why a check cannot run.
   - Use a focused commit message, for example `migrate contact modules to nest`.
   - Prefer one commit per module/task group.

## Required Files To Create Early

- `src/main.ts`: Nest bootstrap.
- `src/app.module.ts`: root module wiring.
- `src/common/`: shared filters, interceptors, decorators, guards, DTO helpers, pagination, upload helpers, token/email helpers.
- `src/database/`: Mongoose connection and shared schema/plugin setup.
- `src/config/`: environment configuration and validation.
- `FRONT_CHANGES.md`: frontend-impacting API changes.
- `test/` or `src/**/*.spec.ts`: smoke test setup.

## FRONT_CHANGES.md Format

Every entry must use this format:

```md
## [Status] Endpoint or Feature

- Old API:
- New API:
- Frontend files likely affected:
- Required frontend action:
- Backend task/commit:
- Notes:
```

Use statuses: `pending`, `frontend-needed`, `done`, or `deferred`.

## Task 1: Big Base Migration

Goal: create the Nest foundation before moving feature modules.

Flow:
1. Read old base implementation:
   - `server.js`
   - `config/database.js`
   - `config/swagger.js`
   - `middlewares/errorMiddleware.js`
   - `middlewares/localeMiddleware.js`
   - `middlewares/uploadImageMiddleware.js`
   - `middlewares/validatorMiddleware.js`
   - `utils/apiError.js`
   - `utils/apiFeatures.js`
   - `utils/errorLogs.js`
   - `utils/generateToken.js`
   - `utils/sendEmail.js`
   - `utils/pushNotification.js`
   - `socket/index.js`
   - `utils/cronJob/automatedTasks.js`
2. Add Nest dependencies and scripts.
3. Create Nest bootstrap, root module, config module, database module, Swagger setup, global validation pipe, global exception filter, response interceptor, CORS, compression, static uploads, raw body handling, and logger.
4. Port shared helpers into Nest-friendly services.
5. Add `FRONT_CHANGES.md`.
6. Add smoke test setup.
7. Fix base blockers:
   - `services/courseService.js`: remove hardcoded certificate user id and use authenticated user.
   - `utils/validators/courseValidator.js`: await course lookup in accessible course validation.
   - `services/handllerFactory.js`: route errors through global handling instead of direct 500 responses.
   - `routes/index.js`: remove duplicate route mounts during migration.
   - Patch non-breaking dependency vulnerabilities.
8. Verify:
   - Nest app boots.
   - Mongo connection config loads.
   - Swagger loads.
   - Static uploads path still works.
   - Raw body is available for webhook paths.
   - Smoke tests pass.
   - TypeScript build passes.
9. Review diff and commit.

## Task 2: Foundation Data Modules

Migrate low-risk data modules first. Keep public route paths and Mongo collection names stable. Do not remove old route/service/model files yet; legacy cleanup waits until Task 9.

Order:
1. Contact info and contact us.
2. System reviews.
3. Reviews.
4. Wishlist.
5. Categories.
6. Articles.
7. Coupons.
8. Events.
9. Notifications.

Shared Task 2 checklist:
- [ ] Add `FoundationDataModule` and import it from `AppModule`.
- [ ] Add temporary legacy auth wrappers: `LegacyAuthGuard`, `OptionalLegacyAuthGuard`, `RolesGuard`, `@Roles()`, and `@CurrentUser()`.
- [ ] Add `ParseObjectIdPipe`, reusable localized-string DTOs, shared pagination/query behavior, and shared Sharp upload helpers.
- [ ] Register explicit collection names: `contacts`, `contactus`, `systemreviews`, `reviews`, `categories`, `articals`, `coupons`, `events`, and `notifications`.
- [ ] Ensure migrated Nest routes are registered before legacy routes.
- [ ] Make migrated legacy model files reuse existing Mongoose models to avoid model overwrite conflicts while the legacy adapter still exists.

Per-module checklist:
- [ ] Read old route/service/model/validator.
- [ ] Confirm route paths, auth rules, response shape, and collection name.
- [ ] Add Nest schema with explicit collection name.
- [ ] Add DTOs and validation.
- [ ] Add service logic without Express `req`/`res`.
- [ ] Add controller routes with guards/interceptors.
- [ ] Add smoke tests.
- [ ] Run `npm run build`, `npm test`, and `npm run email:check`.
- [ ] Update `FRONT_CHANGES.md` if API behavior changes.
- [ ] Review diff and commit.

Module-specific notes:
- [ ] Contact info: preserve public create and admin-only list/get/delete.
- [ ] Contact us: preserve public create and admin-only list.
- [ ] System reviews: preserve public list/detail, protected create/update/delete, admin replay, and `myReviews`.
- [ ] Reviews: preserve nested course review behavior, `myReview`, ownership checks, duplicate-review checks, and course rating recalculation hooks.
- [ ] Wishlist: preserve protected user/admin add/remove/list.
- [ ] Categories: preserve i18n fields, image upload, Sharp webp conversion, image URL transform, and active course count.
- [ ] Articals: preserve misspelled `/api/v1/articals` path, image uploads, status filtering, instructor filtering, slug generation, and image URL transform.
- [ ] Coupons: preserve optional auth coupon details, marketer/admin/instructor permission checks, and active/expired/rejected behavior.
- [ ] Events: preserve i18n fields, image upload, Sharp webp conversion, and image URL transform.
- [ ] Notifications: preserve user-filtered list, read/read-all, unread count, admin system sends, admin push-only sends, socket/push side effects, and make `/unreadCount` resolve before `/:id`.

## Task 3: User And Auth Core

Migrate auth and user after foundation modules because most later modules depend on user identity.

Checklist:
- [x] Read old auth/user routes, services, validators, model, uploads, and dependency side effects:
  - `routes/authRoute.js`
  - `routes/userRoute.js`
  - `services/authServices.js`
  - `services/userService.js`
  - `models/userModel.js`
  - `utils/validators/authValidator.js`
  - `utils/validators/userValidator.js`
- [x] Confirm migrated vs deferred endpoints.
- [x] Add Nest `AuthModule` and `UserModule` with explicit `users` collection registration.
- [x] Add DTOs and validation for signup, login, email verification, password reset, admin issue-token, and core user mutations.
- [x] Add service logic without Express `req/res` for migrated endpoints.
- [x] Add controller routes with guards/interceptors.
- [x] Replace Task 2 temporary legacy auth wrappers with real JWT guards.
- [x] Preserve upload/image behavior and sensitive-field stripping.
- [x] Add smoke tests for auth/user migration behavior.
- [x] Run build/tests/email check.
- [x] Update `FRONT_CHANGES.md` if API behavior changes.
- [x] Review diff and commit.

Migrated in this task:
- Auth routes: Google OAuth start/callback, signup, login, forgot/reset password, email verification, resend email code, `getMe`, admin issue-user-token, and mobile Google auth.
- Core user routes: instructor lists, admin user list/create/update/delete/get, protected user detail, activate/deactivate, change my password/data, and admin change password.

Deferred to later tasks through the legacy adapter:
- Follow/unfollow and followers/following: Task 7.
- Notification bell, FCM token, and push preferences: Task 7 or notifications follow-up.
- Email marketing query, user move ownership, and instructor belongings: Task 6.
- ID document AI verification/upload/action: Task 8.
- Course/order purchaser reports and `users/:id/userData`: Task 4/5.

## Task 4: Learning Catalog Modules

Migrate the product/course graph before orders and subscriptions.

Order:
1. Packages.
2. Course packages.
3. Courses.
4. Sections.
5. Lessons.
6. Exams.
7. Analytics.

Per-module checklist:
- [ ] Read old route, service, model, validator, helper imports, and related nested routes.
- [ ] Confirm route paths, auth rules, response shape, collection name, upload folders, and model hooks.
- [ ] Add Nest schema registration with explicit collection name.
- [ ] Add DTOs and validation.
- [ ] Add service logic without Express `req/res`.
- [ ] Add controller routes with guards/interceptors.
- [ ] Preserve i18n localized fields and image/file URL transforms.
- [ ] Move reorder behavior into the shared Nest catalog reorder service where applicable.
- [ ] Fix hardcoded user/course IDs found during migration.
- [ ] Add smoke tests for list/detail/create/update/access checks where applicable.
- [ ] Update `FRONT_CHANGES.md` only for frontend-impacting behavior changes.
- [ ] Run tests, TypeScript build, email check, review diff, and commit.

Progress:
- [x] Packages.
- [x] Course packages.
- [x] Courses.
- [x] Sections.
- [x] Lessons.
- [x] Exams.
- [x] Analytics.

## Task 5: Commerce And Subscriptions

Migrate payment-sensitive code after catalog and auth are stable.

Order:
1. User subscriptions.
2. Orders core.
3. Stripe.
4. Plisio.
5. Lahza.
6. Cryptomus.
7. PayPal if still used.
8. Marketing invoice dependencies used by orders.

Flow:
1. Read old order routes, order services, payment provider services, validators, models, and webhook behavior.
2. Create isolated payment provider services behind a common interface.
3. Ensure raw body support before moving Stripe.
4. Add idempotency checks where missing.
5. Add smoke tests for order creation, free order, paid webhook success, duplicate webhook, failed payment, and subscription creation.
6. Update `FRONT_CHANGES.md` for checkout/payment response changes.
7. Run tests, TypeScript build, review diff, and commit.

## Task 6: Marketing And Revenue

Migrate marketing after orders because it depends heavily on sales and order data.

Order:
1. Marketing analytics.
2. Marketing core.
3. Instructor profits.
4. Marketing invoices.
5. Marketer rating.
6. Leaderboard.

Flow:
1. Read old marketing routes, services, models, validators, cron dependencies, and order dependencies.
2. Convert monthly reset cron logic to `@nestjs/schedule`.
3. Preserve current commission and profit calculations unless tests support refactoring.
4. Add tests for invitation tracking, invoice generation, profit reset, and analytics totals.
5. Update `FRONT_CHANGES.md` for API cleanup.
6. Run tests, TypeScript build, review diff, and commit.

## Task 7: Community, Chat, And Realtime

Migrate social and realtime features after auth/user and notifications are stable.

Order:
1. Posts.
2. Comments.
3. Reactions.
4. Chats.
5. Messages.
6. Live.
7. Socket.IO gateway.

Flow:
1. Read old route, service, model, validator, notification, and socket behavior.
2. Convert Socket.IO `initSocket` into a Nest gateway.
3. Preserve events: `addUser`, `joinRoom`, `leaveRoom`, `sendMessage`, `receiveMessage`, `notification`, and `errorMessage`.
4. Move in-memory user socket tracking into a gateway service.
5. Preserve time-spent updates on disconnect.
6. Add tests for post/comment CRUD and gateway events where practical. If gateway tests are not practical, add a documented manual test script.
7. Update `FRONT_CHANGES.md` for API cleanup.
8. Run tests, TypeScript build, review diff, and commit.

## Task 8: AI And Knowledge Features

Migrate AI last because it depends on catalog, orders, subscriptions, and user data.

Order:
1. AI chat.
2. AI knowledge.
3. Knowledge sync logs.
4. Vector/file sync jobs.

Flow:
1. Read old AI routes, services, models, OpenAI usage, subscription checks, and knowledge sync behavior.
2. Create an isolated AI module with OpenAI config and provider services.
3. Ensure migrated catalog/order/subscription services are used for access checks.
4. Add smoke tests for protected chat creation, knowledge upload/sync request, and failure logging.
5. Update `FRONT_CHANGES.md` for API cleanup.
6. Run tests, TypeScript build, review diff, and commit.

## Task 9: Cleanup And Cutover

Finish only after all modules are migrated and tested.

Flow:
1. Read all remaining legacy Express files and verify whether each is still used.
2. Remove legacy `routes/`, old Express middleware, `express-async-handler`, unused service wrappers, and obsolete order service variants only when behavior is covered.
3. Regenerate Swagger from Nest decorators.
4. Run dependency audit and update vulnerable packages.
5. Ensure scripts use Nest:
   - `npm run start:dev`
   - `npm start`
   - `npm run build`
   - `npm test`
6. Review `FRONT_CHANGES.md` and mark entries as `done` or `deferred`.
7. Run full smoke suite, TypeScript build, audit, and manual checks for Swagger, uploads, Socket.IO, cron boot, and webhooks.
8. Review final diff and commit.

## Definition Of Done For Each Task

- Old implementation was read and understood.
- New Nest implementation exists.
- DTOs/guards/services/controllers are separated correctly.
- Smoke tests exist and pass, or an explicit blocker is documented.
- TypeScript build/check passes.
- Frontend-impacting changes are recorded in `FRONT_CHANGES.md`.
- `git diff` was reviewed.
- A focused commit was created.
