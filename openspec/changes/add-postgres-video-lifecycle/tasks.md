# Tasks

## 1. Schema
- [ ] 1.1 Add PostgreSQL client and migrations for videos, logs, assets, templates
- [ ] 1.2 Enable pgvector and `videos.embedding`
- [ ] 1.3 Add `WAITING_FOR_INPUT` and `error_reason`

## 2. Cutover of stores
- [ ] 2.1 Implement history store on `videos.embedding`
- [ ] 2.2 Implement job/stage logs on `video_logs` (provider + cost_usd columns ready, default 0)
- [ ] 2.3 Remove JSON files as the source of truth after cutover

## 3. Processor wiring
- [ ] 3.1 Create a video row when a job is enqueued
- [ ] 3.2 Update status per stage including waiting and error
