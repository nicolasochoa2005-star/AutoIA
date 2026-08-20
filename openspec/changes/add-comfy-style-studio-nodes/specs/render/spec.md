# Delta for render

## Purpose
Ensamblar el Short con resolución, fps, codecs y música de fondo tomados de la corrida, no solo de constantes.

## MODIFIED Requirements

### Requirement: Video vertical 9:16
The system SHALL render a local MP4 using the run's width, height, fps, video codec and audio codec when provided. If omitted, defaults SHALL be 1080x1920, 60 fps, libx264 and aac.

#### Scenario: Render exitoso
- GIVEN valid clips, audio, and subtitles
- WHEN render completes
- THEN an MP4 exists at the output path
- AND the file is non-empty

#### Scenario: Ajustes de la corrida
- GIVEN the run specifies width 1280, height 720, fps 25, vcodec libx264 and acodec aac
- WHEN render completes
- THEN FFmpeg is invoked with those dimensions, fps and codecs
- AND burned-in subtitles use matching PlayRes values

#### Scenario: Salida vacía
- GIVEN FFmpeg exits without a usable file
- WHEN render checks the output
- THEN the stage fails with reason `RENDER_FAILED`

### Requirement: Stills con Ken Burns
The system SHALL accept still images as visual inputs and convert them into clips at the run's width x height (Ken Burns zoom/pan) before concatenating with stock video.

#### Scenario: Beat still
- GIVEN a composed JPEG for a beat and valid audio duration
- WHEN render runs
- THEN the still is turned into a clip at the run resolution used in the final MP4

## ADDED Requirements

### Requirement: Música de fondo desde la corrida
The system SHALL mix an optional background-music file into the render when the run provides a path. If ducking fails, the existing narration-only retry still applies.

#### Scenario: Banda sonora conectada
- GIVEN a valid background music file path on the run
- WHEN render succeeds on the first attempt
- THEN the output includes ducked background music mixed with narration
