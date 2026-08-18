import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { isAxiosError } from 'axios';
import { ScriptProvider } from './script-provider.interface';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

@Injectable()
export class GroqProvider implements ScriptProvider {
  readonly name = 'groq';

  constructor(private readonly config: ConfigService) {}

  async generateRaw(prompt: string): Promise<string> {
    const apiKey = this.config.getOrThrow<string>('GROQ_API_KEY');
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      },
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    return response.data.choices[0].message.content;
  }

  isTransientError(error: unknown): boolean {
    if (isAxiosError(error)) {
      const status = error.response?.status;
      return status === 429 || status === 500 || status === 503 || error.code === 'ECONNABORTED';
    }
    return /timeout/i.test(error instanceof Error ? error.message : String(error));
  }
}
