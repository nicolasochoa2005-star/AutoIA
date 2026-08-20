import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs/promises';
import { SynthesizedAudio, WordTimestamp } from '../../types/script.types';
import { buildAssSubtitles } from '../ass-builder';
import { TtsProvider } from './tts-provider.interface';

interface ElevenLabsAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

interface ElevenLabsTimestampResponse {
  audio_base64?: string;
  alignment?: ElevenLabsAlignment;
}

@Injectable()
export class ElevenLabsTtsProvider implements TtsProvider {
  readonly name = 'elevenlabs';
  private readonly logger = new Logger(ElevenLabsTtsProvider.name);

  constructor(private readonly config: ConfigService) {}

  async synthesize(text: string, outputDir: string): Promise<SynthesizedAudio> {
    const apiKey = this.config.get<string>('ELEVENLABS_API_KEY');
    const voiceId = this.config.get<string>('ELEVENLABS_VOICE_ID', 'JBFqnCBsd6RMkjVDRZzb');
    if (!apiKey) {
      throw new Error('AUTH_FAILED: missing ELEVENLABS_API_KEY');
    }

    await fs.mkdir(outputDir, { recursive: true });
    const audioPath = path.join(outputDir, 'voice.mp3');
    const subtitlesAssPath = path.join(outputDir, 'subtitles.ass');

    this.logger.log(`ElevenLabs voice ${voiceId}`);
    const response = await axios.post<ElevenLabsTimestampResponse>(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
      { text, model_id: this.config.get<string>('ELEVENLABS_MODEL_ID', 'eleven_multilingual_v2') },
      {
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        timeout: 60_000,
      },
    );

    const words = wordsFromAlignment(response.data.alignment);
    if (words.length === 0) {
      throw new Error('TTS_NO_TIMESTAMPS: ElevenLabs no devolvió marcas de tiempo por palabra');
    }
    if (!response.data.audio_base64) {
      throw new Error('TTS_TIMEOUT: ElevenLabs no devolvió audio');
    }

    await fs.writeFile(audioPath, Buffer.from(response.data.audio_base64, 'base64'));
    await fs.writeFile(subtitlesAssPath, buildAssSubtitles(words), 'utf-8');
    return {
      audioPath,
      subtitlesAssPath,
      words,
      durationMs: words[words.length - 1]?.endMs ?? 0,
    };
  }
}

export function wordsFromAlignment(alignment?: ElevenLabsAlignment): WordTimestamp[] {
  if (!alignment?.characters?.length) {
    return [];
  }
  const words: WordTimestamp[] = [];
  let current = '';
  let start = 0;
  let end = 0;
  alignment.characters.forEach((ch, index) => {
    const startMs = (alignment.character_start_times_seconds[index] ?? 0) * 1000;
    const endMs = (alignment.character_end_times_seconds[index] ?? 0) * 1000;
    if (!ch.trim()) {
      if (current) {
        words.push({ word: current, startMs: Math.round(start), endMs: Math.round(end) });
        current = '';
      }
      return;
    }
    if (!current) {
      start = startMs;
    }
    current += ch;
    end = endMs;
  });
  if (current) {
    words.push({ word: current, startMs: Math.round(start), endMs: Math.round(end) });
  }
  return words;
}
