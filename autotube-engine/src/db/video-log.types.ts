export interface StageLogInput {
  videoId: string;
  stage: 'SCRIPT' | 'TTS' | 'VISUALS' | 'RENDER' | 'PUBLISH';
  success: boolean;
  provider?: string;
  costUsd?: number;
  errorDetail?: string;
  attempt?: number;
  nodeId?: string;
}
