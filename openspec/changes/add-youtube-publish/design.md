# Design: add-youtube-publish

## Approach
Worker job `publish` reads an `APPROVED` video, uploads via YouTube Data API v3, stores `youtube_video_id`, sets status `PUBLISHED`. Never publish `READY_FOR_REVIEW`, `REJECTED`, or `ERROR`.

Auth: installed-app OAuth refresh token in env/secret store, not in git.

Visibility default `UNLISTED` until Producto confirms `PUBLIC`.

## Risks
- Quota exhaustion; respect 3.8 retry policy.
- YouTube inauthentic content policy — QA checklist remains mandatory.
