# Change: add-postgres-video-lifecycle

## Rol dueño
Engine

## Why
History and job logs live in JSON files. That cannot support Dashboard states, pgvector anti-repetition, cost logs, or `WAITING_FOR_INPUT`. Studio and Dashboard need a durable video record.

## What Changes
- Persist videos, logs, assets, and workflow template ids in PostgreSQL.
- Store script embeddings in a vector column for anti-repetition.
- Expose statuses: `QUEUED`, generation stages, `WAITING_FOR_INPUT`, `READY_FOR_REVIEW`, `ERROR`.
- Keep file-based stores only as a migration fallback until cutover.

## Non-goals
- React UI.
- YouTube upload or analytics APIs.
- Paid provider billing.

## Impact
- New DB schema (see FuncionalDoc §6, including `workflow_templates`, `provider`, `cost_usd`).
- Anti-repetition history store implementation swaps to Postgres.
- Job processor writes `video_logs`.

## Blocked-by / Blocks
- Blocked-by: none strictly; better after `add-stage-gates-and-local-refs` so `WAITING_FOR_INPUT` is real.
- Blocks: `add-dashboard-qa`, `add-node-studio` persistence of graphs.

## Capabilities
- video-lifecycle (new)
- anti-repetition (modified)
- job-queue (modified)
