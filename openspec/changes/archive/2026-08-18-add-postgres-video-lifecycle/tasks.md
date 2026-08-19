# Tasks

## 1. Schema
- [x] 1.1 Add PostgreSQL client and migrations for videos, logs, assets, templates
- [x] 1.2 Enable pgvector and `videos.embedding`
- [x] 1.3 Add `WAITING_FOR_INPUT` and `error_reason`

## 2. Cutover of stores
- [x] 2.1 Implement history store on `videos.embedding`
- [x] 2.2 Implement job/stage logs on `video_logs` (provider + cost_usd columns ready, default 0)
- [x] 2.3 Remove JSON files as the source of truth after cutover

## 3. Processor wiring
- [x] 3.1 Create a video row when a job is enqueued
- [x] 3.2 Update status per stage including waiting and error
