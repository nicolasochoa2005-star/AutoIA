import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import {
  DEFAULT_STAGE_MODES,
  RunManifest,
  STAGE_ORDER,
  StageMode,
  StageModesConfig,
  StageName,
} from './manifest.types';
import { runPaths } from './run-paths';

@Injectable()
export class ManifestService {
  async load(runDir: string): Promise<RunManifest | null> {
    try {
      const raw = await fs.readFile(runPaths(runDir).manifest, 'utf-8');
      return JSON.parse(raw) as RunManifest;
    } catch {
      return null;
    }
  }

  async initialize(
    runDir: string,
    runId: string,
    topicHint: string,
    modes: StageModesConfig = DEFAULT_STAGE_MODES,
    characterId?: string,
  ): Promise<RunManifest> {
    const now = new Date().toISOString();
    const manifest: RunManifest = {
      runId,
      topicHint,
      characterId,
      stages: Object.fromEntries(
        STAGE_ORDER.map((stage) => [
          stage,
          { status: 'pending' as const, mode: modes[stage], artifactPaths: [] as string[] },
        ]),
      ) as unknown as RunManifest['stages'],
      createdAt: now,
      updatedAt: now,
    };
    await this.save(runDir, manifest);
    return manifest;
  }

  async markDone(
    runDir: string,
    manifest: RunManifest,
    stage: StageName,
    artifactPaths: string[],
  ): Promise<RunManifest> {
    manifest.stages[stage] = {
      ...manifest.stages[stage],
      status: 'done',
      artifactPaths,
      completedAt: new Date().toISOString(),
    };
    manifest.updatedAt = new Date().toISOString();
    await this.save(runDir, manifest);
    return manifest;
  }

  async markWaiting(runDir: string, manifest: RunManifest, stage: StageName): Promise<RunManifest> {
    manifest.stages[stage] = { ...manifest.stages[stage], status: 'waiting' };
    manifest.updatedAt = new Date().toISOString();
    await this.save(runDir, manifest);
    return manifest;
  }

  isStageDone(manifest: RunManifest, stage: StageName): boolean {
    return manifest.stages[stage]?.status === 'done';
  }

  /**
   * Marca `fromStage` y todas las etapas posteriores como `pending` de nuevo,
   * para forzar su regeneración aunque el manifest las tuviera como `done`
   * (usado por `--from <stage>` junto a `--resume`).
   */
  invalidateFrom(manifest: RunManifest, fromStage: StageName): RunManifest {
    const startIndex = STAGE_ORDER.indexOf(fromStage);
    for (const stage of STAGE_ORDER.slice(startIndex)) {
      manifest.stages[stage] = { ...manifest.stages[stage], status: 'pending', artifactPaths: [] };
    }
    return manifest;
  }

  getMode(manifest: RunManifest, stage: StageName): StageMode {
    return manifest.stages[stage]?.mode ?? 'auto';
  }

  private async save(runDir: string, manifest: RunManifest): Promise<void> {
    await fs.mkdir(runDir, { recursive: true });
    await fs.writeFile(runPaths(runDir).manifest, JSON.stringify(manifest, null, 2), 'utf-8');
  }
}
