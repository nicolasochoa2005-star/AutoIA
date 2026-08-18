import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeneratedScript } from '../types/script.types';

const SYSTEM_PROMPT = `Sos un guionista de YouTube Shorts. Generá una pieza de contenido corta (25-40s de locución) en formato JSON estricto, sin texto adicional fuera del JSON, con esta forma exacta:
{
  "titulo": string,
  "descripcion": string (incluir 2-3 hashtags relevantes),
  "etiquetas": string[] (5-8 etiquetas),
  "guion_locucion": string (texto de locución en español, natural, sin marcas de tiempo),
  "prompts_visuales": string[] (3-5 prompts en inglés para buscar stock footage)
}`;

@Injectable()
export class ScriptService {
  private readonly logger = new Logger(ScriptService.name);
  private readonly client: GoogleGenerativeAI;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.getOrThrow<string>('GEMINI_API_KEY');
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generate(
    topicHint: string,
    recentTitles: string[],
  ): Promise<GeneratedScript> {
    const model = this.client.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const historyBlock = recentTitles.length
      ? `Temas ya publicados recientemente (NO repetir tema ni estructura de apertura): ${recentTitles.join(', ')}`
      : 'No hay videos previos publicados todavía.';

    const prompt = `${SYSTEM_PROMPT}\n\nTema sugerido: ${topicHint}\n${historyBlock}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();

    return this.parseAndValidate(raw);
  }

  private parseAndValidate(raw: string): GeneratedScript {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('INVALID_SCRIPT: la respuesta del LLM no es JSON válido');
    }

    if (!this.isGeneratedScript(parsed)) {
      throw new Error('INVALID_SCRIPT: la respuesta no cumple el schema esperado');
    }

    return parsed;
  }

  private isGeneratedScript(value: unknown): value is GeneratedScript {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string, unknown>;
    return (
      typeof v.titulo === 'string' &&
      typeof v.descripcion === 'string' &&
      Array.isArray(v.etiquetas) &&
      v.etiquetas.every((t) => typeof t === 'string') &&
      typeof v.guion_locucion === 'string' &&
      v.guion_locucion.trim().length > 0 &&
      Array.isArray(v.prompts_visuales) &&
      v.prompts_visuales.every((p) => typeof p === 'string') &&
      v.prompts_visuales.length > 0
    );
  }
}
