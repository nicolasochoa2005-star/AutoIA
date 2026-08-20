# Change: add-youtube-publish

## Rol dueño
Engine

## Why
Tras QA, hay que publicar por YouTube Data API v3 con OAuth. Hoy el pipeline se detiene en el MP4 local a propósito.

## What Changes
- OAuth 2.0 + refresh token.
- Upload MP4 + metadata (title, description, tags) only for videos approved in Dashboard.
- Default visibility: evaluate `UNLISTED` vs `PUBLIC` (start with `UNLISTED` for new channels unless Producto overrides).
- Quota errors (`403 quotaExceeded`) are retryable on the next daily reset, not in a tight loop.

## Non-goals
- Analytics pull (separate change).
- Changing Studio node types except enabling a Publish node that calls this Engine job.

## Impact
- MODIFIES publishing spec (today: never upload).
- Google Cloud project quotas must be checked by Producto (FuncionalDoc §7).

## Blocked-by / Blocks
- Blocked-by: `add-dashboard-qa`.
- Blocks: `add-analytics-and-paid-providers`.

## Capabilities
- publishing (modified)
