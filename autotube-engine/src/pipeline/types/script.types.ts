export interface VisualBeat {
  prompt: string;
  subject_id?: string;
  outfit_id?: string;
  source_hint?: 'character' | 'stock';
  duration_s?: number;
  action?: string;
  camera?: string;
  continuity?: string;
  environment?: string;
}

export interface GeneratedScript {
  titulo: string;
  descripcion: string;
  etiquetas: string[];
  guion_locucion: string;
  prompts_visuales: string[];
  hook?: string;
  desarrollo?: string;
  climax?: string;
  cta?: string;
  /** Opcional: presente cuando la corrida tiene un character bible conectado (sección 3.3.2). */
  beats_visuales?: VisualBeat[];
}

export interface WordTimestamp {
  word: string;
  startMs: number;
  endMs: number;
}

export interface SynthesizedAudio {
  audioPath: string;
  subtitlesAssPath: string;
  words: WordTimestamp[];
  durationMs: number;
}

export interface VisualClip {
  source: 'pexels' | 'pixabay' | 'local' | 'fal';
  /** 'still' requiere conversión Ken Burns antes de concatenar (ver render.service). */
  kind: 'video' | 'still';
  sourceAssetId: string;
  licenseType: string;
  licenseUrl?: string;
  localPath: string;
}

export interface RenderedVideo {
  videoPath: string;
  durationMs: number;
}

export interface PipelineResult {
  script: GeneratedScript;
  audio: SynthesizedAudio;
  clips: VisualClip[];
  render: RenderedVideo;
}
