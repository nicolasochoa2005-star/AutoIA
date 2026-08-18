# stage-gates Specification

## Purpose
TBD - created by archiving change add-stage-gates-and-local-refs. Update Purpose after archive.
## Requirements
### Requirement: Manifest por corrida
The system SHALL write a `manifest.json` after each successful stage listing artifact paths and stage status so a later command can resume without regenerating completed work.

#### Scenario: Resume desde render
- GIVEN a run whose script, TTS, and visuals already succeeded
- WHEN the operator resumes from render
- THEN script and TTS are not called again
- AND render uses the existing artifacts

### Requirement: Modos auto pause override
Each stage SHALL support `auto` (generate), `pause` (wait for operator approval or file), and `override` (use an operator-supplied artifact).

#### Scenario: Pause en visuales
- GIVEN visuals mode is `pause`
- WHEN script and TTS have completed
- THEN the pipeline waits before fetching stock or composing
- AND continues only after the operator confirms or drops the expected files

#### Scenario: Override de guion
- GIVEN a valid `01_script.json` supplied by the operator
- WHEN script mode is `override`
- THEN the LLM is not called
- AND downstream stages use that script

