import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as path from 'path';
import { PipelineService } from '../pipeline/pipeline.service';
import { classifyErrorReason } from './error-classifier';
import { JobLogStore } from './job-log-store';
import { VIDEO_GENERATION_QUEUE, VideoGenerationJobData } from './pipeline.queue';

@Processor(VIDEO_GENERATION_QUEUE)
export class PipelineProcessor extends WorkerHost {
  private readonly logger = new Logger(PipelineProcessor.name);

  constructor(
    private readonly pipelineService: PipelineService,
    private readonly jobLogStore: JobLogStore,
  ) {
    super();
  }

  async process(job: Job<VideoGenerationJobData>): Promise<void> {
    const { topicHint } = job.data;
    const workDir = path.join(process.cwd(), 'output', `job_${job.id}`);

    this.logger.log(`Procesando job ${job.id}: "${topicHint}"`);

    try {
      await this.pipelineService.run(topicHint, workDir);
      await this.jobLogStore.append({
        jobId: String(job.id),
        topicHint,
        success: true,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      const errorReason = classifyErrorReason(error);
      const errorDetail = error instanceof Error ? error.message : String(error);

      await this.jobLogStore.append({
        jobId: String(job.id),
        topicHint,
        success: false,
        errorReason,
        errorDetail,
        createdAt: new Date().toISOString(),
      });

      this.logger.error(`Job ${job.id} falló con motivo ${errorReason}: ${errorDetail}`);

      // No se reintenta el pipeline completo a nivel de job (ver política de
      // errores 3.8, regla 4 de idempotencia): los reintentos transitorios ya
      // se manejan dentro de cada etapa. Un fallo acá pasa a estado ERROR.
      throw error;
    }
  }
}
