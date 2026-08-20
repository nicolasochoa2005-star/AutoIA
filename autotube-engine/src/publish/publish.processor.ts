import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PublishConflictError, VideoNotFoundError } from '../db/video-review.errors';
import { PublishProducerService } from './publish-producer.service';
import { VIDEO_PUBLISH_QUEUE } from './publish.queue';
import type { VideoPublishJobData } from './publish.queue';
import { PublishService } from './publish.service';

@Processor(VIDEO_PUBLISH_QUEUE)
export class PublishProcessor extends WorkerHost {
  private readonly logger = new Logger(PublishProcessor.name);

  constructor(
    private readonly publish: PublishService,
    private readonly producer: PublishProducerService,
  ) {
    super();
  }

  async process(job: Job<VideoPublishJobData>): Promise<void> {
    const { videoId } = job.data;
    this.logger.log(`Publicando video ${videoId} (job ${job.id})`);

    try {
      const result = await this.publish.publish(videoId);
      if (result.kind === 'quota-exceeded') {
        const delay = Math.max(result.retryAt.getTime() - Date.now(), 60_000);
        await this.producer.enqueue(videoId, delay);
        this.logger.warn(`Reencolado ${videoId} con delay ${delay}ms por cuota`);
        return;
      }
      if (result.kind === 'already-published') {
        this.logger.log(`Video ${videoId} ya estaba publicado (${result.youtubeVideoId})`);
        return;
      }
      this.logger.log(`Video ${videoId} publicado como ${result.youtubeVideoId}`);
    } catch (error) {
      if (error instanceof PublishConflictError || error instanceof VideoNotFoundError) {
        this.logger.warn(`Publish omitido: ${error.message}`);
        return;
      }
      throw error;
    }
  }
}
