import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'edge-tts-node';
import { SynthesizedAudio, WordTimestamp } from '../types/script.types';
import { buildAssSubtitles } from './ass-builder';

interface WordBoundaryMetadata {
  type: 'WordBoundary';
  offset: number;
  duration: number;
  text: string;
}

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);

  constructor(private readonly config: ConfigService) {}

  async synthesize(text: string, outputDir: string): Promise<SynthesizedAudio> {
    await fs.mkdir(outputDir, { recursive: true });

    const voice = this.config.get<string>('EDGE_TTS_VOICE', 'es-ES-AlvaroNeural');
    const audioPath = path.join(outputDir, 'voice.mp3');
    const subtitlesAssPath = path.join(outputDir, 'subtitles.ass');

    const tts = new MsEdgeTTS({});
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const { audioBuffer, words } = await this.collectStream(tts, text);
    tts.close();

    if (words.length === 0) {
      throw new Error('TTS_TIMEOUT: no se obtuvieron marcas de tiempo por palabra');
    }

    await fs.writeFile(audioPath, audioBuffer);

    const assContent = buildAssSubtitles(words);
    await fs.writeFile(subtitlesAssPath, assContent, 'utf-8');

    const durationMs = words[words.length - 1]?.endMs ?? 0;

    return { audioPath, subtitlesAssPath, words, durationMs };
  }

  /**
   * edge-tts-node pushes metadata (JSON strings) and raw audio (Buffers)
   * into the same non-object-mode stream; chunks must be disambiguated
   * by attempting JSON.parse on each one.
   */
  private collectStream(
    tts: MsEdgeTTS,
    text: string,
  ): Promise<{ audioBuffer: Buffer; words: WordTimestamp[] }> {
    return new Promise((resolve, reject) => {
      const audioChunks: Buffer[] = [];
      const words: WordTimestamp[] = [];

      const stream = tts.toStream(text);

      stream.on('data', (chunk: Buffer) => {
        const parsed = this.tryParseMetadata(chunk);
        if (parsed) {
          words.push({
            word: parsed.text,
            startMs: Math.round(parsed.offset / 10000),
            endMs: Math.round((parsed.offset + parsed.duration) / 10000),
          });
        } else {
          audioChunks.push(chunk);
        }
      });

      stream.on('end', () => resolve({ audioBuffer: Buffer.concat(audioChunks), words }));
      stream.on('error', (err) => reject(err));
    });
  }

  private tryParseMetadata(chunk: Buffer): WordBoundaryMetadata | null {
    try {
      const parsed = JSON.parse(chunk.toString('utf8'));
      if (parsed && parsed.type === 'WordBoundary') {
        return parsed as WordBoundaryMetadata;
      }
      return null;
    } catch {
      return null;
    }
  }
}
