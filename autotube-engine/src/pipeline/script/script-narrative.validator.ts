import { GeneratedScript } from '../types/script.types';
import type { NarrativeProfile } from './narrative-profile';

export const DIRECTED_MAX_WORDS = 75;
export const DIRECTED_MAX_SCENE_SECONDS = 30;
export const DIRECTED_MAX_TTS_MS = 30_000;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function concatDirectedNarration(script: GeneratedScript): string {
  return [script.hook, script.desarrollo, script.climax, script.cta]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

export function assertDirectedScript(script: GeneratedScript): GeneratedScript {
  const hook = script.hook?.trim() ?? '';
  const desarrollo = script.desarrollo?.trim() ?? '';
  const climax = script.climax?.trim() ?? '';
  const cta = script.cta?.trim() ?? '';
  if (!hook || !desarrollo || !climax || !cta) {
    throw new Error('INVALID_SCRIPT: directed requiere hook, desarrollo, climax y cta');
  }

  const next: GeneratedScript = {
    ...script,
    hook,
    desarrollo,
    climax,
    cta,
    guion_locucion: concatDirectedNarration({ ...script, hook, desarrollo, climax, cta }),
  };

  if (countWords(next.guion_locucion) > DIRECTED_MAX_WORDS) {
    throw new Error(`INVALID_SCRIPT: directed admite como máximo ${DIRECTED_MAX_WORDS} palabras`);
  }

  const beats = next.beats_visuales;
  if (beats && beats.length > 0) {
    let sum = 0;
    for (const beat of beats) {
      if (typeof beat.duration_s !== 'number' || !(beat.duration_s > 0) || !beat.action?.trim()) {
        throw new Error('INVALID_SCRIPT: cada beat directed requiere duration_s y action');
      }
      sum += beat.duration_s;
    }
    if (sum > DIRECTED_MAX_SCENE_SECONDS) {
      throw new Error('INVALID_SCRIPT: la suma de duration_s no puede superar 30');
    }
  }

  return next;
}

export function applyNarrativeContract(
  script: GeneratedScript,
  profile: NarrativeProfile,
): GeneratedScript {
  if (profile !== 'directed') {
    return script;
  }
  return assertDirectedScript(script);
}
