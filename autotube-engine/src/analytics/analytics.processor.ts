import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { VIDEO_ANALYTICS_QUEUE } from './analytics.queue';

@Processor(VIDEO_ANALYTICS_QUEUE)
export class AnalyticsProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(private readonly analytics: AnalyticsService) {
    super();
  }

  async process(): Promise<void> {
    const result = await this.analytics.syncPublished();
    this.logger.log(`Analytics sync: ${result.synced} ok, ${result.skipped} omitidos`);
  }
}
