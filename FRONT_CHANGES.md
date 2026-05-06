# Frontend API Change Log

Track every frontend-impacting API change made during the NestJS migration.

Use statuses: `pending`, `frontend-needed`, `done`, or `deferred`.

## [done] Nest health endpoint

- Old API: no health endpoint existed.
- New API: `GET /api/v1/health` returns `{ "status": "success", "data": { "status": "ok", "service": "nexgen-api" } }`.
- Frontend files likely affected: none unless the frontend wants to add a health check.
- Required frontend action: none.
- Backend task/commit: Task 1 base migration.
- Notes: additive endpoint only.

