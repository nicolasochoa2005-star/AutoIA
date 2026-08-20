# Delta for tts

## ADDED Requirements

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
