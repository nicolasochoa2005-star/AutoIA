import { Injectable, Logger } from '@nestjs/common';

type FeatureExtractionPipeline = (
  text: string,
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: Float32Array }>;

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

/**
 * Generates sentence embeddings locally (CPU, no API cost) for the
 * anti-repetition filter (ver FuncionalDoc.md sección 3.5). Matches the
 * 384-dim VECTOR column used by pgvector in the videos table.
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

  async embed(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  private getExtractor(): Promise<FeatureExtractionPipeline> {
    if (!this.extractorPromise) {
      this.logger.log(`Cargando modelo de embeddings local (${MODEL_NAME})...`);
      this.extractorPromise = import('@xenova/transformers').then(({ pipeline }) =>
        pipeline('feature-extraction', MODEL_NAME) as unknown as Promise<FeatureExtractionPipeline>,
      );
    }
    return this.extractorPromise;
  }
}
