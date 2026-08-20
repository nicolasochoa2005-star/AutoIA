# Design: add-short-narrative-contract

## Approach
Un flag `narrativeProfile` en la corrida. El worker **siempre** manda `autopilot`. CLI/Studio pueden elegir `directed`. Resume lee el perfil del `manifest.json`.

`ScriptService.generate` recibe el perfil: dos system prompts. Schema base (titulo, locución, prompts) siempre. Validador estricto (`ScriptNarrativeValidator`) **solo** si `directed`.

En dirigido, `guion_locucion` se reescribe como `hook + desarrollo + climax + cta`. Palabras: split whitespace, techo 75. Suma de `duration_s` ≤ 30 si hay beats.

`INVALID_SCRIPT` no es transitorio de HTTP; `AntiRepetitionService` reintenta el generate con instrucción de acortar/completar (mismos `ANTI_REPETITION_MAX_ATTEMPTS`).

Post-TTS: solo directed, `durationMs > 30000` → `SCRIPT_TOO_LONG`, sin trim.

## Risks
- El modelo ignora el techo; el validador manda.
- Env `NARRATIVE_PROFILE=directed` no debe afectar al worker: el processor fija `autopilot`.
