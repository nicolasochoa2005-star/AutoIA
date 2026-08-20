import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';
import { VisualBeat } from '../types/script.types';
import { LibraryService } from '../library/library.service';

const POLL_INTERVAL_MS = 1000;

/**
 * Empareja sujeto + outfit por beat (sección 3.3.2). Default `wait`: el
 * operador suelta el still compuesto. `overlay` (opt-in, PNG con alpha) lo
 * compone automáticamente vía FFmpeg — no es un try-on realista, solo props.
 */
@Injectable()
export class ComposeService {
  private readonly logger = new Logger(ComposeService.name);

  constructor(
    private readonly library: LibraryService,
    private readonly config: ConfigService,
  ) {}

  async resolveBeatStill(beat: VisualBeat, expectedPath: string): Promise<string> {
    if (await this.exists(expectedPath)) {
      return expectedPath;
    }

    const composeMode = this.config.get<string>('COMPOSE_MODE', 'wait');

    if (composeMode === 'overlay' && beat.subject_id && beat.outfit_id) {
      await this.overlayCompose(beat.subject_id, beat.outfit_id, expectedPath);
      return expectedPath;
    }

    await this.waitForDrop(expectedPath);
    return expectedPath;
  }

  private async overlayCompose(subjectId: string, outfitId: string, outputPath: string): Promise<void> {
    const subjectPath = this.library.subjectRefFile(subjectId, 'full');
    const outfitPath = this.library.outfitFile(outfitId);

    if (!outfitPath.toLowerCase().endsWith('.png')) {
      throw new Error('RENDER_FAILED: overlay compose solo soporta outfits PNG con alpha');
    }

    await this.runFfmpeg([
      '-y',
      '-i', subjectPath,
      '-i', outfitPath,
      '-filter_complex', '[0:v][1:v]overlay=0:0',
      '-frames:v', '1',
      outputPath,
    ]);
  }

  /** Overlay de dos archivos arbitrarios (nodos LoadImage → Compose). */
  async overlayFiles(subjectPath: string, outfitPath: string, outputPath: string): Promise<void> {
    await this.runFfmpeg([
      '-y',
      '-i', subjectPath,
      '-i', outfitPath,
      '-filter_complex', '[0:v][1:v]overlay=0:0',
      '-frames:v', '1',
      outputPath,
    ]);
  }

  private async waitForDrop(expectedPath: string): Promise<void> {
    const timeoutMs = this.config.get<number>('COMPOSE_WAIT_TIMEOUT_MS');
    const startedAt = Date.now();

    this.logger.log(`⏸ Compose en espera: colocá el still compuesto en ${expectedPath}`);

    while (!(await this.exists(expectedPath))) {
      if (timeoutMs && Date.now() - startedAt > timeoutMs) {
        throw new Error(`WAITING_TIMEOUT: no se recibió ${expectedPath} dentro del timeout configurado`);
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  private async exists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  private runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', args);
      let stderr = '';
      proc.stderr.on('data', (chunk) => (stderr += chunk.toString()));
      proc.on('error', (err) => reject(new Error(`RENDER_FAILED: ${err.message}`)));
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else {
          this.logger.error(stderr.slice(-1000));
          reject(new Error(`RENDER_FAILED: ffmpeg (compose) salió con código ${code}`));
        }
      });
    });
  }
}
