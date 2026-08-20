import * as fs from 'fs/promises';
import * as path from 'path';
import { runDirFor } from './engine-paths';
import type { StartRunOptions } from './process-manager';

export function parseStartOptions(body: Record<string, unknown>): StartRunOptions {
  const ttsProvider =
    body.ttsProvider === 'elevenlabs' ? 'elevenlabs' : body.ttsProvider === 'edge-tts' ? 'edge-tts' : undefined;
  const identityProvider =
    body.identityProvider === 'fal' ? 'fal' : body.identityProvider === 'local' ? 'local' : undefined;
  const narrativeProfile =
    body.narrativeProfile === 'directed'
      ? 'directed'
      : body.narrativeProfile === 'autopilot'
        ? 'autopilot'
        : undefined;

  const composeImagePaths = Array.isArray(body.composeImagePaths)
    ? body.composeImagePaths.filter((p): p is string => typeof p === 'string' && p.length > 0)
    : undefined;

  return {
    characterId: body.characterId ? String(body.characterId) : undefined,
    ttsProvider,
    identityProvider,
    narrativeProfile,
    promptOverride: body.promptOverride ? String(body.promptOverride) : undefined,
    composeImagePaths,
    backgroundMusicPath: body.backgroundMusicPath ? String(body.backgroundMusicPath) : undefined,
    width: num(body.width),
    height: num(body.height),
    fps: num(body.fps),
    vcodec: body.vcodec ? String(body.vcodec) : undefined,
    acodec: body.acodec ? String(body.acodec) : undefined,
    durationSec: num(body.durationSec),
  };
}

export async function loadWorkflowAssets(runId: string): Promise<{
  composeImagePaths: string[];
  backgroundMusicPath?: string;
}> {
  const dir = path.join(runDirFor(runId), 'workflow');
  try {
    const entries = await fs.readdir(dir);
    const composeImagePaths = entries
      .filter((e) => e.startsWith('compose_'))
      .sort()
      .map((e) => path.join(dir, e));
    const music = entries.find((e) => e.startsWith('music.'));
    return {
      composeImagePaths,
      backgroundMusicPath: music ? path.join(dir, music) : undefined,
    };
  } catch {
    return { composeImagePaths: [] };
  }
}

function num(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
