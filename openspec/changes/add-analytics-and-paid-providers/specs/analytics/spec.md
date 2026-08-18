# Delta for analytics

## Purpose
Medir videos publicados y el gasto de proveedores.

## ADDED Requirements

### Requirement: Métricas periódicas
The system SHALL fetch YouTube Analytics for published videos on a configurable interval (target every 6 hours) and store views, likes, comments, and retention when the API provides them.

#### Scenario: Video publicado
- GIVEN a video with a YouTube id
- WHEN the analytics job runs
- THEN a metrics snapshot is stored with a fetch timestamp

### Requirement: Tope y estimación de costo
Before calling a paid provider, the system SHALL show or record an estimated cost and SHALL skip the paid call when the run or daily cap would be exceeded.

#### Scenario: Cap alcanzado
- GIVEN the daily paid cap is already reached
- WHEN a node configured with a paid provider would run
- THEN the paid API is not called
- AND the node falls back to the $0 provider or waiting, according to its config
