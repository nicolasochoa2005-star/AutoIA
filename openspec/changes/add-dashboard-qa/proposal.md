# Change: add-dashboard-qa

## Rol dueño
Dashboard

## Why
Sin una cola lineal con preview y aprobación, el Estudio no alcanza para publicar con criterio. El operador necesita ver estados, errores y el checklist de QA, también en pantallas chicas.

## What Changes
- Next.js Dashboard (not the node canvas): video table, filters by status including `ERROR` and `WAITING_FOR_INPUT`.
- Embedded local MP4 preview.
- Approve / reject with notes; approve moves toward publish-ready, reject records `REJECTED`.
- Visible QA checklist (variation, metadata, synthetic disclosure, technical sync).

## Non-goals
- Building the node editor (Studio).
- Calling YouTube upload (Engine change `add-youtube-publish`).
- KPI charts from YouTube Analytics.

## Impact
- Reads `videos` from `add-postgres-video-lifecycle`.
- Link to open a run in Studio (read-only or play-from-node) if Studio exists.

## Blocked-by / Blocks
- Blocked-by: `add-postgres-video-lifecycle`.
- Blocks: `add-youtube-publish`.

## Capabilities
- dashboard-qa (new)
- roles (modified)
