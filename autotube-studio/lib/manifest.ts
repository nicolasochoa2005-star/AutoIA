import * as fs from 'fs/promises';
import { manifestPathFor } from './engine-paths';
import { RunManifest, RunStatus, STAGE_ORDER } from './types';
import { getProcessState, hasProcess, lastWaitingLabel } from './process-manager';

export async function readManifest(runId: string): Promise<RunManifest | null> {
  try {
    const raw = await fs.readFile(manifestPathFor(runId), 'utf-8');
    return JSON.parse(raw) as RunManifest;
  } catch {
    return null;
  }
}

export async function readRunStatus(runId: string): Promise<RunStatus> {
  const manifest = await readManifest(runId);
  const { running, exitCode } = getProcessState(runId);

  const activeStage = manifest ? STAGE_ORDER.find((s) => manifest.stages[s]?.status !== 'done') ?? null : null;
  const waitingLabel = hasProcess(runId) ? lastWaitingLabel(runId) : null;
  // Heurística: si el proceso sigue vivo, hay una etapa activa, y el último
  // log de pausa corresponde a esa etapa, asumimos que está esperando al operador.
  const waiting = Boolean(running && activeStage && waitingLabel);

  return { runId, manifest, running, exitCode, activeStage, waiting, waitingLabel };
}
