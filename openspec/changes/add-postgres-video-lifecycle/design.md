# Design: add-postgres-video-lifecycle

## Approach
Add PostgreSQL via NestJS (TypeORM or Prisma — pick one in implementation and stick to it). Schema matches FuncionalDoc §6: `videos`, `video_logs`, `video_assets`, `workflow_templates`. Enable `pgvector` for `videos.embedding`.

Replace `FileHistoryStore` and `JobLogStore` implementations behind existing tokens so `AntiRepetitionService` and `PipelineProcessor` do not change their call sites.

Status transitions are written by the processor: enqueue → `QUEUED`; each stage name; pause → `WAITING_FOR_INPUT`; success without publish → `READY_FOR_REVIEW`; failure → `ERROR` + `error_reason`.

## Risks
- Embedding dimension must match the local model (currently 384 in the spec).
- Cutover: dual-write is unnecessary if there is no production data worth keeping; migrate by empty DB is acceptable for this project stage.
