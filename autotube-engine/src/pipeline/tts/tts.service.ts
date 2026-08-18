import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';
import { EdgeTTS } from 'edge-tts-universal';
import { SynthesizedAudio, WordTimestamp } from '../types/script.types';
import { buildAssSubtitles } from './ass-builder';

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);

  constructor(private readonly config: ConfigService) {}

  async synthesize(text: string, outputDir: string): Promise<SynthesizedAudio> {
    await fs.mkdir(outputDir, { recursive: true });

    const voice = this.config.get<string>('EDGE_TTS_VOICE', 'es-ES-AlvaroNeural');
    const audioPath = path.join(outputDir, 'voice.mp3');
    const subtitlesAssPath = path.join(outputDir, 'subtitles.ass');

    const tts = new EdgeTTS(text, voice);
    const { audio, subtitle } = await tts.synthesize();

    const words: WordTimestamp[] = subtitle
      .filter((w) => w.text.trim().length > 0)
      .map((w) => ({
        word: w.text,
        startMs: Math.round(w.offset / 10000),
        endMs: Math.round((w.offset + w.duration) / 10000),
      }));

    if (words.length === 0) {
      throw new Error('TTS_TIMEOUT: no se obtuvieron marcas de tiempo por palabra');
    }

    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    await fs.writeFile(audioPath, audioBuffer);

    const assContent = buildAssSubtitles(words);
    await fs.writeFile(subtitlesAssPath, assContent, 'utf-8');

    const durationMs = words[words.length - 1]?.endMs ?? 0;

    return { audioPath, subtitlesAssPath, words, durationMs };
  }

  /** Reanuda una etapa TTS ya completada (manifest `done` o gate `pause`/`override`). */
  async loadExisting(audioDir: string): Promise<SynthesizedAudio> {
    const audioPath = path.join(audioDir, 'voice.mp3');
    const subtitlesAssPath = path.join(audioDir, 'subtitles.ass');
    const durationMs = await this.probeDurationMs(audioPath);
    return { audioPath, subtitlesAssPath, words: [], durationMs };
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
