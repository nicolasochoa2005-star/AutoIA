import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import { spawn } from 'child_process';
import { SynthesizedAudio } from '../types/script.types';
import { CostCapService } from '../../cost/cost-cap.service';
import { estimateElevenLabsUsd } from '../../cost/cost-rates';
import { EdgeTtsProvider } from './providers/edge-tts.provider';
import { ElevenLabsTtsProvider } from './providers/elevenlabs-tts.provider';
import type { TtsProvider } from './providers/tts-provider.interface';

export type TtsProviderName = 'edge-tts' | 'elevenlabs';

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  lastProvider = 'edge-tts';
  lastCostUsd = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly edge: EdgeTtsProvider,
    private readonly elevenlabs: ElevenLabsTtsProvider,
    private readonly caps: CostCapService,
  ) {}

  async synthesize(
    text: string,
    outputDir: string,
    options: { videoId?: string; provider?: TtsProviderName } = {},
  ): Promise<SynthesizedAudio> {
    const requested = this.resolveProvider(options.provider);
    const paid = requested === 'elevenlabs';
    const estimate = paid ? estimateElevenLabsUsd(text) : 0;

    if (paid) {
      const allowed = await this.caps.canAfford(estimate, options.videoId);
      if (!allowed) {
        if (this.caps.onCap() === 'waiting') {
          throw this.caps.capExceededError();
        }
        this.logger.warn('Tope de costo: TTS cae a Edge-TTS ($0)');
        return this.run(this.edge, text, outputDir, 0);
      }
    }

    try {
      return await this.run(this.providerByName(requested), text, outputDir, estimate);
    } catch (error) {
      if (paid && this.isFallbackable(error)) {
        this.logger.warn(`ElevenLabs falló (${(error as Error).message}); fallback Edge-TTS`);
        return this.run(this.edge, text, outputDir, 0);
      }
      throw error;
    }
  }

  async loadExisting(audioDir: string): Promise<SynthesizedAudio> {
    const audioPath = path.join(audioDir, 'voice.mp3');
    const subtitlesAssPath = path.join(audioDir, 'subtitles.ass');
    const durationMs = await this.probeDurationMs(audioPath);
    this.lastProvider = 'edge-tts';
    this.lastCostUsd = 0;
    return { audioPath, subtitlesAssPath, words: [], durationMs };
  }

  private async run(
    provider: TtsProvider,
    text: string,
    outputDir: string,
    costUsd: number,
  ): Promise<SynthesizedAudio> {
    const audio = await provider.synthesize(text, outputDir);
    this.lastProvider = provider.name;
    this.lastCostUsd = provider.name === 'elevenlabs' ? costUsd : 0;
    return audio;
  }

  private resolveProvider(override?: TtsProviderName): TtsProviderName {
    const raw = (override || this.config.get<string>('TTS_PROVIDER', 'edge-tts') || 'edge-tts').toLowerCase();
    return raw === 'elevenlabs' ? 'elevenlabs' : 'edge-tts';
  }

  private providerByName(name: TtsProviderName): TtsProvider {
    return name === 'elevenlabs' ? this.elevenlabs : this.edge;
  }

  private isFallbackable(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('TTS_NO_TIMESTAMPS:')) {
      return false;
    }
    const status = (error as { response?: { status?: number } })?.response?.status;
    return status === 429 || status === 402 || /insufficient|quota|rate limit/i.test(message);
  }

  private probeDurationMs(audioPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffprobe', [
        '-v', 'quiet',
        '-show_entries', 'format=duration',
        '-of', 'csv=p=0',
        audioPath,
      ]);
      let stdout = '';
      proc.stdout.on('data', (chunk) => (stdout += chunk.toString()));
      proc.on('error', (err) => reject(new Error(`TTS_TIMEOUT: ${err.message}`)));
      proc.on('close', (code) => {
        const seconds = parseFloat(stdout.trim());
        if (code === 0 && !Number.isNaN(seconds)) {
          resolve(Math.round(seconds * 1000));
        } else {
          reject(new Error('TTS_TIMEOUT: no se pudo determinar la duración del audio existente'));
        }
      });
    });
  }
}
