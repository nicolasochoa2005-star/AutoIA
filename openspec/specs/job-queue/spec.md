# Job queue

## Purpose

Encolar generación asíncrona con productor y worker separados, más un CRON diario, sin reintentar el pipeline completo.

## Requirements

### Requirement: Productor no procesa
The system SHALL allow enqueueing a generation job without running the pipeline in the same process.

#### Scenario: Encolar tema
- GIVEN a running Redis instance and a topic hint
- WHEN the producer enqueue command runs
- THEN a job is added to the video-generation queue
- AND the producer process exits without rendering a video

### Requirement: Worker ejecuta el pipeline
A dedicated worker process SHALL consume jobs and run the full local pipeline.

#### Scenario: Job en cola
- GIVEN an enqueued job and a running worker
- WHEN the worker picks the job
- THEN it writes outputs under a job-specific directory
- AND it records a success or failure log entry

### Requirement: Sin reintento de job completo
The queue SHALL NOT retry a failed job as a whole. Transient retries happen inside each stage; a failed job is a terminal error for that attempt.

#### Scenario: Fallo de render
- GIVEN a job whose render stage fails
- WHEN the worker records the failure
- THEN the job is not automatically re-queued for a full pipeline rerun

### Requirement: Generación diaria
The system SHALL enqueue a daily generation job on a configurable cron schedule using a configured niche topic.

#### Scenario: CRON dispara
- GIVEN a worker (or scheduler) with cron enabled
- WHEN the scheduled time arrives
- THEN one generation job is enqueued for the configured niche topic

### Requirement: Log por intento de etapa
The system SHALL record each stage attempt on the video (success or failure, optional provider and cost).

#### Scenario: TTS ok
- GIVEN TTS succeeds on first try
- WHEN the stage completes
- THEN a log row exists for stage TTS with success true
