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

### Requirement: Proveedor TTS intercambiable
The system SHALL keep Edge-TTS as the default provider and MAY use a paid TTS provider that returns the same audio-plus-word-timestamps contract.

#### Scenario: Default $0
- GIVEN a new template with no provider override
- WHEN TTS runs
- THEN Edge-TTS is used

#### Scenario: Paid sin timestamps
- GIVEN a paid TTS result without word timestamps
- WHEN the stage validates output
- THEN the stage fails instead of burning unsynced subtitles
