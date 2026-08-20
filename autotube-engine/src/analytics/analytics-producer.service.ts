import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { VIDEO_ANALYTICS_QUEUE } from './analytics.queue';
import type { VideoAnalyticsJobData } from './analytics.queue';

@Injectable()
export class AnalyticsProducerService {
  private readonly logger = new Logger(AnalyticsProducerService.name);

  constructor(
    @InjectQueue(VIDEO_ANALYTICS_QUEUE) private readonly queue: Queue<VideoAnalyticsJobData>,
  ) {}

  async enqueue(): Promise<string> {
    const job = await this.queue.add(
      'sync-analytics',
      {},
      { attempts: 1, removeOnComplete: 50, removeOnFail: 100 },
    );
    this.logger.log(`Analytics job encolado (${job.id})`);
    return String(job.id);
  }

  @Cron(process.env.ANALYTICS_CRON_SCHEDULE || '0 */6 * * *', { name: 'analytics-sync' })
  async handleCron(): Promise<void> {
    this.logger.log('Disparando CRON 2 (YouTube Analytics)');
    await this.enqueue();
  }
}
