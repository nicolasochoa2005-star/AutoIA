# TTS

## Purpose

Sintetizar locución en español y subtítulos palabra por palabra para el render.

## Requirements

### Requirement: Audio y timestamps por palabra
The system SHALL synthesize narration audio from `guion_locucion` and produce word-level timestamps used to build an `.ass` subtitle file.

#### Scenario: Locución válida
- GIVEN a non-empty Spanish narration
- WHEN TTS succeeds
- THEN an audio file exists
- AND a subtitle file exists
- AND each subtitle event corresponds to a spoken word interval

#### Scenario: Sin marcas de tiempo
- GIVEN a TTS result with no word timestamps
- WHEN synthesis finishes
- THEN the stage fails with a TTS error
- AND render MUST NOT run with empty subtitles

### Requirement: Voz por defecto en español neutro
The system SHALL use a configurable Edge-TTS voice, defaulting to `es-ES-AlvaroNeural`.

#### Scenario: Sin override
- GIVEN no custom voice is provided
- WHEN TTS runs
- THEN the default Spanish neural voice is used
