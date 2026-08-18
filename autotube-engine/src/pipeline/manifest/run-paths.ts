import * as path from 'path';

/**
 * Layout estable del contrato de artefactos (ver design.md de
 * add-stage-gates-and-local-refs) — el Estudio (Fase 3) va a consumir esta
 * misma estructura, así que no se renombra livianamente.
 */
export function runPaths(runDir: string) {
  return {
    manifest: path.join(runDir, 'manifest.json'),
    script: path.join(runDir, '01_script.json'),
    audioDir: path.join(runDir, '02_audio'),
    audio: path.join(runDir, '02_audio', 'voice.mp3'),
    subtitles: path.join(runDir, '02_audio', 'subtitles.ass'),
    visualsDir: path.join(runDir, '03_visuals'),
    renderDir: path.join(runDir, '04_render'),
    render: path.join(runDir, '04_render', 'final.mp4'),
  };
}
