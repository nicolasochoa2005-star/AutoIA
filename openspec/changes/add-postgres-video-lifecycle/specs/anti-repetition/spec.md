# Delta for anti-repetition

## ADDED Requirements

### Requirement: Histórico durable
The system SHALL load the anti-repetition history window from the durable video store (not from a JSON file as source of truth).

#### Scenario: Ventana de 20
- GIVEN twenty previously accepted scripts stored as videos
- WHEN a new script is checked
- THEN similarity is computed against that stored window
