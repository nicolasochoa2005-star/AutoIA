import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { GoogleYoutubeAnalyticsClient } from './google-youtube-analytics.client';
import { MetricsController } from './metrics.controller';
import { YOUTUBE_ANALYTICS_CLIENT } from './youtube-analytics.client';

@Module({
  controllers: [MetricsController],
  providers: [
    AnalyticsService,
    GoogleYoutubeAnalyticsClient,
    { provide: YOUTUBE_ANALYTICS_CLIENT, useExisting: GoogleYoutubeAnalyticsClient },
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
