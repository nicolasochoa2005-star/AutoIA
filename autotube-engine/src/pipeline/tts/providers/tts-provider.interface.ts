import { SynthesizedAudio } from '../../types/script.types';

export interface TtsProvider {
  readonly name: string;
  synthesize(text: string, outputDir: string): Promise<SynthesizedAudio>;
}
