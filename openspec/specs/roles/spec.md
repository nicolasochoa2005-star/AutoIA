# Roles

## Purpose

Definir quién puede hacer qué: el sistema automatiza generación; un humano controla calidad y publicación.

## Requirements

### Requirement: Separación sistema vs operador
The system SHALL generate and render Shorts without requiring a human during automatic runs, and SHALL leave publication and quality approval to a human operator.

#### Scenario: Corrida automática
- GIVEN a daily generation job with an automatic template
- WHEN the worker completes the pipeline
- THEN a local video file exists
- AND the video is not uploaded to YouTube

#### Scenario: QA humano obligatorio
- GIVEN a rendered video
- WHEN no human has approved it
- THEN the system MUST NOT treat it as published

#### Scenario: Aprobación en Dashboard
- GIVEN a video in `READY_FOR_REVIEW`
- WHEN a human approves it in the Dashboard
- THEN the video becomes eligible for publish
- AND automatic CRON generation still does not upload

### Requirement: Un change un rol
The project SHALL assign each OpenSpec change to a single owning role (Engine, Studio, Dashboard, or Producto) so two workstreams do not edit the same behavior in one PR.

#### Scenario: Change de Estudio
- GIVEN an active change owned by Studio
- WHEN an agent implements it
- THEN pipeline queue behavior remains unchanged unless a separate Engine change exists
