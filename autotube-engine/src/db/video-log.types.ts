export interface StageLogInput {
  videoId: string;
  stage: 'SCRIPT' | 'TTS' | 'VISUALS' | 'RENDER';
  success: boolean;
  provider?: string;
  costUsd?: number;
  errorDetail?: string;
  attempt?: number;
  nodeId?: string;
}
