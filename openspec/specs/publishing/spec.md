# Publishing

## Purpose

Dejar explícito el comportamiento actual: el pipeline se detiene en el archivo local. La subida a YouTube es un change futuro.

## Requirements

### Requirement: Sin publicación automática
The system SHALL NOT upload rendered videos to YouTube in the current phase.

#### Scenario: CLI o worker exitoso
- GIVEN a successful render
- WHEN the run completes
- THEN the operator is left with a local MP4
- AND no YouTube Data API upload is performed
