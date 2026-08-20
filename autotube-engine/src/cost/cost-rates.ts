export const ELEVENLABS_USD_PER_1K_CHARS = 0.015;
export const FAL_USD_PER_IMAGE = 0.03;

export function estimateElevenLabsUsd(text: string): number {
  return (text.length / 1000) * ELEVENLABS_USD_PER_1K_CHARS;
}

export function estimateFalImageUsd(imageCount = 1): number {
  return imageCount * FAL_USD_PER_IMAGE;
}

export type PaidOnCap = 'zero' | 'waiting';
