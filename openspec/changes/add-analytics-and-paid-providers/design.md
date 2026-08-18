# Design: add-analytics-and-paid-providers

## Approach
CRON 2 worker pulls YouTube Analytics for `PUBLISHED` videos and upserts `video_metrics`. Dashboard charts read that table.

Paid providers implement existing interfaces (`TtsProvider`, visuals/compose providers). Node config selects provider. Cost logger writes `video_logs.cost_usd`. Cap checked before the HTTP call.

Fallback: 429 or insufficient funds → configured $0 provider or stage `waiting`. Never publish a partial paid failure as success.

## Risks
- Two owning roles: Engine PRs for adapters, Dashboard PRs for KPIs. Do not mix in one commit if two people work in parallel.
