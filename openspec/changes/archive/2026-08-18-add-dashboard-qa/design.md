# Design: add-dashboard-qa

## Approach
Separate Next.js routes from Estudio (e.g. `/dashboard` vs `/studio`). Table backed by PostgreSQL. Preview streams the local `final.mp4` via the Engine static/artifact endpoint.

Approve/reject writes `reviewed_at`, `reviewed_by`, `review_notes`, status `READY_FOR_REVIEW` → `APPROVED` or `REJECTED`. Publish remains a later Engine job that only picks `APPROVED`.

## Risks
- Serving local MP4s safely (no path traversal).
- Do not embed the React Flow canvas here.
