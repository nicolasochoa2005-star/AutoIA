# Tasks

## 1. Perfil de corrida
- [x] 1.1 `narrativeProfile` en RunOptions, manifest y CLI `--narrative-profile`
- [x] 1.2 Worker/CRON siempre autopilot
- [x] 1.3 Select Studio Automático vs Dirigido

## 2. Schema y prompt
- [x] 2.1 Campos opcionales `hook`, `desarrollo`, `climax`, `cta` y beat `duration_s`/`action`
- [x] 2.2 Prompt dirigido 30 s / estructura; autopilot conserva 25–40 s

## 3. Validador (solo directed)
- [x] 3.1 Rechazar bloques vacíos, >75 palabras, suma `duration_s` > 30
- [x] 3.2 Regenerar; no TTS si falla
- [x] 3.3 Tras TTS, fallar si `durationMs` > 30 s (sin recortar)

## 4. Tests
- [x] 4.1 Autopilot: JSON sin `cta` es válido
- [x] 4.2 Dirigido: >75 palabras / sin `cta` / beats 31s → `INVALID_SCRIPT`
- [x] 4.3 Dirigido válido: concatenación
- [x] 4.4 Sin flag el perfil es autopilot
