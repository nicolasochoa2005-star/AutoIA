# Design: add-comfy-style-studio-nodes

## Approach

Keep the Engine as a linear `script → tts → visuals → render` pipeline. Studio becomes a ComfyUI-style editor over that contract.

### Registry (Studio)

Closed `NodeDef` list in `autotube-studio/lib/nodes/`:

| Type | Inputs | Outputs | Widgets |
|---|---|---|---|
| loadImage | — | IMAGE | file picker |
| prompt | — | TEXT | textarea |
| compose | IMAGE subject, IMAGE outfit, TEXT prompt? | IMAGE | identity local/fal |
| script | TEXT prompt? | SCRIPT, TEXT narration | narrative profile |
| tts | TEXT | AUDIO | edge-tts / elevenlabs |
| loadAudio | — | AUDIO | file picker |
| saveVideo | IMAGE frame?, AUDIO voice, AUDIO music? | VIDEO | width, height, fps, duration, vcodec, acodec, prefix |

Unknown `nodeType` values are ignored by the palette and rejected by the compiler.

Socket colors: IMAGE blue, TEXT pink, AUDIO green, VIDEO light, SCRIPT orange. `onConnect` compares socket types on named React Flow handles.

Default template is the Short graph using these nodes (not the previous 7 stage boxes). Character remains a header control, not a node.

### Compiler

`compileWorkflow(nodes, edges)` → Engine flags:

- Prompt → Script: `topicHint` (falls back to header field)
- Prompt → Compose: `promptOverride` (appended to the script topic as visual direction)
- TTS widget: `--tts-provider`
- Compose widget: `--identity-provider`
- LoadImage files: copied into the run dir, passed as repeated `--compose-image`
- LoadAudio file: `--background-music`
- SaveVideo widgets: `--width --height --fps --vcodec --acodec --duration`

Engine `PipelineService` materializes compose images as `03_visuals/beat_N.jpg` before `VisualsService.fetchClips`, so existing still-detection applies. `RenderService.render` takes a settings object instead of module constants. ASS `PlayResX/Y` is rewritten to match.

### Persistence

- Canvas template in `localStorage` (structure + widgets; binary files stay in session memory until a run).
- On run create: write `workflow.json` next to `manifest.json`.

### Play mapping

| Node | Engine stage |
|---|---|
| script | script |
| tts | tts |
| compose | visuals |
| saveVideo | render |

Play-all and pause/drop behavior of stage gates is unchanged.

## Risks

- Mixing a Studio change with a minimal Engine contract. Limited to `RunOptions` / CLI / render so widgets are not fake.
- Large image data URLs must not be written to `localStorage`; only file names.
- Overlay compose of two JPEGs may fail; fallback is the subject still.
