# Error handling

## Purpose

Fallar de forma explícita, con motivo, sin publicar videos incompletos y sin reintentos infinitos.

## Requirements

### Requirement: Motivo de error por etapa
When a stage fails, the system SHALL expose a machine-readable error reason (for example `INVALID_SCRIPT`, `NO_VISUAL_MATCH`, `RENDER_FAILED`, `REPETITIVE_CONTENT`).

#### Scenario: Prefijo MOTIVO
- GIVEN a stage throws `NO_VISUAL_MATCH: ...`
- WHEN the worker classifies the error
- THEN the logged reason is `NO_VISUAL_MATCH`

### Requirement: Reintentos solo transitorios
The system SHALL retry a stage only on transient failures (timeout, rate limit, 5xx), with a small bounded number of attempts and backoff.

#### Scenario: Rate limit
- GIVEN a 429 from the script provider
- WHEN retries remain
- THEN the same stage is retried after backoff

#### Scenario: Error no transitorio
- GIVEN invalid JSON from the LLM
- WHEN validation fails
- THEN the stage is not retried as a transient error

### Requirement: No publicar incompleto
The system SHALL NOT upload a video if any required stage failed or produced an empty artifact.

#### Scenario: Render fallido
- GIVEN `RENDER_FAILED`
- WHEN the run ends
- THEN no YouTube upload is attempted
