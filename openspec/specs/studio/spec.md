# studio Specification

## Purpose
TBD - created by archiving change add-node-studio. Update Purpose after archive.
## Requirements
### Requirement: Canvas de dominio
The system SHALL present a node canvas whose node types are limited to the Short pipeline (script, TTS, character, stock visuals, compose, render, preview).

#### Scenario: Plantilla por defecto
- GIVEN the Estudio loads
- WHEN no custom template is selected
- THEN the default graph is the linear pipeline used by the CLI
- AND the user cannot add an arbitrary third-party node type

### Requirement: Play global y por nodo
The system SHALL run the whole graph until the first waiting node, and SHALL allow running a single node to regenerate that stage.

#### Scenario: Play hasta compose
- GIVEN compose is in pause mode and empty
- WHEN the operator hits Play
- THEN script and TTS run
- AND execution stops at compose waiting for a dropped file

### Requirement: Validación de cables
The system SHALL refuse to start render when audio or at least one visual artifact is missing.

#### Scenario: Render sin audio
- GIVEN TTS has not produced audio
- WHEN the operator plays Render
- THEN render does not start
- AND the UI explains that audio is required

