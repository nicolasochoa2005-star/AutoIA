# Delta for roles

## MODIFIED Requirements

### Requirement: Separación sistema vs operador
The system SHALL generate and render Shorts without requiring a human during automatic runs, and SHALL leave publication and quality approval to a human operator.

#### Scenario: Corrida automática
- GIVEN a daily generation job with an automatic template
- WHEN the worker completes the pipeline
- THEN a local video file exists
- AND the video is not uploaded to YouTube

#### Scenario: QA humano obligatorio
- GIVEN a rendered video
- WHEN no human has approved it
- THEN the system MUST NOT treat it as published

#### Scenario: Aprobación en Dashboard
- GIVEN a video in `READY_FOR_REVIEW`
- WHEN a human approves it in the Dashboard
- THEN the video becomes eligible for publish
- AND automatic CRON generation still does not upload
