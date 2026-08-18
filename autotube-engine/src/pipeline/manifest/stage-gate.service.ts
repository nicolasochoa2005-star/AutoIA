import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';
import { StageMode } from './manifest.types';

const POLL_INTERVAL_MS = 1000;

export interface StageGateOptions<T> {
  mode: StageMode;
  /** Ruta de origen provista por el operador (flags --override-<stage>). */
  overridePath?: string;
  /** Artefacto(s) que esta etapa espera encontrar para override/pause. */
  expectedPaths: string[];
  /** Directorio destino donde copiar overridePath (archivo suelto o carpeta). */
  slotDir: string;
  loadExisting: () => Promise<T>;
  generate: () => Promise<T>;
  interactiveLabel: string;
}

/**
 * Aplica el modo `auto | pause | override` de una etapa (ver
 * openspec/changes/add-stage-gates-and-local-refs/specs/stage-gates).
 */
@Injectable()
export class StageGateService {
  private readonly logger = new Logger(StageGateService.name);

  async gate<T>(opts: StageGateOptions<T>): Promise<T> {
    if (opts.mode === 'override') {
      if (opts.overridePath) {
        await this.copyIntoSlot(opts.overridePath, opts.slotDir, opts.expectedPaths);
      }
      if (!(await this.allExist(opts.expectedPaths))) {
        throw new Error(
          `WAITING_FOR_INPUT: modo override requiere el/los archivo(s) en ${opts.expectedPaths.join(', ')}`,
        );
      }
      return opts.loadExisting();
    }

    if (opts.mode === 'pause') {
      if (await this.allExist(opts.expectedPaths)) {
        this.logger.log(`Etapa ya tiene artefactos provistos por el operador, se usan tal cual.`);
        return opts.loadExisting();
      }
      const proceedWithAuto = await this.waitForOperator(opts.interactiveLabel, opts.expectedPaths);
      return proceedWithAuto ? opts.generate() : opts.loadExisting();
    }

    return opts.generate();
  }

  private async copyIntoSlot(sourcePath: string, slotDir: string, expectedPaths: string[]): Promise<void> {
    await fs.mkdir(slotDir, { recursive: true });
    const stat = await fs.stat(sourcePath);

    if (stat.isDirectory()) {
      const entries = await fs.readdir(sourcePath);
      for (const entry of entries) {
        await fs.copyFile(path.join(sourcePath, entry), path.join(slotDir, entry));
      }
      return;
    }

    // Etapa de un solo archivo (ej. script/render): usar el nombre exacto que
    // espera el manifest, sin depender de cómo se llame el archivo de origen.
    if (expectedPaths.length === 1) {
      await fs.copyFile(sourcePath, expectedPaths[0]);
      return;
    }

    await fs.copyFile(sourcePath, path.join(slotDir, path.basename(sourcePath)));
  }

  private async allExist(paths: string[]): Promise<boolean> {
    for (const p of paths) {
      try {
        await fs.access(p);
      } catch {
        return false;
      }
    }
    return true;
  }

  /**
   * Bloquea hasta que el operador confirme (Enter en stdin => generar auto)
   * o hasta que aparezcan los artefactos esperados en disco (=> usarlos).
   */
  private waitForOperator(label: string, expectedPaths: string[]): Promise<boolean> {
    this.logger.log(
      `⏸ EN PAUSA: ${label}. Colocá el/los archivo(s) esperado(s) en:\n  ${expectedPaths.join('\n  ')}\nO presioná ENTER para generarlo automáticamente.`,
    );

    return new Promise((resolve) => {
      let settled = false;

      const rl = readline.createInterface({ input: process.stdin });
      const onLine = () => {
        if (settled) return;
        settled = true;
        clearInterval(poller);
        rl.close();
        resolve(true);
      };
      rl.once('line', onLine);

      const poller = setInterval(() => {
        if (settled) return;
        this.allExist(expectedPaths).then((exists) => {
          if (exists && !settled) {
            settled = true;
            clearInterval(poller);
            rl.close();
            resolve(false);
          }
        });
      }, POLL_INTERVAL_MS);
    });
  }
}
