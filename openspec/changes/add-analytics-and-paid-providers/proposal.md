# Change: add-analytics-and-paid-providers

## Rol dueño
Dashboard (KPIs) + Engine (provider adapters). Split implementation PRs by folder if both move at once.

## Why
Después de publicar, hace falta medir. Los adapters pagos (ElevenLabs, Fal/Replicate) mejoran voz e identidad, pero solo opt-in, con tope y fallback $0.

## What Changes
- YouTube Analytics every 6h into `video_metrics`.
- Dashboard KPIs: views, retention, estimated revenue, API quota, spend per provider.
- Wire paid adapters behind existing contracts: TTS ElevenLabs, identity visuals Fal/Replicate/Kling. Default remains $0.
- Per-node cost estimate, daily/run cap, fallback to $0 or `waiting` on 429/no funds.

## Non-goals
- Replacing FFmpeg with Creatomate.
- Enabling GenAI on every beat by default.
- Building new node types beyond provider dropdowns.

## Impact
- New Analytics worker (CRON 2).
- New provider classes; graph JSON already has `provider` field from Studio.

## Blocked-by / Blocks
- Blocked-by: `add-youtube-publish` (analytics need published videos); Studio/Dashboard for the switches.
- Blocks: none.

## Capabilities
- analytics (new)
- tts (modified)
- visuals (modified)
