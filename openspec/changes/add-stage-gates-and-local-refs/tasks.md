# Tasks

## 1. Manifest and resume
- [ ] 1.1 Define `manifest.json` schema (stages, artifact paths, modes)
- [ ] 1.2 Write manifest after each successful stage
- [ ] 1.3 CLI `--resume <dir> --from <stage>` skips completed work

## 2. Stage modes
- [ ] 2.1 Support `auto | pause | override` per stage
- [ ] 2.2 `--interactive` maps every stage to `pause`
- [ ] 2.3 Override copies operator files into artifact slots

## 3. Local refs and character
- [ ] 3.1 Load `assets/library/characters/<id>.json`
- [ ] 3.2 Inject character bible into script prompt
- [ ] 3.3 Hybrid visuals: local beat file else Pexels
- [ ] 3.4 Record local assets with source `local`

## 4. Compose and Ken Burns
- [ ] 4.1 Compose `wait` drop slot per beat (subject + outfit)
- [ ] 4.2 Convert stills to 9:16 clips via Ken Burns
- [ ] 4.3 Optional PNG overlay compose (alpha only)
