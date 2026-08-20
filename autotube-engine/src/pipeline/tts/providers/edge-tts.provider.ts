import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';
import { EdgeTTS } from 'edge-tts-universal';
import { SynthesizedAudio, WordTimestamp } from '../../types/script.types';
import { buildAssSubtitles } from '../ass-builder';
import { TtsProvider } from './tts-provider.interface';

@Injectable()
export class EdgeTtsProvider implements TtsProvider {
  readonly name = 'edge-tts';
  private readonly logger = new Logger(EdgeTtsProvider.name);

  constructor(private readonly config: ConfigService) {}

  async synthesize(text: string, outputDir: string): Promise<SynthesizedAudio> {
    await fs.mkdir(outputDir, { recursive: true });
    const voice = this.config.get<string>('EDGE_TTS_VOICE', 'es-ES-AlvaroNeural');
    const audioPath = path.join(outputDir, 'voice.mp3');
    const subtitlesAssPath = path.join(outputDir, 'subtitles.ass');

    this.logger.log(`Edge-TTS (${voice})`);
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

    await fs.writeFile(audioPath, Buffer.from(await audio.arrayBuffer()));
    await fs.writeFile(subtitlesAssPath, buildAssSubtitles(words), 'utf-8');
    const durationMs = words[words.length - 1]?.endMs ?? 0;
    return { audioPath, subtitlesAssPath, words, durationMs };
  }
}
