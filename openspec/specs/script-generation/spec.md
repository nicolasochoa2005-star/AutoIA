# Script generation

## Purpose

Generar un guion de YouTube Short en JSON estricto a partir de un tema, con proveedores intercambiables y fallback gratuito.

## Requirements

### Requirement: Guion JSON estricto
The system SHALL produce a script object with non-empty `titulo`, `descripcion`, `etiquetas`, `guion_locucion` (Spanish narration), and `prompts_visuales` (one or more English stock-search prompts).

#### Scenario: Tema válido
- GIVEN a topic hint "curiosidades del espacio"
- WHEN script generation succeeds
- THEN the result is valid JSON matching the required fields
- AND `guion_locucion` is non-empty Spanish text

#### Scenario: JSON inválido
- GIVEN a provider response that is not valid JSON or misses required fields
- WHEN validation runs
- THEN generation fails with reason `INVALID_SCRIPT`
- AND no later pipeline stage starts from that payload

### Requirement: Evitar temas recientes en el prompt
The system SHALL include recently used titles in the generation prompt so the model is instructed not to repeat those topics or opening structures.

#### Scenario: Hay histórico
- GIVEN at least one previously recorded title
- WHEN a new script is requested
- THEN the prompt lists those titles as topics not to repeat

### Requirement: Fallback Gemini a Groq
The system SHALL try Gemini first and, if that provider exhausts retries on a transient error and a Groq key is configured, SHALL retry generation with Groq before failing.

#### Scenario: Groq configurado y Gemini agota transitorios
- GIVEN `GROQ_API_KEY` is set
- AND Gemini fails after transient retries
- WHEN generation continues
- THEN Groq is attempted before the run is marked failed

#### Scenario: Sin clave Groq
- GIVEN `GROQ_API_KEY` is missing
- WHEN Gemini fails
- THEN the system does not call Groq
- AND the run fails after Gemini retries
