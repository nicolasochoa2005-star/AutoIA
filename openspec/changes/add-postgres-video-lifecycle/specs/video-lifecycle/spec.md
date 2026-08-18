# Delta for video-lifecycle

## Purpose
Persistir cada corrida como un video con estado, logs y assets auditables.

## ADDED Requirements

### Requirement: Registro de video por corrida
The system SHALL create a durable video record when a generation job is enqueued, including title/script when known and a status.

#### Scenario: Job encolado
- GIVEN a topic hint enqueued
- WHEN the producer succeeds
- THEN a video record exists with status `QUEUED`

### Requirement: Estados visibles
The system SHALL update the video status through generation stages and SHALL set `WAITING_FOR_INPUT` when a stage is paused, `READY_FOR_REVIEW` when render succeeds without publish, and `ERROR` with `error_reason` when a stage fails terminally.

#### Scenario: Render OK
- GIVEN all stages succeed
- WHEN the worker finishes
- THEN status is `READY_FOR_REVIEW`
- AND no YouTube id is required

#### Scenario: Pexels vacío
- GIVEN visuals fail with `NO_VISUAL_MATCH`
- WHEN the worker records the failure
- THEN status is `ERROR` and `error_reason` is `NO_VISUAL_MATCH`
