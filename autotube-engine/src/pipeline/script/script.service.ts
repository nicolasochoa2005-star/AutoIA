import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeneratedScript } from '../types/script.types';
import { withRetry } from '../../common/retry';
import { ScriptProvider } from './providers/script-provider.interface';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';
import { CharacterBible } from '../library/library.types';
import { applyNarrativeContract } from './script-narrative.validator';
import {
  DEFAULT_NARRATIVE_PROFILE,
  parseNarrativeProfile,
  type NarrativeProfile,
} from './narrative-profile';

const AUTOPILOT_PROMPT = `Sos un guionista de YouTube Shorts. Generá una pieza de contenido corta (25-40s de locución) en formato JSON estricto, sin texto adicional fuera del JSON, con esta forma exacta:
{
  "titulo": string,
  "descripcion": string (incluir 2-3 hashtags relevantes),
  "etiquetas": string[] (5-8 etiquetas),
  "guion_locucion": string (texto de locución en español, natural, sin marcas de tiempo),
  "prompts_visuales": string[] (3-5 prompts en inglés para buscar stock footage)
}`;

const DIRECTED_PROMPT = `Sos un guionista de YouTube Shorts. Generá una pieza de máximo 30 segundos de locución (~65-75 palabras) en JSON estricto, sin texto fuera del JSON, con esta forma exacta:
{
  "titulo": string,
  "descripcion": string (incluir 2-3 hashtags relevantes),
  "etiquetas": string[] (5-8 etiquetas),
  "hook": string (apertura inmediata: pregunta, dato o tensión),
  "desarrollo": string (contexto, personaje y conflicto, sin relleno),
  "climax": string (giro o revelación),
  "cta": string (llamado a la acción breve),
  "guion_locucion": string (concatenación de hook, desarrollo, climax y cta),
  "prompts_visuales": string[] (3-5 prompts en inglés para stock)
}
No superes 75 palabras en la locución total. El CTA entra en los 30 segundos.`;

const CHARACTER_SCHEMA_ADDENDUM = `Si se te provee un personaje (identidad fija), agregá también "beats_visuales": array de objetos { "prompt": string, "subject_id": string, "outfit_id": string, "source_hint": "character" } — uno por plano donde aparece el personaje. No cambies de sujeto entre beats: todos deben usar el mismo subject_id salvo indicación contraria.`;

const DIRECTED_CHARACTER_ADDENDUM = `En cada beat incluí "duration_s" (segundos, número) y "action" (qué se ve). La suma de duration_s no puede superar 30. Opcional: camera, continuity, environment.`;

function buildCharacterBlock(character: CharacterBible, profile: NarrativeProfile): string {
  const outfits = character.outfits.map((o) => `${o.id} (${o.description})`).join(', ') || 'ninguno definido';
  const extra = profile === 'directed' ? ` ${DIRECTED_CHARACTER_ADDENDUM}` : '';
  return `Personaje fijado para esta corrida — subject_id "${character.subjectId}": ${character.name}. ${character.description}\nOutfits disponibles: ${outfits}.\nNO cambies la identidad del sujeto entre beats. ${CHARACTER_SCHEMA_ADDENDUM}${extra}`;
}

@Injectable()
export class ScriptService {
  private readonly logger = new Logger(ScriptService.name);
  private readonly providers: ScriptProvider[];
  lastSuccessfulProvider: string | null = null;

  constructor(
    private readonly gemini: GeminiProvider,
    private readonly groq: GroqProvider,
    private readonly config: ConfigService,
  ) {
    const groqConfigured = Boolean(this.config.get<string>('GROQ_API_KEY'));
    this.providers = [this.gemini, ...(groqConfigured ? [this.groq] : [])];
    if (!groqConfigured) {
      this.logger.log('GROQ_API_KEY no configurada: sin fallback de guion, solo Gemini.');
    }
  }

  resolveProfile(override?: NarrativeProfile): NarrativeProfile {
    if (override) return override;
    return parseNarrativeProfile(this.config.get<string>('NARRATIVE_PROFILE', DEFAULT_NARRATIVE_PROFILE));
  }

  async generate(
    topicHint: string,
    recentTitles: string[],
    extraInstruction?: string,
    character?: CharacterBible,
    profile: NarrativeProfile = DEFAULT_NARRATIVE_PROFILE,
  ): Promise<GeneratedScript> {
    const historyBlock = recentTitles.length
      ? `Temas ya publicados recientemente (NO repetir tema ni estructura de apertura): ${recentTitles.join(', ')}`
      : 'No hay videos previos publicados todavía.';

    const extraBlock = extraInstruction ? `\n${extraInstruction}` : '';
    const characterBlock = character ? `\n${buildCharacterBlock(character, profile)}` : '';
    const system = profile === 'directed' ? DIRECTED_PROMPT : AUTOPILOT_PROMPT;
    const prompt = `${system}\n\nTema sugerido: ${topicHint}\n${historyBlock}${extraBlock}${characterBlock}`;

    let lastError: unknown;
    for (const [index, provider] of this.providers.entries()) {
      try {
        const raw = await withRetry(() => provider.generateRaw(prompt), {
          maxAttempts: 3,
          baseDelayMs: 2000,
          isRetryable: (err) => provider.isTransientError(err),
        });
        this.lastSuccessfulProvider = provider.name;
        return this.parseAndValidate(raw, profile);
      } catch (err) {
        lastError = err;
        const hasNextProvider = index < this.providers.length - 1;
        if (hasNextProvider) {
          this.logger.warn(
            `Proveedor de guion "${provider.name}" agotó reintentos, cayendo a fallback: ${(err as Error).message}`,
          );
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('INVALID_SCRIPT: todos los proveedores de guion fallaron');
  }

  parseAndValidate(raw: string, profile: NarrativeProfile = DEFAULT_NARRATIVE_PROFILE): GeneratedScript {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('INVALID_SCRIPT: la respuesta del LLM no es JSON válido');
    }

    if (!this.isGeneratedScript(parsed)) {
      throw new Error('INVALID_SCRIPT: la respuesta no cumple el schema esperado');
    }

    return applyNarrativeContract(
      {
        ...parsed,
        guion_locucion: parsed.guion_locucion ?? '',
      },
      profile,
    );
  }

  private isGeneratedScript(value: unknown): value is GeneratedScript {
    if (typeof value !== 'object' || value === null) return false;
    const v = value as Record<string, unknown>;
    const locution = typeof v.guion_locucion === 'string' ? v.guion_locucion.trim() : '';
    const directedBlocks =
      typeof v.hook === 'string' &&
      v.hook.trim().length > 0 &&
      typeof v.desarrollo === 'string' &&
      v.desarrollo.trim().length > 0 &&
      typeof v.climax === 'string' &&
      v.climax.trim().length > 0 &&
      typeof v.cta === 'string' &&
      v.cta.trim().length > 0;
    return (
      typeof v.titulo === 'string' &&
      typeof v.descripcion === 'string' &&
      Array.isArray(v.etiquetas) &&
      v.etiquetas.every((t) => typeof t === 'string') &&
      Array.isArray(v.prompts_visuales) &&
      v.prompts_visuales.every((p) => typeof p === 'string') &&
      v.prompts_visuales.length > 0 &&
      (locution.length > 0 || directedBlocks)
    );
  }
}
