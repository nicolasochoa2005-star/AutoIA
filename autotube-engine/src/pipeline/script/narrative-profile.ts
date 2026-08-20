export type NarrativeProfile = 'autopilot' | 'directed';

export const DEFAULT_NARRATIVE_PROFILE: NarrativeProfile = 'autopilot';

/** El worker/CRON siempre corre en autopilot, aunque NARRATIVE_PROFILE=directed. */
export const WORKER_NARRATIVE_PROFILE: NarrativeProfile = 'autopilot';

export function parseNarrativeProfile(value: string | undefined): NarrativeProfile {
  return value === 'directed' ? 'directed' : 'autopilot';
}
