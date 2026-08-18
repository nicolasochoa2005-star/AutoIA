# Design: add-stage-gates-and-local-refs

## Approach
Keep NestJS services. `PipelineService.run` becomes checkpointed: after each stage, write artifacts + `manifest.json` under `output/run_<id>/`. Resume reads the manifest and skips completed stages.

Stage mode is a struct passed from CLI (later from Studio): `{ script, tts, visuals, render }` each `auto | pause | override`. Pause blocks on a known file path or stdin confirmation. Override copies an operator-supplied file into the artifact slot.

Local library lives in `assets/library/` (gitignored binaries, tracked `characters/*.json`). Visuals becomes hybrid: for each beat, use a local file if present, else Pexels.

Compose `wait`: pair `subjectId` + `outfitId`, create `03_visuals/beat_N.expect.json`, wait until `beat_N.jpg` appears. Then Render Ken Burns (`zoompan`) those stills to 1080x1920 clips before concat.

## Artifact contract (stable for Studio)
```
output/run_<id>/
  manifest.json
  01_script.json
  02_audio/voice.mp3
  02_audio/subtitles.ass
  03_visuals/beat_N.jpg|mp4
  04_render/final.mp4
```

## Risks
- Windows FFmpeg path escaping for stills (already solved for `.ass`).
- Operator never dropping a compose file: fail with `WAITING_TIMEOUT` only if a timeout is configured; otherwise stay paused in CLI.
