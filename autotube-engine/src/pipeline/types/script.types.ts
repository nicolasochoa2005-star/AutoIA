export interface GeneratedScript {
  titulo: string;
  descripcion: string;
  etiquetas: string[];
  guion_locucion: string;
  prompts_visuales: string[];
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
  source: 'pexels' | 'pixabay';
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
