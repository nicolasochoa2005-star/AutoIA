# Publishing

## Purpose

Subir Shorts a YouTube solo después de QA humano. La generación local no publica.

## Requirements

### Requirement: Publicación solo tras aprobación
The system SHALL upload a video to YouTube only when a human has approved it, and SHALL NOT upload automatically from CRON generation.

#### Scenario: CLI o worker de generación exitoso
- GIVEN a successful render
- WHEN the generation run completes
- THEN the operator is left with a local MP4
- AND no YouTube upload is performed in that run

#### Scenario: Publish de aprobado
- GIVEN a video with status approved
- WHEN the publish job runs
- THEN the MP4 and metadata are sent to YouTube Data API v3
- AND the YouTube video id is stored

#### Scenario: Rechazado
- GIVEN a rejected video
- WHEN a publish job is requested
- THEN the system MUST NOT upload
