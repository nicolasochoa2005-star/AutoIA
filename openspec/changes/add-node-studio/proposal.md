# Change: add-node-studio

## Rol dueño
Studio

## Why
El operador necesita ver y controlar el pipeline de forma gráfica (nodos), no solo CLI. El Dashboard de KPIs no es esa superficie.

## What Changes
- Next.js Estudio with React Flow.
- Domain nodes only: Topic, Script, TTS, Character, Outfit, Pexels, Compose, Ken Burns, Render, Preview.
- Play all (until first `waiting`) and Play one node.
- Dropzone on waiting nodes.
- Provider dropdown shown but only $0 providers wired in this change.
- Validate cables: render cannot run without audio and at least one visual.

## Non-goals
- Generic n8n/ComfyUI.
- YouTube publish node execution (may exist as disabled).
- KPI charts.
- Paid providers.

## Impact
- New frontend app. Calls Engine APIs / artifact folders from `add-stage-gates-and-local-refs`.
- Templates stored via `add-postgres-video-lifecycle` when that change is archived; until then, local JSON templates are acceptable.

## Blocked-by / Blocks
- Blocked-by: `add-stage-gates-and-local-refs` (artifact contract).
- Soft blocked-by: `add-postgres-video-lifecycle` for saving templates.
- Blocks: none for publish.

## Capabilities
- studio (new)
