import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';
import { RenderedVideo, SynthesizedAudio, VisualClip } from '../types/script.types';
import {
  resolveRenderSettings,
  rewriteAssPlayRes,
  type RenderSettings,
} from './render-settings';

const KEN_BURNS_MIN_DURATION_SEC = 2;

@Injectable()
export class RenderService {
  private readonly logger = new Logger(RenderService.name);

  async render(
    clips: VisualClip[],
    audio: SynthesizedAudio,
    outputDir: string,
    options: { backgroundMusicPath?: string; settings?: Partial<RenderSettings> } = {},
  ): Promise<RenderedVideo> {
    const settings = resolveRenderSettings(options.settings);
    const backgroundMusicPath = options.backgroundMusicPath;
    await fs.mkdir(outputDir, { recursive: true });

    const concatListPath = path.join(outputDir, 'concat_list.txt');
    const normalizedClipsDir = path.join(outputDir, 'normalized_clips');
    await fs.mkdir(normalizedClipsDir, { recursive: true });

    const targetDurationSec = settings.durationSec
      ? Math.min(settings.durationSec, audio.durationMs / 1000)
      : audio.durationMs / 1000;

    const normalizedPaths = await this.normalizeClips(
      clips,
      normalizedClipsDir,
      targetDurationSec * 1000,
      settings,
    );
    await this.writeConcatList(normalizedPaths, concatListPath);

    const concatenatedPath = path.join(outputDir, 'background_concat.mp4');
    await this.runFfmpeg([
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-an',
      '-t', String(targetDurationSec),
      concatenatedPath,
    ]);

    const outputPath = path.join(outputDir, 'final.mp4');
    const scaledAssPath = await this.writeScaledAss(audio.subtitlesAssPath, outputDir, settings);
    const escapedAssPath = this.escapeFfmpegFilterPath(scaledAssPath);

    try {
      await this.runComposite(concatenatedPath, audio, escapedAssPath, outputPath, backgroundMusicPath, settings);
    } catch (err) {
      if (!backgroundMusicPath) {
        throw err;
      }
      this.logger.warn(
        `Fallo el render con música de fondo, reintentando sin BGM: ${(err as Error).message}`,
      );
      await this.runComposite(concatenatedPath, audio, escapedAssPath, outputPath, undefined, settings);
    }

    const stat = await fs.stat(outputPath).catch(() => null);
    if (!stat || stat.size === 0) {
      throw new Error('RENDER_FAILED: el archivo de salida no se generó o está vacío');
    }

    return { videoPath: outputPath, durationMs: Math.round(targetDurationSec * 1000) };
  }

  private async writeScaledAss(assPath: string, outputDir: string, settings: RenderSettings): Promise<string> {
    const raw = await fs.readFile(assPath, 'utf-8');
    const scaled = rewriteAssPlayRes(raw, settings.width, settings.height);
    const outPath = path.join(outputDir, 'subtitles_scaled.ass');
    await fs.writeFile(outPath, scaled, 'utf-8');
    return outPath;
  }

  private async runComposite(
    concatenatedPath: string,
    audio: SynthesizedAudio,
    escapedAssPath: string,
    outputPath: string,
    backgroundMusicPath: string | undefined,
    settings: RenderSettings,
  ): Promise<void> {
    const audioFilterArgs = backgroundMusicPath
      ? this.buildDuckingFilter()
      : ['-map', '1:a'];

    const inputs = backgroundMusicPath
      ? ['-i', concatenatedPath, '-i', audio.audioPath, '-i', backgroundMusicPath]
      : ['-i', concatenatedPath, '-i', audio.audioPath];

    await this.runFfmpeg([
      '-y',
      ...inputs,
      '-vf', `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=increase,crop=${settings.width}:${settings.height},fps=${settings.fps},ass=${escapedAssPath}`,
      ...audioFilterArgs,
      '-map', '0:v',
      '-c:v', settings.vcodec,
      '-c:a', settings.acodec,
      '-shortest',
      outputPath,
    ]);
  }

  /**
   * ffmpeg filtergraph syntax treats ':' as a key=value separator and ','
   * as a filter separator, so a Windows path (drive letter colon) must be
   * wrapped in single quotes and have its own single quotes/colons escaped.
   */
  private escapeFfmpegFilterPath(rawPath: string): string {
    const forwardSlashed = rawPath.replace(/\\/g, '/');
    const escaped = forwardSlashed.replace(/'/g, "'\\''").replace(/:/g, '\\:');
    return `'${escaped}'`;
  }

  private buildDuckingFilter(): string[] {
    return [
      '-filter_complex',
      '[2:a]volume=0.25[music];[1:a][music]sidechaincompress=threshold=0.05:ratio=8[ducked];[1:a][ducked]amix=inputs=2:duration=first[aout]',
      '-map', '[aout]',
    ];
  }

  private async normalizeClips(
    clips: VisualClip[],
    outDir: string,
    audioDurationMs: number,
    settings: RenderSettings,
  ): Promise<string[]> {
    const stillCount = clips.filter((c) => c.kind === 'still').length;
    const kenBurnsDurationSec =
      stillCount > 0
        ? Math.max(KEN_BURNS_MIN_DURATION_SEC, audioDurationMs / 1000 / stillCount)
        : KEN_BURNS_MIN_DURATION_SEC;

    const normalized: string[] = [];
    for (const [index, clip] of clips.entries()) {
      const outPath = path.join(outDir, `n_${index}.mp4`);
      if (clip.kind === 'still') {
        await this.kenBurnsClip(clip.localPath, outPath, kenBurnsDurationSec, settings);
      } else {
        await this.runFfmpeg([
          '-y',
          '-i', clip.localPath,
          '-vf', `scale=${settings.width}:${settings.height}:force_original_aspect_ratio=increase,crop=${settings.width}:${settings.height},fps=${settings.fps}`,
          '-an',
          '-c:v', settings.vcodec === 'libx265' ? 'libx264' : settings.vcodec,
          outPath,
        ]);
      }
      normalized.push(outPath);
    }
    return normalized;
  }

  private async kenBurnsClip(
    stillPath: string,
    outPath: string,
    durationSec: number,
    settings: RenderSettings,
  ): Promise<void> {
    const oversizeWidth = settings.width * 2;
    const oversizeHeight = settings.height * 2;
    const totalFrames = Math.round(durationSec * settings.fps);

    await this.runFfmpeg([
      '-y',
      '-loop', '1',
      '-i', stillPath,
      '-t', String(durationSec),
      '-vf',
      `scale=${oversizeWidth}:${oversizeHeight}:force_original_aspect_ratio=increase,crop=${oversizeWidth}:${oversizeHeight},zoompan=z='min(zoom+0.0015,1.2)':d=${totalFrames}:s=${settings.width}x${settings.height}:fps=${settings.fps}`,
      '-pix_fmt', 'yuv420p',
      '-c:v', 'libx264',
      outPath,
    ]);
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
