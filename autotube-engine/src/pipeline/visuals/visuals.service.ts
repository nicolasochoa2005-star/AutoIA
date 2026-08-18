import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { VisualClip } from '../types/script.types';

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

  constructor(private readonly config: ConfigService) {}

  async fetchClips(prompts: string[], outputDir: string): Promise<VisualClip[]> {
    await fs.mkdir(outputDir, { recursive: true });
    const apiKey = this.config.getOrThrow<string>('PEXELS_API_KEY');

    const clips: VisualClip[] = [];

    for (const [index, prompt] of prompts.entries()) {
      const video = await this.searchVideo(prompt, apiKey);
      if (!video) {
        this.logger.warn(`NO_VISUAL_MATCH: sin resultados para el prompt "${prompt}"`);
        continue;
      }

      const file = this.pickVerticalFile(video.video_files);
      if (!file) {
        this.logger.warn(`NO_VISUAL_MATCH: sin archivo vertical HD para el prompt "${prompt}"`);
        continue;
      }

      const localPath = path.join(outputDir, `clip_${index}.mp4`);
      await this.download(file.link, localPath);

      clips.push({
        source: 'pexels',
        sourceAssetId: String(video.id),
        licenseType: 'Pexels License (uso comercial permitido)',
        licenseUrl: PEXELS_LICENSE_URL,
        localPath,
      });
    }

    if (clips.length === 0) {
      throw new Error('NO_VISUAL_MATCH: no se obtuvo ningún clip válido para el guion');
    }

    return clips;
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
}
