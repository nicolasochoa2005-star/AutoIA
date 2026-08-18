# Change: add-stage-gates-and-local-refs

## Rol dueño
Engine

## Why
Hoy el pipeline corre lineal y ciego (Pexels + video clips). El operador no puede pausar una etapa, inyectar fotos propias ni mantener la misma cara/ropa entre planos. Eso bloquea contenido con personaje consistente y el contrato de artefactos que el Estudio va a reutilizar.

## What Changes
- Persist a per-run `manifest.json` so a run can resume from a given stage.
- Allow `auto | pause | override` per stage.
- Accept a local reference library (subjects, outfits, precomposed scenes) and a character bible injected into the script prompt.
- Add a compose wait step (operator drops the combined still) and Ken Burns conversion of stills into vertical clips.
- Optional PNG overlay compose only; no paid try-on and no ComfyUI in this change.

## Non-goals
- Node canvas UI (Studio).
- PostgreSQL.
- Paid image/video APIs.
- YouTube upload.

## Impact
- Engine CLI flags (`--interactive`, `--resume`, `--from`, `--refs`).
- Visuals and render contracts expand to stills, not only MP4 stock.
- Script prompt may include character identity.

## Blocked-by / Blocks
- Blocked-by: none (Fase 1+2 already shipped).
- Blocks: `add-node-studio` (needs the artifact contract).

## Capabilities
- stage-gates (new)
- visuals (modified)
- render (modified)
- script-generation (modified)
