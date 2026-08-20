# Change: add-comfy-style-studio-nodes

## Rol dueño
Studio

## Why
El canvas actual dibuja cajas de etapa con cables decorativos. El operador necesita nodos con función propia (cargar imagen, prompt, TTS, banda sonora, guardar video) y sockets tipados, al estilo ComfyUI, sin abrir un motor genérico de terceros.

## What Changes
- Registry cerrado de nodos MVP: LoadImage, Prompt, Compose, Script, TTS, LoadAudio, SaveVideo.
- Sockets de color (`IMAGE`, `TEXT`, `AUDIO`, `VIDEO`, `SCRIPT`) y validación al conectar.
- Paleta para agregar nodos del registry; se rechaza cualquier tipo desconocido.
- El grafo es la fuente de verdad en Studio (`workflow.json`); un compilador lo traduce a `RunOptions` + CLI.
- Widgets de salida en SaveVideo: resolución, fps, codecs, prefijo.
- Contrato mínimo de Engine (dependencia): `backgroundMusicPath`, imágenes de compose y ajustes de render dejan de estar hardcodeados.

## Non-goals
- Executor DAG genérico, cache por hash o cola estilo ComfyUI.
- Plugins o tipos de nodo de terceros.
- VideoGen I2V (LTX/ComfyUI local).
- Nodos VisualsStock, KenBurns, Subtitles, AudioMixer, Character, Publish (siguientes oleadas).
- Dashboard o publicación a YouTube.
- Cambiar el default $0 (Edge-TTS + Pexels si no hay stills de compose).

## Impact
- `autotube-studio`: registry, canvas React Flow, paleta, persistencia de plantilla.
- `autotube-engine`: `RunOptions` / CLI para render, BGM y stills de compose (contrato que Studio necesita para que los widgets existan de verdad).

## Blocked-by / Blocks
- Blocked-by: `add-node-studio` (archivado; canvas y contrato de artefactos).
- Soft blocked-by: ninguno.
- Blocks: nodos de oleada 2 (VisualsStock, KenBurns, VideoGen).

## Capabilities
- studio (modified)
- render (modified)
