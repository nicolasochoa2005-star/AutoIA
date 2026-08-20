import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScriptService } from '../script/script.service';
import { EmbeddingService } from './embedding.service';
import { cosineSimilarity } from './cosine-similarity';
import { GeneratedScript } from '../types/script.types';
import { HISTORY_STORE } from './history-store.token';
import type { ScriptHistoryStore } from './history-store.token';
import type { CharacterBible } from '../library/library.types';
import type { NarrativeProfile } from '../script/narrative-profile';
import { DEFAULT_NARRATIVE_PROFILE } from '../script/narrative-profile';

const DEFAULT_MAX_REGENERATIONS = 3;
const DEFAULT_SIMILARITY_THRESHOLD = 0.85;
const DEFAULT_HISTORY_WINDOW = 20;

const HOOK_PATTERNS: Array<{ type: string; test: (text: string) => boolean }> = [
  { type: 'pregunta', test: (t) => t.trimStart().startsWith('¿') },
  { type: 'cifra', test: (t) => /^\s*\d/.test(t) },
  { type: 'dato_sabias_que', test: (t) => /sab[ií]as que/i.test(t.slice(0, 60)) },
  { type: 'exclamacion', test: (t) => t.trimStart().startsWith('¡') },
];

export interface AntiRepetitionResult {
  script: GeneratedScript;
  embedding: number[];
  attempts: number;
}

/**
 * Filtro automático pre-QA (ver FuncionalDoc.md sección 3.5): rechaza guiones
 * demasiado similares al histórico reciente y le pide al LLM que se diferencie,
 * antes de que el video llegue siquiera a la etapa de QA manual.
 */
@Injectable()
export class AntiRepetitionService {
  private readonly logger = new Logger(AntiRepetitionService.name);

  constructor(
    private readonly scriptService: ScriptService,
    private readonly embeddingService: EmbeddingService,
    private readonly config: ConfigService,
    @Inject(HISTORY_STORE) private readonly historyStore: ScriptHistoryStore,
  ) {}

  async generateNonRepetitive(
    topicHint: string,
    character?: CharacterBible,
    profile: NarrativeProfile = DEFAULT_NARRATIVE_PROFILE,
  ): Promise<AntiRepetitionResult> {
    const maxAttempts = this.config.get<number>(
      'ANTI_REPETITION_MAX_ATTEMPTS',
      DEFAULT_MAX_REGENERATIONS,
    );
    const threshold = this.config.get<number>(
      'ANTI_REPETITION_THRESHOLD',
      DEFAULT_SIMILARITY_THRESHOLD,
    );
    const historyWindow = this.config.get<number>(
      'ANTI_REPETITION_HISTORY_WINDOW',
      DEFAULT_HISTORY_WINDOW,
    );

    const history = await this.historyStore.getRecent(historyWindow);
    const recentTitles = history.map((h) => h.title);
    const recentHookTypes = [...new Set(history.slice(-3).map((h) => h.hookType))];

    let extraInstruction: string | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let script: GeneratedScript;
      try {
        script = await this.scriptService.generate(
          topicHint,
          recentTitles,
          extraInstruction,
          character,
          profile,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith('INVALID_SCRIPT:') && attempt < maxAttempts) {
          this.logger.warn(`Intento ${attempt}/${maxAttempts}: ${message}`);
          extraInstruction = [
            extraInstruction,
            'El JSON anterior no cumplió el contrato narrativo. Completá hook, desarrollo, climax y cta, acortá a 75 palabras y duration_s que sumen 30 o menos.',
          ]
            .filter(Boolean)
            .join(' ');
          continue;
        }
        throw error;
      }
      const embedding = await this.embeddingService.embed(script.guion_locucion);

      const maxSimilarity = this.maxSimilarityAgainst(embedding, history);
      const hookType = this.classifyHook(script.guion_locucion);

      this.logger.log(
        `Intento ${attempt}/${maxAttempts}: similitud máx. ${maxSimilarity.toFixed(3)} (umbral ${threshold}), hook="${hookType}"`,
      );

      const repeatsHook = recentHookTypes.includes(hookType) && recentHookTypes.length > 0;

      if (maxSimilarity <= threshold && !repeatsHook) {
        return { script, embedding, attempts: attempt };
      }

      extraInstruction = this.buildRetryInstruction(maxSimilarity > threshold, repeatsHook, hookType);
    }

    throw new Error(
      `REPETITIVE_CONTENT: no se logró un guion suficientemente distinto del histórico tras ${maxAttempts} intentos`,
    );
  }

  /** Recalcula el embedding de un guion ya persistido (resume/override/pause). */
  async embedForResume(script: GeneratedScript): Promise<number[]> {
    return this.embeddingService.embed(script.guion_locucion);
  }

  async recordPublished(
    script: GeneratedScript,
    embedding: number[],
    videoId?: string,
  ): Promise<void> {
    await this.historyStore.save({
      videoId,
      title: script.titulo,
      hookType: this.classifyHook(script.guion_locucion),
      embedding,
      createdAt: new Date().toISOString(),
    });
  }

  private maxSimilarityAgainst(
    embedding: number[],
    history: Array<{ embedding: number[] }>,
  ): number {
    if (history.length === 0) return 0;
    return Math.max(...history.map((h) => cosineSimilarity(embedding, h.embedding)));
  }

  private classifyHook(text: string): string {
    const match = HOOK_PATTERNS.find((p) => p.test(text));
    return match?.type ?? 'otro';
  }

  private buildRetryInstruction(tooSimilar: boolean, repeatsHook: boolean, hookType: string): string {
    const parts: string[] = [];
    if (tooSimilar) {
      parts.push(
        'El guion anterior fue demasiado similar en contenido a videos ya publicados. Elegí un ángulo, dato o enfoque completamente distinto para el mismo tema general.',
      );
    }
    if (repeatsHook) {
      parts.push(
        `El guion anterior repitió el mismo tipo de apertura ("${hookType}") que videos recientes. Usá un estilo de apertura distinto (ej. otro de: pregunta, cifra, dato "sabías que", exclamación, anécdota).`,
      );
    }
    return parts.join(' ');
  }
}
