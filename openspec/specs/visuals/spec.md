# Visuals

## Purpose

Obtener clips verticales de stock para el fondo del Short, con metadatos de licencia.

## Requirements

### Requirement: Clips verticales de stock
The system SHALL fetch portrait stock video clips from Pexels using the script's visual prompts.

#### Scenario: Prompts con resultados
- GIVEN one or more English visual prompts
- WHEN visuals collection succeeds
- THEN at least one vertical clip file is stored locally

#### Scenario: Sin match
- GIVEN prompts that yield no usable portrait clip
- WHEN all prompts have been tried
- THEN the stage fails with reason `NO_VISUAL_MATCH`

### Requirement: Trazabilidad de licencia
The system SHALL record source, source asset id, and license information for every stock clip used.

#### Scenario: Clip de Pexels
- GIVEN a downloaded Pexels clip
- WHEN the clip is handed to render
- THEN it includes source `pexels`, a source asset id, and a license reference
