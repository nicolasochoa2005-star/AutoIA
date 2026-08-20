# Roadmap operativo (OpenSpec)

El comportamiento **ya en producción local** vive en `openspec/specs/`.
Cada fila pendiente es un change en `openspec/changes/`. Un change = un rol dueño.

| Estado | Change | Rol dueño | Qué desbloquea |
|---|---|---|---|
| Hecho (specs vigentes) | Fase 1 CLI + Fase 2 cola/anti-repetición | Engine | Generar un Short local sin publicar |
| Hecho (specs vigentes) | `add-stage-gates-and-local-refs` | Engine | Control manual por etapa, refs, compose, Ken Burns |
| Hecho (specs vigentes) | `add-postgres-video-lifecycle` | Engine | Estados persistentes, embeddings, logs con costo |
| Hecho (specs vigentes) | `add-node-studio` | Studio | Canvas de nodos (React Flow) sobre el contrato de artefactos |
| Hecho (specs vigentes) | `add-dashboard-qa` | Dashboard | Cola, preview, aprobar/rechazar, `WAITING_FOR_INPUT` |
| Hecho (specs vigentes) | `add-youtube-publish` | Engine | Upload OAuth tras QA (`UNLISTED`) |
| Hecho (specs vigentes) | `add-analytics-and-paid-providers` | Dashboard + Engine | KPIs YouTube + adapters pagos opt-in (default $0) |
| Activo | `add-short-narrative-contract` | Engine | Perfil autopilot (default) vs directed (30 s / hook-CTA). Default $0 |
| Activo | `add-comfy-style-studio-nodes` | Studio | Nodos granulares tipo ComfyUI (sockets tipados, paleta, workflow.json) |

Orden sugerido: **contrato narrativo del Short**. Follow-ups (no activos): Character Reference still maestro; video GenAI opt-in por beat.

Cómo trabajar:

1. Producto aprueba o recorta el `proposal.md` del change.
2. El agente implementa con `/opsx-apply` **solo ese** change.
3. Al terminar: `/opsx-archive` (mergea deltas a `specs/` y mueve el change a `changes/archive/`).
