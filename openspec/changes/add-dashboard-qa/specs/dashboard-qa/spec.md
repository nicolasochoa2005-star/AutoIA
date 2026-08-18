# Delta for dashboard-qa

## Purpose
Cola lineal para revisar, aprobar o rechazar Shorts generados.

## ADDED Requirements

### Requirement: Tabla de videos
The system SHALL list generated videos with their status, including `WAITING_FOR_INPUT`, `READY_FOR_REVIEW`, `ERROR`, `REJECTED`, and later published states.

#### Scenario: Filtro error
- GIVEN at least one video in `ERROR`
- WHEN the operator filters by ERROR
- THEN only those rows are shown
- AND `error_reason` is visible

### Requirement: Aprobar o rechazar
The system SHALL allow an operator to approve or reject a video in `READY_FOR_REVIEW`, recording reviewer, timestamp, and notes.

#### Scenario: Aprobación
- GIVEN a video in `READY_FOR_REVIEW`
- WHEN the operator approves it
- THEN the video is marked approved
- AND it is eligible for a later publish job
- AND it is not uploaded in this change

#### Scenario: Rechazo
- GIVEN a video in `READY_FOR_REVIEW`
- WHEN the operator rejects it with notes
- THEN status is `REJECTED`
- AND publish MUST NOT pick it up
