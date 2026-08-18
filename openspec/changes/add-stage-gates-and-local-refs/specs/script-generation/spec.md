# Delta for script-generation

## ADDED Requirements

### Requirement: Character bible en el prompt
When a character bible is attached to the run, the system SHALL include identity, outfit, and a do-not-switch-subject instruction in the script prompt.

#### Scenario: Personaje Ana
- GIVEN `characters/ana.json` selected for the run
- WHEN script generation runs
- THEN the prompt names Ana and forbids changing subject between beats
