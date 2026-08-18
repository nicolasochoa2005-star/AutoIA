import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ScriptProvider } from './script-provider.interface';

@Injectable()
export class GeminiProvider implements ScriptProvider {
  readonly name = 'gemini';
  private readonly client: GoogleGenerativeAI;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.getOrThrow<string>('GEMINI_API_KEY');
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateRaw(prompt: string): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  isTransientError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /\[(429|500|503)/.test(message) || /timeout/i.test(message);
  }
}
