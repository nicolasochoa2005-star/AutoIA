# Anti-repetition

## Purpose

Rechazar guiones demasiado similares al histórico reciente antes de gastar TTS, visuales y render.

## Requirements

### Requirement: Filtro de similitud semántica
The system SHALL embed each new narration locally and reject it when cosine similarity against the recent history window exceeds the configured threshold (default 0.85).

#### Scenario: Guion distinto
- GIVEN recent history with unrelated topics
- WHEN a new distinct narration is generated
- THEN the script is accepted and the pipeline continues

#### Scenario: Guion repetitivo
- GIVEN a new narration whose similarity exceeds the threshold
- WHEN attempts remain
- THEN the system asks the LLM to differentiate and generates again

### Requirement: Tope de regeneraciones
If the script remains over the threshold after the configured maximum attempts (default 3), the system SHALL fail the run with reason `REPETITIVE_CONTENT` instead of looping forever.

#### Scenario: Tres intentos fallidos
- GIVEN three generations all above the similarity threshold
- WHEN the last attempt is rejected
- THEN the pipeline stops with `REPETITIVE_CONTENT`
- AND TTS is not invoked

### Requirement: Variar tipo de gancho
The system SHALL detect the opening hook type of recent scripts and SHALL reject a new script that repeats a hook type used in the last few recorded items.

#### Scenario: Misma apertura pregunta
- GIVEN the last recorded scripts open as questions
- WHEN a new script also opens as a question
- THEN the script is rejected and regeneration is requested with an instruction to change the hook

### Requirement: Histórico durable
The system SHALL load the anti-repetition history window from the durable video store (not from a JSON file as source of truth).

#### Scenario: Ventana de 20
- GIVEN twenty previously accepted scripts stored as videos
- WHEN a new script is checked
- THEN similarity is computed against that stored window
