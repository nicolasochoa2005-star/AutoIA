import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { VisualBeat, VisualClip } from '../types/script.types';
import { LibraryService } from '../library/library.service';
import { ComposeService } from '../compose/compose.service';
import { CostCapService } from '../../cost/cost-cap.service';
import { estimateFalImageUsd } from '../../cost/cost-rates';
import { FalIdentityProvider } from './fal-identity.provider';

interface PexelsVideoFile {
  link: string;
  width: number;
  height: number;
  quality: string;
}

interface PexelsVideo {
  id: number;
  url: string;
  video_files: PexelsVideoFile[];
}

const PEXELS_LICENSE_URL = 'https://www.pexels.com/license/';

@Injectable()
export class VisualsService {
  private readonly logger = new Logger(VisualsService.name);
  lastCostUsd = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly library: LibraryService,
    private readonly compose: ComposeService,
    private readonly fal: FalIdentityProvider,
    private readonly caps: CostCapService,
  ) {}

  /**
   * Híbrido por beat (ver spec de `visuals` en add-stage-gates-and-local-refs):
   * 1) still ya producido en esta corrida (compose/override previo), 2) escena
   * precompuesta en la librería local, 3) compose sujeto+outfit (wait/overlay),
   * 4) stock de Pexels como fallback.
   */
  async fetchClips(
    beats: VisualBeat[],
    visualsDir: string,
    options: { videoId?: string; identityProvider?: 'local' | 'fal' } = {},
  ): Promise<VisualClip[]> {
    await fs.mkdir(visualsDir, { recursive: true });
    const clips: VisualClip[] = [];
    this.lastCostUsd = 0;
    const identityProvider = this.resolveIdentityProvider(options.identityProvider);

    for (const [index, beat] of beats.entries()) {
      const beatNum = index + 1;
      const runStillPath = path.join(visualsDir, `beat_${beatNum}.jpg`);

      if (await this.exists(runStillPath)) {
        clips.push(this.localStillClip(runStillPath, `beat_${beatNum}`, 'Operador (compose/override)'));
        continue;
      }

      const scenePath = await this.library.resolveScene(beatNum);
      if (scenePath) {
        clips.push(this.localStillClip(scenePath, path.basename(scenePath), 'Librería local (operador)'));
        continue;
      }

      if (identityProvider === 'fal' && this.isCharacterBeat(beat)) {
        const falClip = await this.tryFalStill(beat, runStillPath, options.videoId);
        if (falClip) {
          clips.push(falClip);
          continue;
        }
      }

      if (beat.subject_id && beat.outfit_id) {
        const composedPath = await this.compose.resolveBeatStill(beat, runStillPath);
        clips.push(this.localStillClip(composedPath, `beat_${beatNum}`, 'Operador (compose)'));
        continue;
      }

      const stockClip = await this.fetchStockClip(beat.prompt, index, visualsDir);
      if (stockClip) clips.push(stockClip);
    }

    if (clips.length === 0) {
      throw new Error('NO_VISUAL_MATCH: no se obtuvo ningún clip válido para el guion');
    }

    return clips;
  }

  /**
   * Copia o combina stills de nodos LoadImage para que fetchClips los tome
   * como beats ya compuestos (sin esperar drop del operador).
   */
  async seedComposeImages(imagePaths: string[], visualsDir: string, beatCount: number): Promise<void> {
    const usable = imagePaths.filter(Boolean);
    if (usable.length === 0 || beatCount < 1) return;

    await fs.mkdir(visualsDir, { recursive: true });
    const master = path.join(visualsDir, 'compose_master.jpg');

    if (usable.length >= 2) {
      try {
        await this.compose.overlayFiles(usable[0], usable[1], master);
      } catch (error) {
        this.logger.warn(`Compose overlay falló, se usa la imagen sujeto: ${(error as Error).message}`);
        await fs.copyFile(usable[0], master);
      }
    } else {
      await fs.copyFile(usable[0], master);
    }

    for (let i = 1; i <= beatCount; i++) {
      await fs.copyFile(master, path.join(visualsDir, `beat_${i}.jpg`));
    }
  }

  /** Reanuda una etapa de visuales ya completada (manifest `done` o gate `pause`/`override`). */
  async loadExisting(visualsDir: string): Promise<VisualClip[]> {
    const entries = await fs.readdir(visualsDir);
    const clips: VisualClip[] = [];

    for (const entry of entries.sort()) {
      const ext = path.extname(entry).toLowerCase();
      const localPath = path.join(visualsDir, entry);

      if (ext === '.mp4') {
        clips.push({
          source: 'pexels',
          kind: 'video',
          sourceAssetId: entry,
          licenseType: 'Resumido de corrida anterior',
          localPath,
        });
      } else if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
        clips.push({
          source: 'local',
          kind: 'still',
          sourceAssetId: entry,
          licenseType: 'Resumido de corrida anterior',
          localPath,
        });
      }
    }

    if (clips.length === 0) {
      throw new Error('NO_VISUAL_MATCH: no hay clips existentes para reanudar en ' + visualsDir);
    }

    return clips;
  }

  private isCharacterBeat(beat: VisualBeat): boolean {
    return beat.source_hint === 'character' || Boolean(beat.subject_id);
  }

  private resolveIdentityProvider(override?: 'local' | 'fal'): 'local' | 'fal' {
    const raw = (
      override ||
      this.config.get<string>('IDENTITY_VISUAL_PROVIDER', 'local') ||
      'local'
    ).toLowerCase();
    return raw === 'fal' ? 'fal' : 'local';
  }

  private async tryFalStill(
    beat: VisualBeat,
    destPath: string,
    videoId?: string,
  ): Promise<VisualClip | null> {
    const estimate = estimateFalImageUsd();
    const allowed = await this.caps.canAfford(estimate, videoId);
    if (!allowed) {
      if (this.caps.onCap() === 'waiting') {
        throw this.caps.capExceededError();
      }
      this.logger.warn('Tope de costo: beat de personaje cae a local/Pexels');
      return null;
    }
    try {
      await this.fal.generateStill(beat.prompt, destPath);
      this.lastCostUsd += estimate;
      return {
        source: 'fal',
        kind: 'still',
        sourceAssetId: path.basename(destPath),
        licenseType: 'Fal generated (opt-in)',
        localPath: destPath,
      };
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      const message = error instanceof Error ? error.message : String(error);
      if (status === 429 || status === 402 || /insufficient|quota|rate limit/i.test(message)) {
        this.logger.warn(`Fal fallback ($0): ${message}`);
        return null;
      }
      throw error;
    }
  }

  private localStillClip(localPath: string, assetId: string, licenseType: string): VisualClip {
    return { source: 'local', kind: 'still', sourceAssetId: assetId, licenseType, localPath };
  }

  private async fetchStockClip(prompt: string, index: number, outputDir: string): Promise<VisualClip | null> {
    const apiKey = this.config.getOrThrow<string>('PEXELS_API_KEY');
    const video = await this.searchVideo(prompt, apiKey);
    if (!video) {
      this.logger.warn(`NO_VISUAL_MATCH: sin resultados para el prompt "${prompt}"`);
      return null;
    }

    const file = this.pickVerticalFile(video.video_files);
    if (!file) {
      this.logger.warn(`NO_VISUAL_MATCH: sin archivo vertical HD para el prompt "${prompt}"`);
      return null;
    }

    const localPath = path.join(outputDir, `clip_${index}.mp4`);
    await this.download(file.link, localPath);

    return {
      source: 'pexels',
      kind: 'video',
      sourceAssetId: String(video.id),
      licenseType: 'Pexels License (uso comercial permitido)',
      licenseUrl: PEXELS_LICENSE_URL,
      localPath,
    };
  }

  private async searchVideo(query: string, apiKey: string): Promise<PexelsVideo | null> {
    const res = await axios.get('https://api.pexels.com/videos/search', {
      headers: { Authorization: apiKey },
      params: { query, orientation: 'portrait', size: 'large', per_page: 5 },
    });

    const videos: PexelsVideo[] = res.data?.videos ?? [];
    return videos[0] ?? null;
  }

  private pickVerticalFile(files: PexelsVideoFile[]): PexelsVideoFile | null {
    const target = files.find((f) => f.width === 1080 && f.height === 1920);
    if (target) return target;
    return files.find((f) => f.height > f.width) ?? null;
  }

  private async download(url: string, destPath: string): Promise<void> {
    const response = await axios.get(url, { responseType: 'stream' });
    await pipeline(response.data, createWriteStream(destPath));
  }

  private async exists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }
}
