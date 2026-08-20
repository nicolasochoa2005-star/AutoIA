export type StageName = 'script' | 'tts' | 'visuals' | 'render';

export const STAGE_ORDER: StageName[] = ['script', 'tts', 'visuals', 'render'];

export type StageMode = 'auto' | 'pause' | 'override';

export type StageStatus = 'pending' | 'waiting' | 'done';

export interface StageManifestEntry {
  status: StageStatus;
  mode: StageMode;
  artifactPaths: string[];
  completedAt?: string;
}

export interface RunManifest {
  runId: string;
  topicHint: string;
  characterId?: string;
  /** Autopilot (default) o directed. Persistido para --resume. */
  narrativeProfile?: 'autopilot' | 'directed';
  stages: Record<StageName, StageManifestEntry>;
  createdAt: string;
  updatedAt: string;
}

export type StageModesConfig = Record<StageName, StageMode>;

export const DEFAULT_STAGE_MODES: StageModesConfig = {
  script: 'auto',
  tts: 'auto',
  visuals: 'auto',
  render: 'auto',
};
