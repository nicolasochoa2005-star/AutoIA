# Delta for script-generation

## ADDED Requirements

### Requirement: Perfil autopilot o dirigido
The system SHALL default script generation to profile `autopilot` (current free-form short). Profile `directed` MAY be selected per run. Queue workers SHALL use `autopilot`.

#### Scenario: Default sin flag
- GIVEN a CLI or worker run with no narrative profile override
- WHEN script generation runs
- THEN the autopilot prompt and schema are used
- AND missing `cta` does not fail validation

### Requirement: Duración máxima de locución (directed)
When the run profile is `directed`, the system SHALL generate narration intended for at most 30 seconds (~75 words). A script whose word count exceeds the cap SHALL be rejected as `INVALID_SCRIPT` and MUST NOT proceed to TTS.

#### Scenario: Locución demasiado larga
- GIVEN profile `directed`
- AND an LLM JSON whose concatenated narration has more than 75 words
- WHEN script validation runs
- THEN the result is rejected with `INVALID_SCRIPT`
- AND TTS is not called for that attempt

#### Scenario: Autopilot largo
- GIVEN profile `autopilot`
- AND narration longer than 75 words
- WHEN validation runs
- THEN the script MAY be accepted
- AND TTS still runs

### Requirement: Estructura hook-desarrollo-climax-CTA (directed)
When the run profile is `directed`, the system SHALL require non-empty `hook`, `desarrollo`, `climax`, and `cta`. `guion_locucion` SHALL be the concatenation of those fields for TTS.

#### Scenario: Falta CTA en directed
- GIVEN profile `directed` and JSON missing `cta`
- WHEN validation runs
- THEN generation fails or retries
- AND render MUST NOT start

#### Scenario: Concatenación
- GIVEN profile `directed` and valid four blocks
- WHEN the script is accepted
- THEN `guion_locucion` equals those parts joined for speech

### Requirement: Scene bible mínima en beats (directed)
When profile is `directed` and `beats_visuales` is present, each beat SHALL include `duration_s` (positive) and `action`. The sum of `duration_s` SHALL be ≤ 30.

#### Scenario: Suma de escenas excedida
- GIVEN profile `directed` and beats whose `duration_s` sum to more than 30
- WHEN validation runs
- THEN the script is rejected with `INVALID_SCRIPT`

### Requirement: Tope post-TTS (directed)
When profile is `directed` and synthesized audio duration exceeds 30 seconds, the TTS stage SHALL fail. The system MUST NOT trim audio and MUST NOT render that attempt.

#### Scenario: Audio de 34 s en directed
- GIVEN profile `directed` and TTS `durationMs` greater than 30000
- WHEN the TTS stage finishes
- THEN the stage fails
- AND render is not started
