import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { VIDEO_PUBLISH_QUEUE } from './publish.queue';
import type { VideoPublishJobData } from './publish.queue';

@Injectable()
export class PublishProducerService {
  private readonly logger = new Logger(PublishProducerService.name);

  constructor(
    @InjectQueue(VIDEO_PUBLISH_QUEUE) private readonly queue: Queue<VideoPublishJobData>,
  ) {}

  async enqueue(videoId: string, delayMs = 0): Promise<string> {
    const job = await this.queue.add(
      'publish-video',
      { videoId },
      {
        attempts: 1,
        delay: delayMs,
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );
    this.logger.log(`Publish job encolado (${job.id}) para video ${videoId}`);
    return String(job.id);
  }
}
