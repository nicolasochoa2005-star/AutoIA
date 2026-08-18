import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';
import { RenderedVideo, SynthesizedAudio, VisualClip } from '../types/script.types';

const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1920;
const TARGET_FPS = 60;

@Injectable()
export class RenderService {
  private readonly logger = new Logger(RenderService.name);

  async render(
    clips: VisualClip[],
    audio: SynthesizedAudio,
    outputDir: string,
    backgroundMusicPath?: string,
  ): Promise<RenderedVideo> {
    await fs.mkdir(outputDir, { recursive: true });

    const concatListPath = path.join(outputDir, 'concat_list.txt');
    const normalizedClipsDir = path.join(outputDir, 'normalized_clips');
    await fs.mkdir(normalizedClipsDir, { recursive: true });

    const normalizedPaths = await this.normalizeClips(clips, normalizedClipsDir);
    await this.writeConcatList(normalizedPaths, concatListPath);

    const concatenatedPath = path.join(outputDir, 'background_concat.mp4');
    await this.runFfmpeg([
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-an',
      '-t', String(audio.durationMs / 1000),
      concatenatedPath,
    ]);

    const outputPath = path.join(outputDir, 'final.mp4');
    const escapedAssPath = audio.subtitlesAssPath.replace(/\\/g, '/').replace(':', '\\:');

    const audioFilterArgs = backgroundMusicPath
      ? this.buildDuckingFilter()
      : ['-map', '1:a'];

    const inputs = backgroundMusicPath
      ? ['-i', concatenatedPath, '-i', audio.audioPath, '-i', backgroundMusicPath]
      : ['-i', concatenatedPath, '-i', audio.audioPath];

    await this.runFfmpeg([
      '-y',
      ...inputs,
      '-vf', `scale=${TARGET_WIDTH}:${TARGET_HEIGHT}:force_original_aspect_ratio=increase,crop=${TARGET_WIDTH}:${TARGET_HEIGHT},fps=${TARGET_FPS},ass=${escapedAssPath}`,
      ...audioFilterArgs,
      '-map', '0:v',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-shortest',
      outputPath,
    ]);

    const stat = await fs.stat(outputPath).catch(() => null);
    if (!stat || stat.size === 0) {
      throw new Error('RENDER_FAILED: el archivo de salida no se generó o está vacío');
    }

    return { videoPath: outputPath, durationMs: audio.durationMs };
  }

  private buildDuckingFilter(): string[] {
    // Atenúa la música de fondo (input 2) mientras hay locución (input 1) usando sidechaincompress.
    return [
      '-filter_complex',
      '[2:a]volume=0.25[music];[1:a][music]sidechaincompress=threshold=0.05:ratio=8[ducked];[1:a][ducked]amix=inputs=2:duration=first[aout]',
      '-map', '[aout]',
    ];
  }

  private async normalizeClips(clips: VisualClip[], outDir: string): Promise<string[]> {
    const normalized: string[] = [];
    for (const [index, clip] of clips.entries()) {
      const outPath = path.join(outDir, `n_${index}.mp4`);
      await this.runFfmpeg([
        '-y',
        '-i', clip.localPath,
        '-vf', `scale=${TARGET_WIDTH}:${TARGET_HEIGHT}:force_original_aspect_ratio=increase,crop=${TARGET_WIDTH}:${TARGET_HEIGHT},fps=${TARGET_FPS}`,
        '-an',
        '-c:v', 'libx264',
        outPath,
      ]);
      normalized.push(outPath);
    }
    return normalized;
  }

  private async writeConcatList(clipPaths: string[], listPath: string): Promise<void> {
    const content = clipPaths
      .map((p) => `file '${p.replace(/\\/g, '/')}'`)
      .join('\n');
    await fs.writeFile(listPath, content, 'utf-8');
  }

  private runFfmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', args);
      let stderr = '';

      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      proc.on('error', (err) => reject(new Error(`RENDER_FAILED: ${err.message}`)));

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          this.logger.error(stderr.slice(-2000));
          reject(new Error(`RENDER_FAILED: ffmpeg salió con código ${code}`));
        }
      });
    });
  }
}
