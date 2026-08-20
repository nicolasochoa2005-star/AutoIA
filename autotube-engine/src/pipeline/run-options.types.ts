import { StageModesConfig, StageName } from './manifest/manifest.types';
import type { NarrativeProfile } from './script/narrative-profile';
import type { RenderSettings } from './render/render-settings';

export interface RunOptions {
  topicHint: string;
  runDir: string;
  modes: StageModesConfig;
  characterId?: string;
  /** Ruta provista por el operador para copiar dentro del slot de la etapa en modo `override`. */
  overridePaths?: Partial<Record<StageName, string>>;
  /** Si se pasa junto a --resume, fuerza a regenerar esta etapa y las siguientes. */
  resumeFrom?: StageName;
  /** Si es una corrida `--resume`, el manifest ya existente a continuar. */
  resumeManifestPresent?: boolean;
  /** Fila `videos` asociada a esta corrida (enqueue o CLI). */
  videoId?: string;
  /** Override de proveedor TTS: edge-tts (default) o elevenlabs. */
  ttsProvider?: 'edge-tts' | 'elevenlabs';
  /** Override de identidad visual: local (default) o fal. */
  identityProvider?: 'local' | 'fal';
  /** Autopilot (default, flujo libre) o directed (30s / hook-CTA). */
  narrativeProfile?: NarrativeProfile;
  /** Dirección extra (nodo Prompt → Compose) concatenada al tema del guion. */
  promptOverride?: string;
  /** Stills de LoadImage/Compose, en orden sujeto + outfit. */
  composeImagePaths?: string[];
  /** Banda sonora opcional (nodo LoadAudio). */
  backgroundMusicPath?: string;
  /** Resolución / fps / codecs del nodo Guardar video. */
  render?: Partial<RenderSettings>;
}
