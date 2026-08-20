# Change: add-short-narrative-contract

## Rol dueño
Engine (Studio solo pasa `--narrative-profile`, sin nodos nuevos)

## Why
El pipeline libre (tema → locución 25–40 s → Pexels) tiene que seguir existiendo como default. El contrato narrativo estricto (30 s, hook/CTA, scene bible) mejora retención, pero solo cuando el operador lo pide.

## What Changes
- Perfil de corrida `autopilot | directed`. Default **autopilot** (CLI sin flag, CRON/worker).
- **Autopilot:** prompt y schema actuales. Campos `hook`/`cta` opcionales. Sin tope duro de 30 s post-TTS.
- **Dirigido:** prompt 30 s / ~75 palabras; `hook`, `desarrollo`, `climax`, `cta` obligatorios; `guion_locucion` = concatenación; beats con `duration_s` + `action` si hay `beats_visuales`; regenerar si falla el validador; TTS > 30 s falla (no recortar).
- Studio: select “Automático (libre)” vs “Dirigido (30s / hook-CTA)”.

## Non-goals
- Generar Character Reference (still maestro) ni auto-escribir la bible.
- Video GenAI por escena, música, SFX, reescritura del mp4.
- Nodos nuevos en Studio ni pantallas nuevas en Dashboard.
- Cambiar el default $0 (Edge-TTS + Pexels).
- Obligar el contrato estricto al CRON diario.

## Impact
- `RunOptions` / `RunManifest.narrativeProfile`, CLI `--narrative-profile`, env `NARRATIVE_PROFILE`.
- `GeneratedScript` / `VisualBeat` ganan campos opcionales.
- Tests de ambos perfiles.

## Blocked-by / Blocks
- Blocked-by: ninguno.
- Blocks: Character Reference + video GenAI opt-in (sobre el perfil `directed`).

## Capabilities
- script-generation (modified)

## Follow-ups (no este change)
1. Character Reference: nombre + prompt visual → still maestro.
2. Video GenAI solo en beats `character`, con cap y fallback $0.
