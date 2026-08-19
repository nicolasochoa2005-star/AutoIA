export const STAGE_ORDER = ['script', 'tts', 'visuals', 'render'] as const;
export type StageName = (typeof STAGE_ORDER)[number];
export type StageStatus = 'pending' | 'waiting' | 'done';

export interface StageManifestEntry {
  status: StageStatus;
  mode: 'auto' | 'pause' | 'override';
  artifactPaths: string[];
  completedAt?: string;
}

export interface RunManifest {
  runId: string;
  topicHint: string;
  characterId?: string;
  stages: Record<StageName, StageManifestEntry>;
  createdAt: string;
  updatedAt: string;
}

export interface RunStatus {
  runId: string;
  manifest: RunManifest | null;
  running: boolean;
  exitCode: number | null;
  activeStage: StageName | null;
  waiting: boolean;
  waitingLabel: string | null;
}

export interface CharacterSummary {
  id: string;
  name: string;
}
