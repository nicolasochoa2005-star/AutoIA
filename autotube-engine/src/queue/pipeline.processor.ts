import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { VideoStatus } from '@prisma/client';
import { Job } from 'bullmq';
import * as path from 'path';
import { VideoLifecycleService } from '../db/video-lifecycle.service';
import { DEFAULT_STAGE_MODES } from '../pipeline/manifest/manifest.types';
import { PipelineService } from '../pipeline/pipeline.service';
import { classifyErrorReason } from './error-classifier';
import { VIDEO_GENERATION_QUEUE, type VideoGenerationJobData } from './pipeline.queue';
import { WORKER_NARRATIVE_PROFILE } from '../pipeline/script/narrative-profile';

@Processor(VIDEO_GENERATION_QUEUE)
export class PipelineProcessor extends WorkerHost {
  private readonly logger = new Logger(PipelineProcessor.name);

  constructor(
    private readonly pipelineService: PipelineService,
    private readonly videos: VideoLifecycleService,
  ) {
    super();
  }

  async process(job: Job<VideoGenerationJobData>): Promise<void> {
    const { topicHint, videoId } = job.data;
    const workDir = path.join(process.cwd(), 'output', `job_${job.id}`);

    this.logger.log(`Procesando job ${job.id} (video ${videoId}): "${topicHint}"`);

    try {
      await this.pipelineService.runWithOptions({
        topicHint,
        runDir: workDir,
        modes: DEFAULT_STAGE_MODES,
        videoId,
        narrativeProfile: WORKER_NARRATIVE_PROFILE,
      });
    } catch (error) {
      const errorReason = classifyErrorReason(error);
      const errorDetail = error instanceof Error ? error.message : String(error);

      if (errorReason === 'WAITING_FOR_INPUT') {
        await this.videos.setStatus(videoId, VideoStatus.WAITING_FOR_INPUT);
        this.logger.warn(`Job ${job.id} en WAITING_FOR_INPUT: ${errorDetail}`);
        return;
      }

      await this.videos.setStatus(videoId, VideoStatus.ERROR, { errorReason });
      this.logger.error(`Job ${job.id} falló con motivo ${errorReason}: ${errorDetail}`);
      throw error;
    }
  }
}
