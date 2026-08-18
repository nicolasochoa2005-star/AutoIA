# Visuals

## Purpose

Obtener clips verticales de stock para el fondo del Short, con metadatos de licencia.
## Requirements
### Requirement: Clips verticales de stock
The system SHALL fetch portrait stock video clips from Pexels using the script's visual prompts when a beat has no local file.

#### Scenario: Prompts con resultados
- GIVEN one or more English visual prompts and no local beat file
- WHEN visuals collection succeeds
- THEN at least one vertical clip file is stored locally

#### Scenario: Sin match
- GIVEN prompts that yield no usable portrait clip and no local file
- WHEN all prompts have been tried
- THEN the stage fails with reason `NO_VISUAL_MATCH`

### Requirement: Trazabilidad de licencia
The system SHALL record source, source asset id, and license information for every stock clip used.

#### Scenario: Clip de Pexels
- GIVEN a downloaded Pexels clip
- WHEN the clip is handed to render
- THEN it includes source `pexels`, a source asset id, and a license reference

### Requirement: Librería local por beat
The system SHALL use an operator-provided local image or clip for a beat when present, and MUST NOT call Pexels for that beat.

#### Scenario: Escena ya compuesta
- GIVEN `scenes/beat-02.jpg` in the reference library
- WHEN visuals runs for beat 2
- THEN the local file is used
- AND Pexels is not queried for that beat

### Requirement: Compose en espera
When a beat specifies a subject and outfit without a precomposed scene, the system SHALL wait for the operator to drop the composed still into the beat output slot.

#### Scenario: Modelo más outfit
- GIVEN subject `ana` and outfit `lab` and compose mode `wait`
- WHEN the compose slot for beat 1 is empty
- THEN the pipeline stays paused for that beat
- AND proceeds once `beat_01.jpg` exists

