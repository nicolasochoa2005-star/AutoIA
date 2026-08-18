# Render

## Purpose

Ensamblar un Short vertical 9:16 con locución, subtítulos y clips de fondo, sin publicar.

## Requirements

### Requirement: Video vertical 9:16
The system SHALL render a local MP4 at 1080x1920 with burned-in subtitles and the synthesized narration.

#### Scenario: Render exitoso
- GIVEN valid clips, audio, and subtitles
- WHEN render completes
- THEN an MP4 exists at the output path
- AND the file is non-empty

#### Scenario: Salida vacía
- GIVEN FFmpeg exits without a usable file
- WHEN render checks the output
- THEN the stage fails with reason `RENDER_FAILED`

### Requirement: Fallback sin música de fondo
If background-music ducking fails, the system SHALL retry the same render without background music before failing the run.

#### Scenario: Ducking incompatible
- GIVEN a background music path that makes the ducking filter fail
- WHEN the first render attempt fails
- THEN a second attempt runs with narration only
- AND a successful second attempt is treated as a completed render
