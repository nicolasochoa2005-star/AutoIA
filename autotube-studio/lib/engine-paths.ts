import * as path from 'path';

/**
 * El Estudio no importa código del Engine (NestJS): lo trata como un proceso
 * externo y lee/escribe sus carpetas de artefactos (ver design.md de
 * add-node-studio — "shell out to CLI as a temporary adapter").
 */
export const ENGINE_DIR = process.env.ENGINE_DIR
  ? path.resolve(process.env.ENGINE_DIR)
  : path.resolve(process.cwd(), '..', 'autotube-engine');

export function runDirFor(runId: string): string {
  return path.join(ENGINE_DIR, 'output', runId);
}

export function manifestPathFor(runId: string): string {
  return path.join(runDirFor(runId), 'manifest.json');
}

export { STAGE_ORDER } from './types';
export type { StageName, StageStatus, StageManifestEntry, RunManifest } from './types';
