# Tasks

## 1. Studio registry and canvas
- [x] 1.1 Closed node registry, socket types/colors, default Short template
- [x] 1.2 Named colored handles, `onConnect` type check, palette, persist `workflow.json`
- [x] 1.3 Compiler workflow → CLI/RunOptions (prompt, compose images, BGM, render widgets)
- [x] 1.4 Play mapping Script/TTS/Compose/SaveVideo; keep audio-required guard on SaveVideo

## 2. Engine contract (Studio dependency)
- [x] 2.1 `RunOptions` + CLI: render settings, `--background-music`, `--compose-image`, `--prompt-override`
- [x] 2.2 `RenderService` uses run settings; ASS PlayRes matches; BGM passed from pipeline
- [x] 2.3 Materialize compose stills into `03_visuals/beat_N.jpg` before visuals fetch
