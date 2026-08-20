# Delta for studio

## Purpose
Estudio de producción con nodos de dominio granulares, sockets tipados y cables que determinan la corrida.

## MODIFIED Requirements

### Requirement: Canvas de dominio
The system SHALL present a node canvas whose node types are limited to a closed registry of Short-production nodes (LoadImage, Prompt, Compose, Script, TTS, LoadAudio, SaveVideo). Arbitrary third-party node types SHALL be rejected.

#### Scenario: Plantilla por defecto
- GIVEN the Estudio loads
- WHEN no custom template is selected
- THEN the default graph is a cableable Short pipeline using registry nodes (Prompt, Script, TTS, LoadImage, Compose, LoadAudio, SaveVideo)
- AND the user cannot add a node type that is not in the registry

#### Scenario: Paleta de nodos
- GIVEN the Estudio canvas is visible
- WHEN the operator picks a registry node from the palette
- THEN that node is added to the graph
- AND unknown type ids are not added

## ADDED Requirements

### Requirement: Sockets tipados
The system SHALL expose named, colored sockets per node (`IMAGE`, `TEXT`, `AUDIO`, `VIDEO`, `SCRIPT`) and SHALL refuse a connection when source and target socket types differ.

#### Scenario: Cable válido
- GIVEN a LoadImage `IMAGE` output and a Compose `IMAGE` input
- WHEN the operator draws a cable between them
- THEN the edge is created

#### Scenario: Cable inválido
- GIVEN a TTS `AUDIO` output and a Compose `IMAGE` input
- WHEN the operator draws a cable between them
- THEN the edge is not created

### Requirement: Grafo como fuente de verdad
The system SHALL persist the operator graph as `workflow.json` for the run (nodes, edges, widget values) and SHALL compile it to Engine run options before Play.

#### Scenario: Persistencia
- GIVEN the operator rearranges nodes, widgets, or cables
- WHEN a new run starts
- THEN `workflow.json` in the run directory matches the canvas

#### Scenario: Compilación
- GIVEN LoadAudio is connected to SaveVideo music input and SaveVideo widgets set 1080x1920 @ 60 fps
- WHEN Play starts
- THEN the Engine run receives the background music path and those render settings

### Requirement: Play global y por nodo
The system SHALL run the compiled graph until the first waiting Engine stage, and SHALL allow regenerating Script, TTS, Visuals (Compose) or Render (SaveVideo) as the mapped stage.

#### Scenario: Play hasta compose
- GIVEN compose/visuals is in pause mode and empty
- WHEN the operator hits Play
- THEN script and TTS run
- AND execution stops waiting for a composed still unless compose images were already supplied by LoadImage nodes

### Requirement: Validación de cables
The system SHALL refuse to start SaveVideo/render when compiled audio is missing.

#### Scenario: Render sin audio
- GIVEN TTS has not produced audio and no voice AUDIO cable has a ready artifact
- WHEN the operator plays SaveVideo
- THEN render does not start
- AND the UI explains that audio is required
