# Roadmap operativo (OpenSpec)

El comportamiento **ya en producción local** vive en `openspec/specs/`.
Cada fila pendiente es un change en `openspec/changes/`. Un change = un rol dueño.

| Estado | Change | Rol dueño | Qué desbloquea |
|---|---|---|---|
| Hecho (specs vigentes) | Fase 1 CLI + Fase 2 cola/anti-repetición | Engine | Generar un Short local sin publicar |
| Hecho (specs vigentes) | `add-stage-gates-and-local-refs` | Engine | Control manual por etapa, refs, compose, Ken Burns |
| Activo | `add-postgres-video-lifecycle` | Engine | Estados persistentes, embeddings, logs con costo |
| Activo | `add-node-studio` | Studio | Canvas de nodos (React Flow) sobre el contrato de artefactos |
| Activo | `add-dashboard-qa` | Dashboard | Cola, preview, aprobar/rechazar, `WAITING_FOR_INPUT` |
| Activo | `add-youtube-publish` | Engine | Upload OAuth tras QA. Bloqueado por `add-dashboard-qa` |
| Activo | `add-analytics-and-paid-providers` | Dashboard + Engine | KPIs YouTube + adapters pagos opt-in. Bloqueado por publish |

Orden sugerido: **stage-gates → postgres → studio y dashboard en paralelo → publish → analytics/pagos**.

Cómo trabajar:

1. Producto aprueba o recorta el `proposal.md` del change.
2. El agente implementa con `/opsx-apply` **solo ese** change.
3. Al terminar: `/opsx-archive` (mergea deltas a `specs/` y mueve el change a `changes/archive/`).
