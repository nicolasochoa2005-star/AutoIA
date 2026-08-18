# Delta for job-queue

## ADDED Requirements

### Requirement: Log por intento de etapa
The system SHALL record each stage attempt on the video (success or failure, optional provider and cost).

#### Scenario: TTS ok
- GIVEN TTS succeeds on first try
- WHEN the stage completes
- THEN a log row exists for stage TTS with success true
